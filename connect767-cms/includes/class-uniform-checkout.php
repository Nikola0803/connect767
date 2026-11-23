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
    const CUSTOM_ORDER_TERMS_VERSION = '2026-11-21';
    const BASE_KIT_PRICE = 35.00;
    const EXTRA_TEAM_SHIRT_PRICE = 15.00;
    const AI_DESIGNER_FEE = 50.00;
    const AI_DESIGNER_FEE_THRESHOLD = 1500.00;
    const AI_DESIGNER_FEE_LABEL = 'Connect767 Design Fee';
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
        $address_check = self::validate_north_american_address($shipping);
        if (is_wp_error($address_check)) {
            return $address_check;
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
        // Quotes stay available before consent. Creating any payable or local
        // uniform order requires explicit acceptance of the current policy.
        if (!$temporary && (
            ($payload['customOrderTermsAccepted'] ?? false) !== true
            || ($payload['customOrderTermsVersion'] ?? '') !== self::CUSTOM_ORDER_TERMS_VERSION
        )) {
            return new WP_Error('c767_uniform_terms_required', 'Agree to the custom-order terms before placing or paying for this order.', ['status' => 400]);
        }
        $email = sanitize_email((string) $request->get_param('email'));
        if (!is_email($email)) {
            return new WP_Error('c767_invalid_email', 'A valid email address is required.', ['status' => 400]);
        }

        $shipping = C767_WooCommerce::sanitize_shipping_address((array) $request->get_param('shipping'));
        if (is_wp_error($shipping)) {
            return $shipping;
        }

        $address_check = self::validate_north_american_address($shipping);
        if (is_wp_error($address_check)) {
            return $address_check;
        }

        $raw_designs = !empty($payload['designs']) && is_array($payload['designs']) ? array_values($payload['designs']) : [$payload];
        if (count($raw_designs) > 10) {
            return new WP_Error('c767_too_many_designs', 'A single order can contain up to 10 uniform designs.', ['status' => 400]);
        }
        $designs = [];
        foreach ($raw_designs as $index => $raw_design) {
            $prepared = self::prepare_design_payload((array) $raw_design, $index);
            if (is_wp_error($prepared)) return $prepared;
            $designs[] = $prepared;
        }

        $product = self::uniform_product();
        if (is_wp_error($product)) {
            return $product;
        }

        $order = wc_create_order(['status' => $temporary ? 'checkout-draft' : 'pending']);
        if (is_wp_error($order)) {
            return new WP_Error('c767_uniform_order_failed', $order->get_error_message(), ['status' => 400]);
        }

        if (!$temporary) {
            $project_check = C767_Design_Studio_Security::attach_order_project($order, $request, $payload);
            if (is_wp_error($project_check)) {
                $order->delete(true);
                return $project_check;
            }
        }

        $unit_count = 0;
        $supporter_count = 0;
        $shipping_units = 0;
        foreach ($designs as $design_number => $design) {
            self::add_design_items($order, $product, $design, $design_number + 1, count($designs));
            $unit_count += $design['unit_count'];
            $supporter_count += $design['supporter_count'];
            $shipping_units += $design['unit_count'] + $design['extra_shirt_count'] + $design['supporter_count'];
        }

        $billing = $shipping;
        $billing['email'] = $email;
        $order->set_address($billing, 'billing');
        $order->set_address($shipping, 'shipping');
        $order->calculate_totals(false);

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
        if (!$temporary) {
            $order->update_meta_data('_c767_uniform_terms_version', self::CUSTOM_ORDER_TERMS_VERSION);
            $order->update_meta_data('_c767_uniform_terms_accepted_at', current_time('mysql', true));
            $order->update_meta_data('Custom uniform terms', 'Accepted: made-to-order uniforms are non-refundable.');
        }
        $order->update_meta_data('_c767_uniform_design_count', count($designs));
        $order->update_meta_data('_c767_uniform_unit_count', $unit_count);
        $order->update_meta_data('_c767_uniform_unit_price', $designs[0]['unit_price']);
        $order->update_meta_data('_c767_uniform_supporter_count', $supporter_count);
        $order->update_meta_data('_c767_uniform_shipping_zone', $shipping_rate['zone']);
        $order->update_meta_data('_c767_uniform_shipping_units', $shipping_units);

        $stored_designs = [];
        foreach ($designs as $index => $design) {
            $design_payload = $design['payload'];
            $design_payload['kitType'] = 'Full';
            $design_payload['extraTeamShirts'] = $design['extra_team_shirts'];
            $design_payload['insideCollarAttachment'] = $design['collar_attachment'] ? array_diff_key($design['collar_attachment'], ['src' => true]) : null;
            unset($design_payload['previewImage'], $design_payload['designs']);
            $stored_designs[] = $design_payload;
            if ($design['collar_attachment']) {
                $order->update_meta_data('_c767_uniform_collar_attachment_' . ($index + 1), $design['collar_attachment']);
            }
            $preview = (string) ($design['payload']['previewImage'] ?? '');
            if (strpos($preview, 'data:image/') === 0 && strlen($preview) <= 5242880) {
                $order->update_meta_data('_c767_uniform_preview_' . ($index + 1), $preview);
                if ($index === 0) $order->update_meta_data('_c767_uniform_preview', $preview);
            }
        }
        $encoded = wp_json_encode($stored_designs);
        if ($encoded && strlen($encoded) <= 2097152) $order->update_meta_data('_c767_uniform_designs', $encoded);
        $legacy_encoded = wp_json_encode($stored_designs[0]);
        if ($legacy_encoded && strlen($legacy_encoded) <= 524288) $order->update_meta_data('_c767_uniform_design', $legacy_encoded);
        $order->save();
        return $order;
    }

    private static function prepare_design_payload(array $payload, $index)
    {
        if (sanitize_key((string) ($payload['sport'] ?? '')) === 'basketball') {
            if (($payload['collar'] ?? '') === 'Polo') $payload['collar'] = 'V-Neck';
            $payload['sleeve'] = 'Sleeveless';
        }
        $payload['aiPromptHistory'] = self::sanitize_prompt_history($payload['aiPromptHistory'] ?? []);
        $roster = (array) ($payload['roster'] ?? []);
        $unit_count = 0;
        foreach ($roster as $entry) {
            $entry = (array) $entry;
            if (sanitize_text_field((string) ($entry['name'] ?? '')) !== '') {
                $unit_count += max(1, min(99, absint($entry['quantity'] ?? 1)));
            }
        }
        if ($unit_count < 1) return new WP_Error('c767_empty_roster', 'Add at least one player to design ' . ($index + 1) . ' before checkout.', ['status' => 400]);
        $minimum_check = C767_REST_Uniform_Quotes::validate_full_kit_minimum($payload['sport'] ?? '', $unit_count);
        if (is_wp_error($minimum_check)) return $minimum_check;

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
        $extra_team_shirts = self::sanitize_supporter_jerseys($payload['extraTeamShirts'] ?? []);
        $extra_shirt_count = array_reduce($extra_team_shirts, function ($total, $row) { return $total + $row['quantity']; }, 0);
        $fan_added = rest_sanitize_boolean($payload['fanJerseyAdded'] ?? false);
        $supporter_jerseys = $fan_added ? self::sanitize_supporter_jerseys($payload['supporterJerseys'] ?? []) : [];
        if ($fan_added && empty($supporter_jerseys)) $supporter_jerseys[] = ['size' => 'AM', 'quantity' => 1];
        $supporter_count = array_reduce($supporter_jerseys, function ($total, $row) { return $total + $row['quantity']; }, 0);
        $collar_attachment = rest_sanitize_boolean($payload['insideCollarMessage'] ?? false)
            ? C767_REST_Uniform_Quotes::sanitize_collar_attachment($payload['insideCollarAttachment'] ?? null) : null;
        return [
            'payload' => $payload,
            'roster' => $roster,
            'unit_count' => $unit_count,
            'unit_price' => $unit_price,
            'long_sleeve_count' => $long_sleeve_count,
            'kits_total' => round($unit_price * $unit_count + $long_sleeve_count * 2.00, 2),
            'extra_team_shirts' => $extra_team_shirts,
            'extra_shirt_count' => $extra_shirt_count,
            'supporter_jerseys' => $supporter_jerseys,
            'supporter_count' => $supporter_count,
            'template' => sanitize_text_field((string) ($payload['template'] ?? 'Custom design')) ?: 'Custom design',
            'collar_attachment' => $collar_attachment,
        ];
    }

    private static function add_design_items(WC_Order $order, WC_Product $product, array $design, $number, $total_designs)
    {
        $payload = $design['payload'];
        $prefix = $total_designs > 1 ? 'Design ' . $number . ' — ' : '';
        $kit_item_id = $order->add_product($product, $design['unit_count'], ['subtotal' => $design['kits_total'], 'total' => $design['kits_total']]);
        $kit_item = $order->get_item($kit_item_id);
        if ($kit_item) {
            $kit_item->set_name($prefix . $design['template'] . ' team kit');
            $kit_item->add_meta_data('Sport category', sanitize_text_field((string) ($payload['sport'] ?? 'soccer')), true);
            $kit_item->add_meta_data('Base kit price', wc_price(self::category_base_price($payload['sport'] ?? 'soccer')), true);
            $kit_item->add_meta_data('Final unit price', wc_price($design['unit_price']), true);
            if (($payload['sleeve'] ?? '') === 'Long') $kit_item->add_meta_data('Long sleeves', $design['unit_count'] . ' × ' . wc_price(2.00), true);
            if ($design['long_sleeve_count'] > 0) $kit_item->add_meta_data('Long sleeve upgrades', $design['long_sleeve_count'] . ' × ' . wc_price(2.00), true);
            if (($payload['collar'] ?? '') === 'Polo') $kit_item->add_meta_data('Polo-style collars', $design['unit_count'] . ' × ' . wc_price(2.00), true);
            if (rest_sanitize_boolean($payload['insideCollarMessage'] ?? false)) $kit_item->add_meta_data('Inside-collar logo/message', $design['unit_count'] . ' × ' . wc_price(1.00), true);
            if (($payload['logoApplication'] ?? '') === 'Embroidery') $kit_item->add_meta_data('Embroidered team logo', $design['unit_count'] . ' × ' . wc_price(1.50), true);
            $kit_item->save();
        }
        if ($design['extra_shirt_count'] > 0) {
            $total = round(self::EXTRA_TEAM_SHIRT_PRICE * $design['extra_shirt_count'], 2);
            $item_id = $order->add_product($product, $design['extra_shirt_count'], ['subtotal' => $total, 'total' => $total]);
            $item = $order->get_item($item_id);
            if ($item) {
                $item->set_name($prefix . $design['template'] . ' extra team shirt');
                $item->add_meta_data('Unit price', wc_price(self::EXTRA_TEAM_SHIRT_PRICE), true);
                $item->add_meta_data('Sizes', implode(', ', array_map(function ($row) { return $row['size'] . ' × ' . $row['quantity']; }, $design['extra_team_shirts'])), true);
                $item->save();
            }
        }
        if ($design['supporter_count'] > 0) {
            $total = round(self::EXTRA_TEAM_SHIRT_PRICE * $design['supporter_count'], 2);
            $item_id = $order->add_product($product, $design['supporter_count'], ['subtotal' => $total, 'total' => $total]);
            $item = $order->get_item($item_id);
            if ($item) {
                $item->set_name($prefix . $design['template'] . ' supporter jersey');
                $item->add_meta_data('Unit price', wc_price(self::EXTRA_TEAM_SHIRT_PRICE), true);
                $item->add_meta_data('Sizes', implode(', ', array_map(function ($row) { return $row['size'] . ' × ' . $row['quantity']; }, $design['supporter_jerseys'])), true);
                $item->add_meta_data('Player numbers', 'None', true);
                $item->save();
            }
        }
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

    private static function sanitize_prompt_history($value)
    {
        $out = [];
        foreach (array_slice((array) $value, 0, 100) as $entry) {
            $row = (array) $entry;
            $response = $row['response'] ?? '';
            if (!is_string($response)) $response = wp_json_encode($response);
            $out[] = [
                'id' => sanitize_text_field((string) ($row['id'] ?? '')),
                'prompt' => sanitize_textarea_field((string) ($row['prompt'] ?? '')),
                'mode' => sanitize_key((string) ($row['mode'] ?? 'uniform')),
                'kind' => sanitize_text_field((string) ($row['kind'] ?? 'AI design')),
                'brandName' => sanitize_text_field((string) ($row['brandName'] ?? '')),
                'style' => sanitize_text_field((string) ($row['style'] ?? '')),
                'response' => sanitize_textarea_field((string) $response),
                'createdAt' => sanitize_text_field((string) ($row['createdAt'] ?? '')),
            ];
        }
        return $out;
    }

    private static function authoritative_unit_price(array $payload)
    {
        $price = self::category_base_price($payload['sport'] ?? 'soccer');
        $sleeve = sanitize_text_field((string) ($payload['sleeve'] ?? ''));
        $collar = sanitize_text_field((string) ($payload['collar'] ?? ''));
        $basketball = sanitize_key((string) ($payload['sport'] ?? '')) === 'basketball';
        if (!$basketball && $sleeve === 'Long') {
            $price += 2.00;
        }
        if (!$basketball && $collar === 'Polo') {
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

    private static function category_base_price($sport)
    {
        $prices = [
            'soccer' => 35.00,
            'basketball' => 30.00,
            'netball' => 30.00,
            'cricket' => 40.00,
            'goalkeeper' => 45.00,
            'other' => 30.00,
        ];
        $sport = sanitize_key((string) $sport);
        return $prices[$sport] ?? self::BASE_KIT_PRICE;
    }

    public static function uniform_shipping_rate($country, $unit_count)
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
            $amount = $unit_count > 50 ? 800.00 : ($unit_count >= 22 ? 600.00 : 450.00);
            $range = $unit_count > 50 ? 'more than 50 units' : ($unit_count >= 22 ? '22–50 units' : '10–21 units');
            return [
                'zone' => 'caribbean',
                'zoneLabel' => 'Caribbean',
                'amount' => $amount,
                'label' => 'Caribbean uniform shipping · ' . $range,
            ];
        }

        return new WP_Error(
            'c767_uniform_shipping_zone_unavailable',
            'Custom Uniform Studio shipping is available only in North America and the Caribbean.',
            ['status' => 400]
        );
    }

    public static function validate_north_american_address(array $address)
    {
        $country = strtoupper((string) ($address['country'] ?? ''));
        if (!in_array($country, self::NORTH_AMERICA_COUNTRIES, true)) {
            return true;
        }

        $has_two_letters = function ($value) {
            return preg_match_all('/\p{L}/u', (string) $value, $matches) >= 2;
        };
        if (!$has_two_letters($address['first_name'] ?? '')) {
            return new WP_Error('c767_invalid_shipping_first_name', 'Enter a valid recipient first name.', ['status' => 400]);
        }
        if (!$has_two_letters($address['last_name'] ?? '')) {
            return new WP_Error('c767_invalid_shipping_last_name', 'Enter a valid recipient last name.', ['status' => 400]);
        }

        $street = (string) ($address['address_1'] ?? '');
        $numbered_street = preg_match('/\d/', $street) && $has_two_letters($street);
        $po_box = preg_match('/\bP(?:OST)?\.?\s*O(?:FFICE)?\.?\s*BOX\s+\d+/i', $street);
        if (!$numbered_street && !$po_box) {
            return new WP_Error('c767_invalid_shipping_street', 'Enter a complete street address with a building number.', ['status' => 400]);
        }
        if (!$has_two_letters($address['city'] ?? '')) {
            return new WP_Error('c767_invalid_shipping_city', 'Enter a valid city.', ['status' => 400]);
        }

        $states = WC()->countries->get_states($country);
        $state = strtoupper((string) ($address['state'] ?? ''));
        if (!$state || !isset($states[$state])) {
            $region_name = $country === 'CA' ? 'Canadian province or territory' : ($country === 'MX' ? 'Mexican state' : 'U.S. state');
            return new WP_Error('c767_invalid_uniform_shipping_region', 'Choose a valid ' . $region_name . '.', ['status' => 400]);
        }

        $postcode = strtoupper(trim((string) ($address['postcode'] ?? '')));
        $valid_postcode = $country === 'US'
            ? preg_match('/^\d{5}(?:-\d{4})?$/', $postcode)
            : ($country === 'CA'
                ? preg_match('/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/', $postcode)
                : preg_match('/^\d{5}$/', $postcode));
        if (!$valid_postcode) {
            $message = $country === 'US'
                ? 'Enter a valid U.S. ZIP code.'
                : ($country === 'CA' ? 'Enter a valid Canadian postal code.' : 'Enter a valid 5-digit Mexican postal code.');
            return new WP_Error('c767_invalid_uniform_shipping_postcode', $message, ['status' => 400]);
        }

        return true;
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
