<?php
/**
 * Server-authoritative checkout for Uniform Studio team orders.
 *
 * The browser sends the design and roster, but never controls the amount
 * charged. Pricing is rebuilt here from the approved uniform rules, then
 * WooCommerce calculates destination tax and shipping. Stripe and PayPal
 * both charge the resulting WooCommerce order total.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Uniform_Checkout
{
    const NAMESPACE_ = 'connect767/v1';
    const BASE_KIT_PRICE = 35.00;
    const EXTRA_TEAM_SHIRT_PRICE = 12.00;
    const AI_DESIGNER_FEE = 100.00;
    const AI_DESIGNER_FEE_THRESHOLD = 1500.00;
    const AI_DESIGNER_FEE_LABEL = 'Connect767 AI Designer Fee';
    const NORTH_AMERICA_COUNTRIES = ['US', 'CA', 'MX'];
    const CARIBBEAN_COUNTRIES = ['AI', 'AG', 'AW', 'BS', 'BB', 'BQ', 'VG', 'KY', 'CU', 'CW', 'DM', 'DO', 'GD', 'GP', 'HT', 'JM', 'MQ', 'MS', 'PR', 'BL', 'KN', 'LC', 'MF', 'VC', 'SX', 'TT', 'TC', 'VI'];

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        if (!class_exists('WooCommerce')) {
            return;
        }

        $routes = [
            '/uniform-checkout/quote' => 'quote',
            '/uniform-checkout/intent' => 'create_intent',
            '/uniform-checkout/confirm' => 'confirm_payment',
            '/uniform-checkout/paypal/order' => 'create_paypal_order',
            '/uniform-checkout/paypal/capture' => 'capture_paypal_order',
            '/uniform-checkout/local-dominica' => 'create_local_dominica_order',
        ];

        foreach ($routes as $route => $callback) {
            register_rest_route(self::NAMESPACE_, $route, [
                'methods' => 'POST',
                'callback' => [__CLASS__, $callback],
                'permission_callback' => '__return_true',
            ]);
        }
    }

    public static function quote(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('uniform-quote-total', 30, 600);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $order = self::build_order($request, true);
        if (is_wp_error($order)) {
            return $order;
        }

        $totals = self::format_totals($order);
        $order->delete(true);
        return rest_ensure_response($totals);
    }

    public static function create_intent(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('uniform-stripe');
        if (is_wp_error($limited)) {
            return $limited;
        }

        $order = self::build_order($request);
        if (is_wp_error($order)) {
            return $order;
        }

        $amount_cents = (int) round((float) $order->get_total() * 100);
        $intent = C767_Stripe_Checkout::stripe_request('/payment_intents', [
            'amount' => $amount_cents,
            'currency' => strtolower($order->get_currency()),
            'metadata' => ['order_id' => $order->get_id(), 'order_type' => 'uniform'],
            'receipt_email' => $order->get_billing_email(),
            'payment_method_types' => ['card'],
        ]);

        if (is_wp_error($intent)) {
            $order->delete(true);
            return $intent;
        }

        $order->update_meta_data('_c767_stripe_payment_intent', $intent['id']);
        $access_token = C767_Stripe_Checkout::ensure_order_access_token($order);
        $order->save();

        return rest_ensure_response(array_merge(self::format_totals($order), [
            'orderId' => $order->get_id(),
            'clientSecret' => $intent['client_secret'],
            'accessToken' => $access_token,
        ]));
    }

    public static function confirm_payment(WP_REST_Request $request)
    {
        $order = self::verified_order($request);
        if (is_wp_error($order)) {
            return $order;
        }

        $intent_id = (string) $order->get_meta('_c767_stripe_payment_intent');
        if ($intent_id === '') {
            return new WP_Error('c767_no_payment_intent', 'This order has no associated card payment.', ['status' => 400]);
        }

        $intent = C767_Stripe_Checkout::stripe_get('/payment_intents/' . rawurlencode($intent_id));
        if (is_wp_error($intent)) {
            return $intent;
        }

        if (($intent['status'] ?? '') === 'succeeded') {
            $order->payment_complete($intent_id);
            do_action('c767_uniform_order_paid', $order->get_id());
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order->get_id()]);
        }

        return rest_ensure_response(['status' => sanitize_key($intent['status'] ?? 'processing'), 'orderId' => $order->get_id()]);
    }

    public static function create_paypal_order(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('uniform-paypal');
        if (is_wp_error($limited)) {
            return $limited;
        }

        $order = self::build_order($request);
        if (is_wp_error($order)) {
            return $order;
        }

        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            $order->delete(true);
            return $token;
        }

        $designer_fee = self::designer_fee_total($order);
        $breakdown = [
            'item_total' => ['currency_code' => strtoupper($order->get_currency()), 'value' => number_format((float) $order->get_subtotal(), 2, '.', '')],
            'shipping' => ['currency_code' => strtoupper($order->get_currency()), 'value' => number_format((float) $order->get_shipping_total(), 2, '.', '')],
            'tax_total' => ['currency_code' => strtoupper($order->get_currency()), 'value' => number_format((float) $order->get_total_tax(), 2, '.', '')],
        ];
        if ($designer_fee > 0) {
            $breakdown['handling'] = ['currency_code' => strtoupper($order->get_currency()), 'value' => number_format($designer_fee, 2, '.', '')];
        }

        $paypal_order = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders', $token, [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) $order->get_id(),
                'amount' => [
                    'currency_code' => strtoupper($order->get_currency()),
                    'value' => number_format((float) $order->get_total(), 2, '.', ''),
                    'breakdown' => $breakdown,
                ],
            ]],
        ]);

        if (is_wp_error($paypal_order)) {
            $order->delete(true);
            return $paypal_order;
        }

        $order->update_meta_data('_c767_paypal_order_id', $paypal_order['id']);
        $access_token = C767_Stripe_Checkout::ensure_order_access_token($order);
        $order->save();

        return rest_ensure_response(array_merge(self::format_totals($order), [
            'orderId' => $order->get_id(),
            'paypalOrderId' => $paypal_order['id'],
            'accessToken' => $access_token,
        ]));
    }

    public static function capture_paypal_order(WP_REST_Request $request)
    {
        $order = self::verified_order($request);
        if (is_wp_error($order)) {
            return $order;
        }

        $paypal_order_id = (string) $order->get_meta('_c767_paypal_order_id');
        if ($paypal_order_id === '') {
            return new WP_Error('c767_no_paypal_order', 'This order has no associated PayPal payment.', ['status' => 400]);
        }

        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $capture = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders/' . rawurlencode($paypal_order_id) . '/capture', $token);
        if (is_wp_error($capture)) {
            return $capture;
        }

        if (($capture['status'] ?? '') === 'COMPLETED') {
            $order->payment_complete($paypal_order_id);
            do_action('c767_uniform_order_paid', $order->get_id());
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order->get_id()]);
        }

        return rest_ensure_response(['status' => strtolower(sanitize_key($capture['status'] ?? 'processing')), 'orderId' => $order->get_id()]);
    }

    public static function create_local_dominica_order(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('uniform-local-dominica', 10, 600);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $shipping = C767_WooCommerce::sanitize_shipping_address((array) $request->get_param('shipping'));
        if (is_wp_error($shipping)) {
            return $shipping;
        }
        if (strtoupper((string) ($shipping['country'] ?? '')) !== 'DM') {
            return new WP_Error(
                'c767_local_payment_country',
                'Pay Locally in Dominica is only available for delivery addresses in Dominica.',
                ['status' => 400]
            );
        }

        $order = self::build_order($request);
        if (is_wp_error($order)) {
            return $order;
        }

        $instructions = 'Your order is reserved for local payment in Dominica. The Connect767 team will contact you by email with the payment location and instructions before production begins.';
        $order->set_payment_method('c767_local_dominica');
        $order->set_payment_method_title('Pay Locally in Dominica');
        $order->set_customer_note($instructions);
        $order->update_meta_data('_c767_local_dominica_payment', '1');
        $order->update_status('on-hold', $instructions, true);
        $order->save();

        return rest_ensure_response(array_merge(self::format_totals($order), [
            'status' => 'on-hold',
            'orderId' => $order->get_id(),
            'instructions' => $instructions,
        ]));
    }

    private static function verified_order(WP_REST_Request $request)
    {
        $order = wc_get_order(absint($request->get_param('orderId')));
        if (!$order || !$order->get_meta('_c767_uniform_order')) {
            return new WP_Error('c767_uniform_order_not_found', 'Uniform order not found.', ['status' => 404]);
        }
        $access = C767_Stripe_Checkout::verify_order_access($order, $request->get_param('accessToken'));
        return is_wp_error($access) ? $access : $order;
    }

    private static function build_order(WP_REST_Request $request, $temporary = false)
    {
        $payload = (array) $request->get_param('order');
        $roster = (array) ($payload['roster'] ?? []);
        $unit_count = 0;
        foreach ($roster as $entry) {
            $entry = (array) $entry;
            if (sanitize_text_field((string) ($entry['name'] ?? '')) !== '') {
                $unit_count += max(1, min(99, absint($entry['quantity'] ?? 1)));
            }
        }
        if ($unit_count < 1) {
            return new WP_Error('c767_empty_roster', 'Add at least one player before checkout.', ['status' => 400]);
        }
        $minimum_check = C767_REST_Uniform_Quotes::validate_full_kit_minimum($payload['sport'] ?? '', $unit_count);
        if (is_wp_error($minimum_check)) {
            return $minimum_check;
        }

        $email = sanitize_email((string) $request->get_param('email'));
        if (!is_email($email)) {
            return new WP_Error('c767_invalid_email', 'A valid email address is required.', ['status' => 400]);
        }

        $shipping = C767_WooCommerce::sanitize_shipping_address((array) $request->get_param('shipping'));
        if (is_wp_error($shipping)) {
            return $shipping;
        }

        $unit_price = self::authoritative_unit_price($payload);
        $long_sleeve_count = 0;
        if (($payload['sleeve'] ?? '') === 'Mixed') {
            foreach ($roster as $entry) {
                $entry = (array) $entry;
                if (sanitize_text_field((string) ($entry['name'] ?? '')) !== '' && ($entry['sleevePreference'] ?? '') === 'Long') {
                    $long_sleeve_count += max(1, min(99, absint($entry['quantity'] ?? 1)));
                }
            }
        }
        $kits_total = round($unit_price * $unit_count + $long_sleeve_count * 2.00, 2);
        // Extra shirts are added only after a valid full-kit roster exists.
        $extra_team_shirts = self::sanitize_supporter_jerseys($payload['extraTeamShirts'] ?? []);
        $extra_shirt_count = array_reduce($extra_team_shirts, function ($total, $row) {
            return $total + $row['quantity'];
        }, 0);
        $fan_added = rest_sanitize_boolean($payload['fanJerseyAdded'] ?? false);
        $supporter_jerseys = $fan_added ? self::sanitize_supporter_jerseys($payload['supporterJerseys'] ?? []) : [];
        if ($fan_added && empty($supporter_jerseys)) {
            // Backward compatibility for a design saved before size selection
            // existed: the old checkbox represented one adult-medium jersey.
            $supporter_jerseys[] = ['size' => 'AM', 'quantity' => 1];
        }
        $supporter_count = array_reduce($supporter_jerseys, function ($total, $row) {
            return $total + $row['quantity'];
        }, 0);
        $template = sanitize_text_field((string) ($payload['template'] ?? 'Custom design')) ?: 'Custom design';
        $product = self::uniform_product();
        if (is_wp_error($product)) {
            return $product;
        }

        $order = wc_create_order(['status' => $temporary ? 'checkout-draft' : 'pending']);
        if (is_wp_error($order)) {
            return new WP_Error('c767_uniform_order_failed', $order->get_error_message(), ['status' => 400]);
        }

        $kit_item_id = $order->add_product($product, $unit_count, [
            'subtotal' => $kits_total,
            'total' => $kits_total,
        ]);
        $kit_item = $order->get_item($kit_item_id);
        if ($kit_item) {
            $kit_item->set_name($template . ' team kit');
            $kit_item->add_meta_data('Base kit price', wc_price(self::BASE_KIT_PRICE), true);
            $kit_item->add_meta_data('Final unit price', wc_price($unit_price), true);
            if (($payload['sleeve'] ?? '') === 'Long') {
                $kit_item->add_meta_data('Long sleeves', $unit_count . ' × ' . wc_price(2.00), true);
            }
            if ($long_sleeve_count > 0) {
                $kit_item->add_meta_data('Long sleeve upgrades', $long_sleeve_count . ' × ' . wc_price(2.00), true);
            }
            if (($payload['collar'] ?? '') === 'Polo') {
                $kit_item->add_meta_data('Polo-style collars', $unit_count . ' × ' . wc_price(2.00), true);
            }
            if (rest_sanitize_boolean($payload['insideCollarMessage'] ?? false)) {
                $kit_item->add_meta_data('Inside-collar logo/message', $unit_count . ' × ' . wc_price(1.00), true);
            }
            if (($payload['logoApplication'] ?? '') === 'Embroidery') {
                $kit_item->add_meta_data('Embroidered team logo', $unit_count . ' × ' . wc_price(1.50), true);
            }
            $kit_item->save();
        }

        if ($extra_shirt_count > 0) {
            $extra_shirt_total = round(self::EXTRA_TEAM_SHIRT_PRICE * $extra_shirt_count, 2);
            $extra_item_id = $order->add_product($product, $extra_shirt_count, ['subtotal' => $extra_shirt_total, 'total' => $extra_shirt_total]);
            $extra_item = $order->get_item($extra_item_id);
            if ($extra_item) {
                $extra_item->set_name($template . ' extra team shirt');
                $extra_item->add_meta_data('Unit price', wc_price(self::EXTRA_TEAM_SHIRT_PRICE), true);
                $extra_item->add_meta_data('Sizes', implode(', ', array_map(function ($row) {
                    return $row['size'] . ' × ' . $row['quantity'];
                }, $extra_team_shirts)), true);
                $extra_item->save();
            }
        }

        if ($supporter_count > 0) {
            $supporter_total = round(self::EXTRA_TEAM_SHIRT_PRICE * $supporter_count, 2);
            $fan_item_id = $order->add_product($product, $supporter_count, [
                'subtotal' => $supporter_total,
                'total' => $supporter_total,
            ]);
            $fan_item = $order->get_item($fan_item_id);
            if ($fan_item) {
                $fan_item->set_name($template . ' supporter jersey');
                $fan_item->add_meta_data('Unit price', wc_price(self::EXTRA_TEAM_SHIRT_PRICE), true);
                $fan_item->add_meta_data('Sizes', implode(', ', array_map(function ($row) {
                    return $row['size'] . ' × ' . $row['quantity'];
                }, $supporter_jerseys)), true);
                $fan_item->add_meta_data('Player numbers', 'None', true);
                $fan_item->save();
            }
        }

        $billing = $shipping;
        $billing['email'] = $email;
        $order->set_address($billing, 'billing');
        $order->set_address($shipping, 'shipping');
        $order->calculate_totals(false);

        $shipping_units = $unit_count + $extra_shirt_count + $supporter_count;
        $shipping_rate = self::uniform_shipping_rate($shipping['country'] ?? '', $shipping_units);
        if (is_wp_error($shipping_rate)) {
            $order->delete(true);
            return $shipping_rate;
        }

        $shipping_item = new WC_Order_Item_Shipping();
        $shipping_item->set_method_title($shipping_rate['label']);
        $shipping_item->set_method_id('c767_uniform_zone_rate');
        $shipping_item->set_instance_id(0);
        $shipping_item->set_total($shipping_rate['amount']);
        $shipping_item->add_meta_data('Shipping zone', $shipping_rate['zoneLabel'], true);
        $shipping_item->add_meta_data('Total order units', $shipping_units, true);
        $order->add_item($shipping_item);

        if (((float) $order->get_subtotal() + (float) $shipping_rate['amount']) < self::AI_DESIGNER_FEE_THRESHOLD) {
            $designer_fee_item = new WC_Order_Item_Fee();
            $designer_fee_item->set_name(self::AI_DESIGNER_FEE_LABEL);
            $designer_fee_item->set_amount(self::AI_DESIGNER_FEE);
            $designer_fee_item->set_total(self::AI_DESIGNER_FEE);
            $designer_fee_item->set_tax_status('none');
            $order->add_item($designer_fee_item);
        }
        $order->calculate_taxes($shipping);
        $order->calculate_totals(false);
        if (!$temporary) {
            $order->set_status('pending');
        }
        $order->update_meta_data('_c767_uniform_order', '1');
        $order->update_meta_data('_c767_uniform_unit_count', $unit_count);
        $order->update_meta_data('_c767_uniform_unit_price', $unit_price);
        $order->update_meta_data('_c767_uniform_supporter_count', $supporter_count);
        $order->update_meta_data('_c767_uniform_shipping_zone', $shipping_rate['zone']);
        $order->update_meta_data('_c767_uniform_shipping_units', $shipping_units);

        $design_payload = $payload;
        $design_payload['kitType'] = 'Full';
        $design_payload['extraTeamShirts'] = $extra_team_shirts;
        $collar_attachment = rest_sanitize_boolean($payload['insideCollarMessage'] ?? false)
            ? C767_REST_Uniform_Quotes::sanitize_collar_attachment($payload['insideCollarAttachment'] ?? null) : null;
        if ($collar_attachment) {
            $order->update_meta_data('_c767_uniform_collar_attachment', $collar_attachment);
        }
        $design_payload['insideCollarAttachment'] = $collar_attachment ? array_diff_key($collar_attachment, ['src' => true]) : null;
        unset($design_payload['previewImage']);
        $encoded = wp_json_encode($design_payload);
        if ($encoded && strlen($encoded) <= 524288) {
            $order->update_meta_data('_c767_uniform_design', $encoded);
        }
        $preview = (string) ($payload['previewImage'] ?? '');
        if (strpos($preview, 'data:image/') === 0 && strlen($preview) <= 5242880) {
            $order->update_meta_data('_c767_uniform_preview', $preview);
        }
        $order->save();
        return $order;
    }

    private static function sanitize_supporter_jerseys($value)
    {
        $allowed_sizes = ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'];
        $combined = [];

        foreach ((array) $value as $entry) {
            $row = (array) $entry;
            $size = strtoupper(sanitize_text_field((string) ($row['size'] ?? '')));
            if (!in_array($size, $allowed_sizes, true)) {
                continue;
            }
            $quantity = max(1, min(99, absint($row['quantity'] ?? 1)));
            $combined[$size] = min(99, ($combined[$size] ?? 0) + $quantity);
        }

        return array_map(function ($size, $quantity) {
            return ['size' => $size, 'quantity' => $quantity];
        }, array_keys($combined), array_values($combined));
    }

    private static function authoritative_unit_price(array $payload)
    {
        $price = self::BASE_KIT_PRICE;
        $sleeve = sanitize_text_field((string) ($payload['sleeve'] ?? ''));
        $collar = sanitize_text_field((string) ($payload['collar'] ?? ''));
        if ($sleeve === 'Long') {
            $price += 2.00;
        }
        if ($collar === 'Polo') {
            $price += 2.00;
        }
        if (rest_sanitize_boolean($payload['insideCollarMessage'] ?? false)) {
            $price += 1.00;
        }
        if (sanitize_text_field((string) ($payload['logoApplication'] ?? '')) === 'Embroidery') {
            $price += 1.50;
        }
        return round($price, 2);
    }

    private static function uniform_shipping_rate($country, $unit_count)
    {
        $country = strtoupper(sanitize_text_field((string) $country));
        $unit_count = max(0, absint($unit_count));
        $high_volume = $unit_count >= 50;

        if (in_array($country, self::NORTH_AMERICA_COUNTRIES, true)) {
            return [
                'zone' => 'north-america',
                'zoneLabel' => 'North America',
                'amount' => $high_volume ? 450.00 : 300.00,
                'label' => 'North America uniform shipping · ' . ($high_volume ? '50+' : 'under 50') . ' units',
            ];
        }
        if (in_array($country, self::CARIBBEAN_COUNTRIES, true)) {
            return [
                'zone' => 'caribbean',
                'zoneLabel' => 'Caribbean',
                'amount' => $high_volume ? 800.00 : 600.00,
                'label' => 'Caribbean uniform shipping · ' . ($high_volume ? '50+' : 'under 50') . ' units',
            ];
        }

        return new WP_Error(
            'c767_uniform_shipping_zone_unavailable',
            'Custom Uniform Studio shipping is available only in North America and the Caribbean.',
            ['status' => 400]
        );
    }

    private static function uniform_product()
    {
        $product_id = absint(get_option('c767_uniform_checkout_product_id'));
        $product = $product_id ? wc_get_product($product_id) : null;
        if ($product) {
            return $product;
        }

        $product = new WC_Product_Simple();
        $product->set_name('Custom Team Uniform');
        $product->set_slug('connect767-custom-team-uniform');
        $product->set_status('private');
        $product->set_catalog_visibility('hidden');
        $product->set_regular_price((string) self::BASE_KIT_PRICE);
        $product->set_price((string) self::BASE_KIT_PRICE);
        $product->set_tax_status('taxable');
        $product->set_virtual(false);
        $product->set_manage_stock(false);
        $product->set_weight('0.35');
        $product_id = $product->save();
        if (!$product_id) {
            return new WP_Error('c767_uniform_product_failed', 'Could not prepare the uniform checkout item.', ['status' => 500]);
        }
        update_option('c767_uniform_checkout_product_id', $product_id, false);
        return $product;
    }

    private static function format_totals(WC_Order $order)
    {
        $shipping_items = $order->get_items('shipping');
        $shipping_item = $shipping_items ? reset($shipping_items) : null;
        $designer_fee = self::designer_fee_total($order);
        return [
            'subtotal' => round((float) $order->get_subtotal(), 2),
            'tax' => round((float) $order->get_total_tax(), 2),
            'shipping' => round((float) $order->get_shipping_total(), 2),
            'shippingLabel' => $shipping_item ? $shipping_item->get_method_title() : 'Shipping',
            'designerFee' => $designer_fee,
            'designerFeeLabel' => self::AI_DESIGNER_FEE_LABEL,
            'total' => round((float) $order->get_total(), 2),
            'currency' => $order->get_currency(),
        ];
    }

    private static function designer_fee_total(WC_Order $order)
    {
        $total = 0.00;
        foreach ($order->get_items('fee') as $fee_item) {
            if ($fee_item->get_name() === self::AI_DESIGNER_FEE_LABEL) {
                $total += (float) $fee_item->get_total();
            }
        }
        return round($total, 2);
    }
}
