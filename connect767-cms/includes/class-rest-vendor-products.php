<?php
/**
 * Marketplace: lets a Classified-tier listing owner list sellable
 * products/services from their dashboard, shown as "Buy" cards on their
 * public listing profile. "Platform collects" model per the product
 * decision this was built to — payment goes through this site's own
 * Stripe account (C767_Stripe_Checkout::stripe_request()/stripe_get(),
 * the same helpers the Shop and Classified-listing-fee checkouts already
 * use), not a separate Stripe Connect account per vendor. The site owner
 * is responsible for paying vendors out themselves, outside the app;
 * `vendor_order` exists purely so both the vendor (their dashboard) and
 * the site admin (wp-admin) can see what sold for that bookkeeping.
 *
 * Requires class-stripe-checkout.php to be loaded first (reuses its
 * public stripe_request()/stripe_get() static methods) — see
 * connect767-cms.php's require order.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Rest_Vendor_Products
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/listings/(?P<slug>[a-zA-Z0-9-_]+)/products', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'list_for_listing'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products/mine', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'mine'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products/(?P<id>\d+)', [
            'methods' => ['POST', 'DELETE'],
            'callback' => [__CLASS__, 'update_or_delete'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products/(?P<id>\d+)/checkout', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-orders/(?P<id>\d+)/confirm', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'confirm_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products/(?P<id>\d+)/paypal-order', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_paypal_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-orders/(?P<id>\d+)/paypal-capture', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'confirm_paypal_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-orders/mine', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'orders_mine'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
    }

    private static function format_product($post)
    {
        return [
            'id' => $post->ID,
            'listingId' => (int) get_post_meta($post->ID, 'listing_id', true),
            'name' => $post->post_title,
            'description' => get_post_meta($post->ID, 'description', true),
            'priceCents' => (int) get_post_meta($post->ID, 'price_cents', true),
            'imageUrl' => get_post_meta($post->ID, 'image_url', true),
            'active' => get_post_meta($post->ID, 'active', true) === '1',
        ];
    }

    /** Public — the "Buy" cards on a listing profile only ever show active items. */
    public static function list_for_listing(WP_REST_Request $request)
    {
        $slug = sanitize_title((string) $request->get_param('slug'));
        $listing = get_page_by_path($slug, OBJECT, 'listing');
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }

        $products = get_posts([
            'post_type' => 'vendor_product',
            'post_status' => 'publish',
            'numberposts' => -1,
            'meta_query' => [
                ['key' => 'listing_id', 'value' => $listing->ID],
                ['key' => 'active', 'value' => '1'],
            ],
        ]);

        return rest_ensure_response(array_map([__CLASS__, 'format_product'], $products));
    }

    /** Owner's dashboard — every product across every listing they own, active or not. */
    public static function mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_ids = self::owned_listing_ids($user->ID);
        if (empty($listing_ids)) {
            return rest_ensure_response([]);
        }

        $products = get_posts([
            'post_type' => 'vendor_product',
            'post_status' => 'publish',
            'numberposts' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => [
                ['key' => 'listing_id', 'value' => $listing_ids, 'compare' => 'IN'],
            ],
        ]);

        return rest_ensure_response(array_map([__CLASS__, 'format_product'], $products));
    }

    private static function owned_listing_ids($user_id)
    {
        return get_posts([
            'post_type' => 'listing',
            'post_status' => 'any',
            'author' => $user_id,
            'numberposts' => -1,
            'fields' => 'ids',
        ]);
    }

    /**
     * Gated to Classified tier — this is the paid tier's marketplace perk.
     * A Free listing owner can't add products until they upgrade, same
     * spirit as Classified being the only tier with the $40/yr Stripe
     * payment step in AddListingPage.jsx.
     */
    private static function require_owned_classified_listing($listing_id, $user_id)
    {
        $post = get_post($listing_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user_id) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
        }
        if (get_post_meta($post->ID, 'tier', true) !== 'Classified') {
            return new WP_Error('c767_not_classified', 'Only Classified listings can sell products.', ['status' => 400]);
        }
        return $post;
    }

    public static function create(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_id = (int) $request->get_param('listingId');
        $listing = self::require_owned_classified_listing($listing_id, $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }

        $name = sanitize_text_field((string) $request->get_param('name'));
        $price_cents = max(0, (int) $request->get_param('priceCents'));
        if ($name === '' || $price_cents <= 0) {
            return new WP_Error('c767_invalid_product', 'A name and a price above $0 are required.', ['status' => 400]);
        }

        $product_id = wp_insert_post([
            'post_type' => 'vendor_product',
            'post_status' => 'publish',
            'post_title' => $name,
        ], true);
        if (is_wp_error($product_id)) {
            return new WP_Error('c767_product_failed', $product_id->get_error_message(), ['status' => 400]);
        }

        update_post_meta($product_id, 'listing_id', $listing_id);
        update_post_meta($product_id, 'description', sanitize_textarea_field((string) $request->get_param('description')));
        update_post_meta($product_id, 'price_cents', $price_cents);
        update_post_meta($product_id, 'image_url', esc_url_raw((string) $request->get_param('imageUrl')));
        update_post_meta($product_id, 'active', '1');

        self::handle_image_upload($product_id);

        return rest_ensure_response(self::format_product(get_post($product_id)));
    }

    /**
     * Real file upload into the Media Library for a product photo — mirrors
     * class-rest-listings.php::handle_uploads()'s logo/coverPhoto handling.
     * Sent as a single `image` field on a multipart FormData request; when
     * present it overrides whatever `imageUrl` string param came along with
     * it (the frontend only sends one or the other, never both on purpose,
     * but a real upload should always win if somehow both showed up).
     */
    private static function handle_image_upload($product_id)
    {
        if (empty($_FILES['image']['tmp_name'])) {
            return;
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $attachment_id = media_handle_upload('image', $product_id);
        if (!is_wp_error($attachment_id)) {
            update_post_meta($product_id, 'image_url', wp_get_attachment_url($attachment_id));
        }
    }

    private static function owned_product($product_id, $user_id)
    {
        $post = get_post($product_id);
        if (!$post || $post->post_type !== 'vendor_product') {
            return new WP_Error('c767_product_not_found', 'Product not found.', ['status' => 404]);
        }
        $listing_id = (int) get_post_meta($post->ID, 'listing_id', true);
        $listing = get_post($listing_id);
        if (!$listing || (int) $listing->post_author !== (int) $user_id) {
            return new WP_Error('c767_not_owner', 'This product isn’t on one of your listings.', ['status' => 403]);
        }
        return $post;
    }

    public static function update_or_delete(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $product_id = (int) $request->get_param('id');
        $product = self::owned_product($product_id, $user->ID);
        if (is_wp_error($product)) {
            return $product;
        }

        if ($request->get_method() === 'DELETE') {
            wp_delete_post($product_id, true);
            return rest_ensure_response(['id' => $product_id, 'deleted' => true]);
        }

        if ($request->get_param('name') !== null) {
            $name = sanitize_text_field((string) $request->get_param('name'));
            if ($name !== '') {
                wp_update_post(['ID' => $product_id, 'post_title' => $name]);
            }
        }
        if ($request->get_param('description') !== null) {
            update_post_meta($product_id, 'description', sanitize_textarea_field((string) $request->get_param('description')));
        }
        if ($request->get_param('priceCents') !== null) {
            $price_cents = max(0, (int) $request->get_param('priceCents'));
            if ($price_cents > 0) {
                update_post_meta($product_id, 'price_cents', $price_cents);
            }
        }
        if ($request->get_param('imageUrl') !== null) {
            update_post_meta($product_id, 'image_url', esc_url_raw((string) $request->get_param('imageUrl')));
        }
        if ($request->get_param('active') !== null) {
            $active = filter_var($request->get_param('active'), FILTER_VALIDATE_BOOLEAN);
            update_post_meta($product_id, 'active', $active ? '1' : '0');
        }

        self::handle_image_upload($product_id);

        return rest_ensure_response(self::format_product(get_post($product_id)));
    }

    /**
     * Public — creates a real Stripe PaymentIntent for exactly this
     * product's price, same PaymentIntent + confirm-server-side-only
     * pattern as C767_Stripe_Listing_Checkout. Payment lands in this
     * site's own Stripe account (see class doc comment above).
     */
    public static function create_checkout(WP_REST_Request $request)
    {
        $product_id = (int) $request->get_param('id');
        $product = get_post($product_id);
        if (!$product || $product->post_type !== 'vendor_product' || get_post_meta($product_id, 'active', true) !== '1') {
            return new WP_Error('c767_product_not_found', 'Product not found or no longer available.', ['status' => 404]);
        }

        $price_cents = (int) get_post_meta($product_id, 'price_cents', true);
        $listing_id = (int) get_post_meta($product_id, 'listing_id', true);
        $buyer_email = sanitize_email((string) $request->get_param('email'));
        $buyer_name = sanitize_text_field((string) $request->get_param('name'));

        $intent = C767_Stripe_Checkout::stripe_request('/payment_intents', [
            'amount' => $price_cents,
            'currency' => 'usd',
            'metadata' => ['vendor_product_id' => $product_id, 'listing_id' => $listing_id],
            'receipt_email' => $buyer_email ?: null,
            // Card-only — see the matching comment in
            // class-stripe-checkout.php::create_intent() for why this is
            // required to avoid the "must provide a return_url" error.
            'payment_method_types' => ['card'],
        ]);
        if (is_wp_error($intent)) {
            return $intent;
        }

        $order_id = wp_insert_post([
            'post_type' => 'vendor_order',
            'post_status' => 'publish',
            'post_title' => sprintf('Order — %s', $product->post_title),
        ], true);
        if (is_wp_error($order_id)) {
            return new WP_Error('c767_order_failed', $order_id->get_error_message(), ['status' => 400]);
        }

        $meta = [
            'product_id' => $product_id,
            'listing_id' => $listing_id,
            'buyer_name' => $buyer_name,
            'buyer_email' => $buyer_email,
            'amount_cents' => $price_cents,
            'stripe_payment_intent' => $intent['id'],
            'status' => 'pending',
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($order_id, $key, $value);
        }

        return rest_ensure_response([
            'orderId' => $order_id,
            'clientSecret' => $intent['client_secret'],
        ]);
    }

    /** Never trusts the browser's word — asks Stripe directly, same as confirm_order()/confirm_payment() elsewhere. */
    public static function confirm_checkout(WP_REST_Request $request)
    {
        $order_id = (int) $request->get_param('id');
        $order = get_post($order_id);
        if (!$order || $order->post_type !== 'vendor_order') {
            return new WP_Error('c767_order_not_found', 'Order not found.', ['status' => 404]);
        }

        $intent_id = get_post_meta($order_id, 'stripe_payment_intent', true);
        if (!$intent_id) {
            return new WP_Error('c767_no_payment_intent', 'This order has no associated payment.', ['status' => 400]);
        }

        $intent = C767_Stripe_Checkout::stripe_get('/payment_intents/' . $intent_id);
        if (is_wp_error($intent)) {
            return $intent;
        }

        if ($intent['status'] === 'succeeded') {
            update_post_meta($order_id, 'status', 'paid');
            do_action('c767_vendor_order_paid', $order_id);
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order_id]);
        }

        return rest_ensure_response(['status' => $intent['status'], 'orderId' => $order_id]);
    }

    /**
     * PayPal's counterpart to create_checkout() — same public/no-auth
     * access (any buyer, not the vendor), same real vendor_order created
     * up front so the charged amount always comes from price_cents on the
     * server, never a client-supplied number. Requires
     * class-paypal-checkout.php to be loaded first — see
     * connect767-cms.php's require order.
     */
    public static function create_paypal_checkout(WP_REST_Request $request)
    {
        $product_id = (int) $request->get_param('id');
        $product = get_post($product_id);
        if (!$product || $product->post_type !== 'vendor_product' || get_post_meta($product_id, 'active', true) !== '1') {
            return new WP_Error('c767_product_not_found', 'Product not found or no longer available.', ['status' => 404]);
        }

        $price_cents = (int) get_post_meta($product_id, 'price_cents', true);
        $listing_id = (int) get_post_meta($product_id, 'listing_id', true);
        $buyer_email = sanitize_email((string) $request->get_param('email'));
        $buyer_name = sanitize_text_field((string) $request->get_param('name'));

        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $paypal_order = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders', $token, [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) $product_id,
                'amount' => [
                    'currency_code' => 'USD',
                    'value' => number_format($price_cents / 100, 2, '.', ''),
                ],
            ]],
        ]);
        if (is_wp_error($paypal_order)) {
            return $paypal_order;
        }

        $order_id = wp_insert_post([
            'post_type' => 'vendor_order',
            'post_status' => 'publish',
            'post_title' => sprintf('Order — %s', $product->post_title),
        ], true);
        if (is_wp_error($order_id)) {
            return new WP_Error('c767_order_failed', $order_id->get_error_message(), ['status' => 400]);
        }

        $meta = [
            'product_id' => $product_id,
            'listing_id' => $listing_id,
            'buyer_name' => $buyer_name,
            'buyer_email' => $buyer_email,
            'amount_cents' => $price_cents,
            'paypal_order_id' => $paypal_order['id'],
            'status' => 'pending',
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($order_id, $key, $value);
        }

        return rest_ensure_response([
            'orderId' => $order_id,
            'paypalOrderId' => $paypal_order['id'],
        ]);
    }

    /** Never trusts the browser's word — asks PayPal directly, same rule as confirm_checkout() above. */
    public static function confirm_paypal_checkout(WP_REST_Request $request)
    {
        $order_id = (int) $request->get_param('id');
        $order = get_post($order_id);
        if (!$order || $order->post_type !== 'vendor_order') {
            return new WP_Error('c767_order_not_found', 'Order not found.', ['status' => 404]);
        }

        $paypal_order_id = get_post_meta($order_id, 'paypal_order_id', true);
        if (!$paypal_order_id) {
            return new WP_Error('c767_no_paypal_order', 'This order has no associated PayPal order.', ['status' => 400]);
        }

        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $capture = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders/' . $paypal_order_id . '/capture', $token);
        if (is_wp_error($capture)) {
            return $capture;
        }

        if (($capture['status'] ?? '') === 'COMPLETED') {
            update_post_meta($order_id, 'status', 'paid');
            do_action('c767_vendor_order_paid', $order_id);
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order_id]);
        }

        return rest_ensure_response(['status' => strtolower($capture['status'] ?? 'unknown'), 'orderId' => $order_id]);
    }

    /** Sales across every listing the current user owns — for manual payout bookkeeping. */
    public static function orders_mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_ids = self::owned_listing_ids($user->ID);
        if (empty($listing_ids)) {
            return rest_ensure_response([]);
        }

        $orders = get_posts([
            'post_type' => 'vendor_order',
            'post_status' => 'publish',
            'numberposts' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => [
                ['key' => 'listing_id', 'value' => $listing_ids, 'compare' => 'IN'],
                ['key' => 'status', 'value' => 'paid'],
            ],
        ]);

        $results = array_map(function ($post) {
            $product_id = (int) get_post_meta($post->ID, 'product_id', true);
            $product = get_post($product_id);
            return [
                'id' => $post->ID,
                'productName' => $product ? $product->post_title : '',
                'buyerName' => get_post_meta($post->ID, 'buyer_name', true),
                'buyerEmail' => get_post_meta($post->ID, 'buyer_email', true),
                'amountCents' => (int) get_post_meta($post->ID, 'amount_cents', true),
                'submittedAt' => $post->post_date,
            ];
        }, $orders);

        return rest_ensure_response($results);
    }
}
