<?php
/**
 * Real embedded Stripe checkout — collects payment directly inside the
 * React app via Stripe's own Payment Element (a secure, PCI-compliant
 * iframe Stripe controls; raw card numbers never touch this server or
 * the React app's own code), instead of redirecting to WooCommerce's
 * separate hosted checkout page. That redirect is still there as a
 * fallback (see class-woocommerce.php's checkout()) for anyone who hasn't
 * configured Stripe yet, or for other payment methods later — this is
 * the "don't leave the site to pay" path for card payments specifically.
 *
 * Uses wp_remote_post() to call Stripe's REST API directly rather than
 * requiring the Stripe PHP SDK (which needs Composer) — Stripe's API is
 * a plain REST API and this keeps the plugin a drop-in install with zero
 * build step, consistent with the rest of this codebase.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Stripe_Checkout
{
    const NAMESPACE_ = 'connect767/v1';
    const STRIPE_API = 'https://api.stripe.com/v1';

    /**
     * No longer gated behind WooCommerce being active at all — it used to
     * bail out of everything (routes, the Payment Settings admin page)
     * if WooCommerce wasn't active. That was fine while Stripe was only
     * ever used for the Shop cart, but /checkout/config and the
     * publishable/secret key settings are now also needed by the
     * Classified listing payment flow (C767_Stripe_Listing_Checkout),
     * which has nothing to do with WooCommerce. The WooCommerce-specific
     * order/cart routes below still check for it individually.
     */
    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('admin_menu', [__CLASS__, 'add_settings_page']);
        add_action('admin_post_c767_save_stripe_keys', [__CLASS__, 'save_settings']);
    }

    public static function register_routes()
    {
        // Needed by both the Shop checkout and the Classified listing
        // payment flow — always register it, WooCommerce or not.
        register_rest_route(self::NAMESPACE_, '/checkout/config', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'get_config'],
            'permission_callback' => '__return_true',
        ]);

        // These two create/confirm a WooCommerce order specifically —
        // only meaningful, and only registered, if WooCommerce is active.
        if (class_exists('WooCommerce')) {
            register_rest_route(self::NAMESPACE_, '/checkout/intent', [
                'methods' => 'POST',
                'callback' => [__CLASS__, 'create_intent'],
                'permission_callback' => '__return_true',
            ]);

            register_rest_route(self::NAMESPACE_, '/checkout/confirm', [
                'methods' => 'POST',
                'callback' => [__CLASS__, 'confirm_order'],
                'permission_callback' => '__return_true',
            ]);
        }
    }

    private static function secret_key()
    {
        return get_option('c767_stripe_secret_key', '');
    }

    private static function publishable_key()
    {
        return get_option('c767_stripe_publishable_key', '');
    }

    /**
     * Publishable keys are meant to be public — Stripe's own docs put
     * them directly in client-side JS — so exposing this via an
     * unauthenticated GET is correct, not a leak. The secret key never
     * appears in any REST response.
     */
    /**
     * Also reports PayPal's config here rather than a separate endpoint —
     * CheckoutPage.jsx needs both up front to decide which payment buttons
     * to show, and this is already the one config call it makes on load.
     * class-paypal-checkout.php's client ID is meant to be public, same as
     * Stripe's publishable key — PayPal's own JS SDK is loaded with it
     * directly in the page's HTML.
     */
    public static function get_config()
    {
        $key = self::publishable_key();
        return rest_ensure_response([
            'stripeEnabled' => (bool) $key,
            'stripePublishableKey' => $key,
            'paypalEnabled' => class_exists('C767_PayPal_Checkout') && C767_PayPal_Checkout::is_enabled(),
            'paypalClientId' => class_exists('C767_PayPal_Checkout') ? C767_PayPal_Checkout::public_client_id() : '',
        ]);
    }

    /**
     * Public rather than private — reused directly by
     * C767_Stripe_Listing_Checkout for the Classified listing payment flow,
     * so both payment surfaces (Shop cart, Classified listings) talk to
     * Stripe through the exact same request/error-handling code instead of
     * a second, potentially-drifting copy of it.
     */
    public static function stripe_request($endpoint, $args = [])
    {
        $secret = self::secret_key();
        if (!$secret) {
            return new WP_Error('c767_stripe_not_configured', 'Stripe isn\'t configured on this site yet.', ['status' => 400]);
        }

        $response = wp_remote_post(self::STRIPE_API . $endpoint, [
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($secret . ':'),
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
            'body' => $args,
            'timeout' => 20,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 400) {
            return new WP_Error('c767_stripe_error', $body['error']['message'] ?? 'Stripe request failed.', ['status' => $code]);
        }
        return $body;
    }

    /** Public for the same reason as stripe_request() above. */
    public static function stripe_get($endpoint)
    {
        $secret = self::secret_key();
        if (!$secret) {
            return new WP_Error('c767_stripe_not_configured', 'Stripe isn\'t configured on this site yet.', ['status' => 400]);
        }
        $response = wp_remote_get(self::STRIPE_API . $endpoint, [
            'headers' => ['Authorization' => 'Basic ' . base64_encode($secret . ':')],
            'timeout' => 20,
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $body = json_decode(wp_remote_retrieve_body($response), true);
        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 400) {
            return new WP_Error('c767_stripe_error', $body['error']['message'] ?? 'Stripe request failed.', ['status' => $code]);
        }
        return $body;
    }

    /**
     * Creates a real, pending WooCommerce order from the cart (same items
     * shape/logic as the existing checkout() in class-woocommerce.php) and
     * a matching Stripe PaymentIntent for the exact order total — the
     * order and the payment are tied together via the PaymentIntent ID
     * stored on the order, checked again server-side in confirm_order()
     * rather than ever trusting the browser's word that payment succeeded.
     */
    public static function create_intent(WP_REST_Request $request)
    {
        $items = (array) $request->get_param('items');
        if (empty($items)) {
            return new WP_Error('c767_empty_cart', 'Cart is empty.', ['status' => 400]);
        }

        $order = wc_create_order();
        if (is_wp_error($order)) {
            return new WP_Error('c767_order_failed', $order->get_error_message(), ['status' => 400]);
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
            $product_id = self::product_id_from_slug($slug);
            $product = $product_id ? wc_get_product($product_id) : null;
            if ($product && $product->is_purchasable()) {
                $order->add_product($product, $qty);
            }
        }

        if (count($order->get_items()) === 0) {
            $order->delete(true);
            return new WP_Error('c767_no_valid_items', 'None of the cart items matched a real product.', ['status' => 400]);
        }

        $email = sanitize_email((string) $request->get_param('email'));
        if ($email) {
            $order->set_billing_email($email);
        }

        $order->calculate_totals();
        $order->set_status('pending');
        $order->save();

        $amount_cents = (int) round($order->get_total() * 100);
        $intent = self::stripe_request('/payment_intents', [
            'amount' => $amount_cents,
            'currency' => strtolower(get_woocommerce_currency()),
            'metadata' => ['order_id' => $order->get_id()],
            'receipt_email' => $email ?: null,
            // Explicitly card-only. Without this, Stripe falls back to
            // automatic_payment_methods using whatever's enabled in the
            // Dashboard (Link, Cash App Pay, Amazon Pay, etc.) — several of
            // those are redirect-based and Stripe then requires a
            // `return_url` on confirmPayment(), which StripePaymentForm in
            // CheckoutPage.jsx never passed (redirect: "if_required" alone
            // isn't enough), causing "You must provide a `return_url`..."
            // the moment a customer picked one of those extra methods. The
            // product decision was Stripe (card) + PayPal only, so those
            // wallets shouldn't have been offered in the Payment Element at
            // all — this removes them at the source instead of adding a
            // return_url to support methods we don't actually want.
            'payment_method_types' => ['card'],
        ]);

        if (is_wp_error($intent)) {
            $order->delete(true);
            return $intent;
        }

        $order->update_meta_data('_c767_stripe_payment_intent', $intent['id']);
        $order->save();

        return rest_ensure_response([
            'orderId' => $order->get_id(),
            'clientSecret' => $intent['client_secret'],
        ]);
    }

    /**
     * Confirms payment actually succeeded by asking Stripe directly,
     * server-side — never trusts the frontend's own claim that
     * `stripe.confirmPayment()` succeeded, since that call happens in the
     * browser and could be spoofed or simply wrong. Only marks the order
     * paid once Stripe itself reports the PaymentIntent status as
     * `succeeded`.
     */
    public static function confirm_order(WP_REST_Request $request)
    {
        $order_id = (int) $request->get_param('orderId');
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_Error('c767_order_not_found', 'Order not found.', ['status' => 404]);
        }

        $intent_id = $order->get_meta('_c767_stripe_payment_intent');
        if (!$intent_id) {
            return new WP_Error('c767_no_payment_intent', 'This order has no associated payment.', ['status' => 400]);
        }

        $intent = self::stripe_get('/payment_intents/' . $intent_id);
        if (is_wp_error($intent)) {
            return $intent;
        }

        if ($intent['status'] === 'succeeded') {
            $order->payment_complete($intent_id);
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order_id]);
        }

        return rest_ensure_response(['status' => $intent['status'], 'orderId' => $order_id]);
    }

    private static function product_id_from_slug($slug)
    {
        $post = get_page_by_path($slug, OBJECT, 'product');
        return $post ? $post->ID : 0;
    }

    // ---------- Admin settings ----------

    public static function add_settings_page()
    {
        add_submenu_page(
            'connect767-cms',
            'Payment Settings',
            'Payment Settings',
            'manage_options',
            'connect767-payments',
            [__CLASS__, 'render_settings_page']
        );
    }

    public static function save_settings()
    {
        if (!current_user_can('manage_options') || !check_admin_referer('c767_save_stripe_keys')) {
            wp_die('Not allowed.');
        }
        update_option('c767_stripe_publishable_key', sanitize_text_field((string) ($_POST['publishable_key'] ?? '')));
        update_option('c767_stripe_secret_key', sanitize_text_field((string) ($_POST['secret_key'] ?? '')));
        update_option('c767_paypal_client_id', sanitize_text_field((string) ($_POST['paypal_client_id'] ?? '')));
        update_option('c767_paypal_secret', sanitize_text_field((string) ($_POST['paypal_secret'] ?? '')));
        update_option('c767_paypal_sandbox', isset($_POST['paypal_sandbox']) ? '1' : '0');
        wp_safe_redirect(add_query_arg(['page' => 'connect767-payments', 'saved' => '1'], admin_url('admin.php')));
        exit;
    }

    public static function render_settings_page()
    {
        $publishable = self::publishable_key();
        $secret = self::secret_key();
        $paypal_client_id = get_option('c767_paypal_client_id', '');
        $paypal_secret = get_option('c767_paypal_secret', '');
        $paypal_sandbox = get_option('c767_paypal_sandbox', '1') === '1';
        ?>
        <div class="wrap">
            <h1>Payment Settings</h1>
            <?php if (isset($_GET['saved'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Saved.</p></div>
            <?php endif; ?>
            <p class="description">
                Checkout offers exactly two ways to pay once configured: Stripe (card, embedded
                directly on this site) and PayPal (PayPal's own button, embedded the same way).
                There's no other fallback — WooCommerce's hosted checkout page is no longer used
                for shoppers going through the React site.
            </p>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="c767_save_stripe_keys" />
                <?php wp_nonce_field('c767_save_stripe_keys'); ?>

                <h2>Stripe (card payments)</h2>
                <p class="description">
                    Real API keys from your Stripe dashboard (Developers → API keys). Test mode
                    keys (starting <code>pk_test_</code>/<code>sk_test_</code>) work the same way
                    while you're setting this up — switch to live keys when you're ready to
                    accept real payments.
                </p>
                <table class="form-table">
                    <tr>
                        <th><label for="publishable_key">Publishable key</label></th>
                        <td>
                            <input type="text" id="publishable_key" name="publishable_key"
                                value="<?php echo esc_attr($publishable); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th><label for="secret_key">Secret key</label></th>
                        <td>
                            <input type="password" id="secret_key" name="secret_key"
                                value="<?php echo esc_attr($secret); ?>" class="regular-text" />
                            <p class="description">Never exposed to the frontend — only used server-side.</p>
                        </td>
                    </tr>
                </table>

                <h2>PayPal</h2>
                <p class="description">
                    Real API credentials from your PayPal Developer Dashboard
                    (developer.paypal.com → Apps &amp; Credentials). Sandbox credentials work the
                    same way while testing — switch to a live app's credentials and turn off
                    Sandbox mode when you're ready to accept real payments.
                </p>
                <table class="form-table">
                    <tr>
                        <th><label for="paypal_client_id">Client ID</label></th>
                        <td>
                            <input type="text" id="paypal_client_id" name="paypal_client_id"
                                value="<?php echo esc_attr($paypal_client_id); ?>" class="regular-text" />
                            <p class="description">Public — sent to the browser to load PayPal's own button, same as Stripe's publishable key.</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="paypal_secret">Secret</label></th>
                        <td>
                            <input type="password" id="paypal_secret" name="paypal_secret"
                                value="<?php echo esc_attr($paypal_secret); ?>" class="regular-text" />
                            <p class="description">Never exposed to the frontend — only used server-side.</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="paypal_sandbox">Sandbox mode</label></th>
                        <td>
                            <label>
                                <input type="checkbox" id="paypal_sandbox" name="paypal_sandbox" value="1"
                                    <?php checked($paypal_sandbox); ?> />
                                Use PayPal's sandbox (testing) environment
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save'); ?>
            </form>
        </div>
        <?php
    }
}
