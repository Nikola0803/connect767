<?php
/**
 * Real embedded PayPal checkout — PayPal's own Smart Buttons, rendered
 * directly in the React checkout page (src/pages/CheckoutPage.jsx) via
 * PayPal's client-side JS SDK (loaded by script tag, no npm package
 * needed), next to the existing Stripe card option. Per an explicit
 * product decision, checkout should only ever offer Stripe and PayPal —
 * this replaces the old "redirect to WooCommerce's own hosted page" as
 * the fallback/alternative path, the same page that originally showed as
 * "basic WordPress instead of React" at the very start of this project.
 *
 * Server side talks to PayPal's REST API directly with wp_remote_*() —
 * same reasoning as class-stripe-checkout.php: it's a plain REST API, no
 * SDK/Composer dependency needed to stay a drop-in plugin install.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_PayPal_Checkout
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        if (!class_exists('WooCommerce')) {
            return;
        }

        register_rest_route(self::NAMESPACE_, '/checkout/paypal/order', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_order'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/checkout/paypal/capture', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'capture_order'],
            'permission_callback' => '__return_true',
        ]);
    }

    private static function client_id()
    {
        return get_option('c767_paypal_client_id', '');
    }

    private static function secret()
    {
        return get_option('c767_paypal_secret', '');
    }

    private static function is_sandbox()
    {
        return get_option('c767_paypal_sandbox', '1') === '1';
    }

    private static function api_base()
    {
        return self::is_sandbox() ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    }

    public static function is_enabled()
    {
        return (bool) (self::client_id() && self::secret());
    }

    public static function public_client_id()
    {
        return self::client_id();
    }

    /**
     * PayPal uses OAuth2 client-credentials rather than a static API key
     * per request like Stripe — this token is short-lived (a few hours)
     * so it's fetched fresh each time rather than cached, keeping this
     * class simple; checkout is not a high-enough-frequency path for that
     * extra request to matter.
     */
    /**
     * Public (not private) so other checkout flows — the Classified listing
     * fee (class-stripe-listing-checkout.php) and the vendor marketplace
     * (class-rest-vendor-products.php) — can reuse the same OAuth2 dance
     * instead of duplicating it. Mirrors how C767_Stripe_Checkout already
     * exposes stripe_request()/stripe_get() as public statics for the exact
     * same reason.
     */
    public static function access_token()
    {
        $client_id = self::client_id();
        $secret = self::secret();
        if (!$client_id || !$secret) {
            return new WP_Error('c767_paypal_not_configured', 'PayPal isn\'t configured on this site yet.', ['status' => 400]);
        }

        $response = wp_remote_post(self::api_base() . '/v1/oauth2/token', [
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($client_id . ':' . $secret),
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
            'body' => ['grant_type' => 'client_credentials'],
            'timeout' => 20,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $body = json_decode(wp_remote_retrieve_body($response), true);
        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 400 || empty($body['access_token'])) {
            return new WP_Error('c767_paypal_auth_failed', 'Could not authenticate with PayPal.', ['status' => 400]);
        }
        return $body['access_token'];
    }

    /** Public for the same reason as access_token() above. */
    public static function paypal_request($method, $endpoint, $token, $body = null)
    {
        $args = [
            'method' => $method,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
            ],
            'timeout' => 20,
        ];
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }
        $response = wp_remote_request(self::api_base() . $endpoint, $args);
        if (is_wp_error($response)) {
            return $response;
        }
        $decoded = json_decode(wp_remote_retrieve_body($response), true);
        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 400) {
            $message = $decoded['message'] ?? ($decoded['details'][0]['description'] ?? 'PayPal request failed.');
            return new WP_Error('c767_paypal_error', $message, ['status' => $code]);
        }
        return $decoded;
    }

    /**
     * Same cart -> WooCommerce order building as C767_Stripe_Checkout::create_intent()
     * and C767_WooCommerce::checkout() — a real `pending` WC order is created
     * first so PayPal's order amount always matches server-calculated totals,
     * never a client-supplied number.
     */
    private static function build_pending_order(array $items, $email)
    {
        $order = wc_create_order();
        if (is_wp_error($order)) {
            return $order;
        }

        foreach ($items as $item) {
            $variation_id = (int) ($item['variationId'] ?? 0);
            $qty = max(1, (int) ($item['qty'] ?? 1));

            if ($variation_id) {
                $variation = wc_get_product($variation_id);
                if ($variation && $variation->is_type('variation')) {
                    $order->add_product($variation, $qty);
                    continue;
                }
            }

            $slug = sanitize_title((string) ($item['slug'] ?? ''));
            $post = $slug ? get_page_by_path($slug, OBJECT, 'product') : null;
            $product = $post ? wc_get_product($post->ID) : null;
            if ($product && $product->is_purchasable()) {
                $order->add_product($product, $qty);
            }
        }

        if (count($order->get_items()) === 0) {
            $order->delete(true);
            return new WP_Error('c767_no_valid_items', 'None of the cart items matched a real product.', ['status' => 400]);
        }

        if ($email) {
            $order->set_billing_email(sanitize_email($email));
        }
        $order->calculate_totals();
        $order->set_status('pending');
        $order->save();

        return $order;
    }

    public static function create_order(WP_REST_Request $request)
    {
        $items = (array) $request->get_param('items');
        if (empty($items)) {
            return new WP_Error('c767_empty_cart', 'Cart is empty.', ['status' => 400]);
        }

        $order = self::build_pending_order($items, (string) $request->get_param('email'));
        if (is_wp_error($order)) {
            return $order;
        }

        $token = self::access_token();
        if (is_wp_error($token)) {
            $order->delete(true);
            return $token;
        }

        $paypal_order = self::paypal_request('POST', '/v2/checkout/orders', $token, [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) $order->get_id(),
                'amount' => [
                    'currency_code' => strtoupper(get_woocommerce_currency()),
                    'value' => number_format((float) $order->get_total(), 2, '.', ''),
                ],
            ]],
        ]);
        if (is_wp_error($paypal_order)) {
            $order->delete(true);
            return $paypal_order;
        }

        $order->update_meta_data('_c767_paypal_order_id', $paypal_order['id']);
        $order->save();

        return rest_ensure_response([
            'orderId' => $order->get_id(),
            'paypalOrderId' => $paypal_order['id'],
        ]);
    }

    /**
     * Captures the PayPal order and only then marks the WooCommerce order
     * paid — same "never trust the client, ask the payment processor
     * directly" rule as C767_Stripe_Checkout::confirm_order().
     */
    public static function capture_order(WP_REST_Request $request)
    {
        $order_id = (int) $request->get_param('orderId');
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_Error('c767_order_not_found', 'Order not found.', ['status' => 404]);
        }

        $paypal_order_id = $order->get_meta('_c767_paypal_order_id');
        if (!$paypal_order_id) {
            return new WP_Error('c767_no_paypal_order', 'This order has no associated PayPal order.', ['status' => 400]);
        }

        $token = self::access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $capture = self::paypal_request('POST', '/v2/checkout/orders/' . $paypal_order_id . '/capture', $token);
        if (is_wp_error($capture)) {
            return $capture;
        }

        if (($capture['status'] ?? '') === 'COMPLETED') {
            $order->payment_complete($paypal_order_id);
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order_id]);
        }

        return rest_ensure_response(['status' => strtolower($capture['status'] ?? 'unknown'), 'orderId' => $order_id]);
    }
}
