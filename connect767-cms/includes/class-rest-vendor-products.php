<?php
/**
 * Marketplace: lets any listing owner list sellable
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
    const PLATFORM_FEE_PERCENT = 10;

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

        register_rest_route(self::NAMESPACE_, '/listings/(?P<slug>[a-zA-Z0-9-_]+)/storefront-settings', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'public_storefront_settings'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-storefronts/(?P<id>\d+)', [
            'methods' => ['GET', 'POST'],
            'callback' => [__CLASS__, 'owner_storefront_settings'],
            'permission_callback' => [__CLASS__, 'check_auth'],
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
            'fulfillmentMode' => self::product_fulfillment_mode($post->ID),
            'shippingFeeCents' => (int) get_post_meta($post->ID, 'shipping_fee_cents', true),
            'pickupInstructions' => get_post_meta($post->ID, 'pickup_instructions', true),
        ];
    }

    /** Older products may be services; do not silently require a delivery address. */
    private static function product_fulfillment_mode($product_id)
    {
        $mode = (string) get_post_meta($product_id, 'fulfillment_mode', true);
        return in_array($mode, ['none', 'shipping', 'pickup', 'both'], true) ? $mode : 'none';
    }

    private static function sanitize_shipping_address($value)
    {
        $address = is_array($value) ? $value : [];
        return [
            'address1' => sanitize_text_field((string) ($address['address1'] ?? '')),
            'address2' => sanitize_text_field((string) ($address['address2'] ?? '')),
            'city' => sanitize_text_field((string) ($address['city'] ?? '')),
            'region' => sanitize_text_field((string) ($address['region'] ?? '')),
            'postcode' => sanitize_text_field((string) ($address['postcode'] ?? '')),
            'country' => sanitize_text_field((string) ($address['country'] ?? '')),
            'phone' => sanitize_text_field((string) ($address['phone'] ?? '')),
        ];
    }

    /** Resolve and validate fulfillment from server-owned product settings. */
    private static function checkout_fulfillment(WP_REST_Request $request, $product_id)
    {
        $mode = self::product_fulfillment_mode($product_id);
        $method = sanitize_key((string) $request->get_param('fulfillmentMethod'));
        if ($method === '') {
            $method = in_array($mode, ['pickup', 'none'], true) ? $mode : 'shipping';
        }
        $allowed = $mode === 'both' ? ['shipping', 'pickup'] : [$mode];
        if (!in_array($method, $allowed, true)) {
            return new WP_Error('c767_invalid_fulfillment', 'That fulfillment option is not available for this product.', ['status' => 400]);
        }

        $shipping = self::sanitize_shipping_address($request->get_param('shipping'));
        if ($method === 'shipping') {
            foreach (['address1', 'city', 'postcode', 'country'] as $required) {
                if ($shipping[$required] === '') {
                    return new WP_Error('c767_shipping_required', 'A complete delivery address is required.', ['status' => 400]);
                }
            }
        } else {
            $shipping = [];
        }

        return [
            'method' => $method,
            'shipping' => $shipping,
            'fee_cents' => $method === 'shipping'
                ? max(0, (int) get_post_meta($product_id, 'shipping_fee_cents', true))
                : 0,
        ];
    }

    /**
     * Connect767 retains 10% of the product price. Delivery charges are
     * passed through in full to the listing owner and are never included in
     * the platform commission.
     */
    private static function payment_breakdown($product_amount_cents, $shipping_fee_cents)
    {
        $product_amount_cents = max(0, (int) $product_amount_cents);
        $shipping_fee_cents = max(0, (int) $shipping_fee_cents);
        $platform_fee_amount_cents = (int) round(
            $product_amount_cents * self::PLATFORM_FEE_PERCENT / 100,
            0,
            PHP_ROUND_HALF_UP
        );
        $gross_amount_cents = $product_amount_cents + $shipping_fee_cents;

        return [
            'gross_amount_cents' => $gross_amount_cents,
            'platform_fee_percent' => self::PLATFORM_FEE_PERCENT,
            'platform_fee_amount_cents' => $platform_fee_amount_cents,
            'owner_payout_amount_cents' => max(0, $gross_amount_cents - $platform_fee_amount_cents),
        ];
    }

    private static function listing_payout_method($listing_id)
    {
        $method = (string) get_post_meta((int) $listing_id, '_booking_payout_method', true);
        return in_array($method, ['bank', 'digital'], true) ? $method : '';
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

    private static function storefront_settings($listing)
    {
        $featured = json_decode((string) get_post_meta($listing->ID, 'storefront_featured_product_ids', true), true);
        $order = json_decode((string) get_post_meta($listing->ID, 'storefront_product_order', true), true);
        $accent = sanitize_hex_color((string) get_post_meta($listing->ID, 'storefront_accent_color', true));
        $custom_cover = (string) get_post_meta($listing->ID, 'storefront_cover_url', true);
        return [
            'listingId' => (int) $listing->ID,
            'coverUrl' => (string) ($custom_cover ?: get_the_post_thumbnail_url($listing->ID, 'full')),
            'hasCustomCover' => $custom_cover !== '',
            'logoUrl' => (string) (get_post_meta($listing->ID, 'storefront_logo_url', true) ?: get_post_meta($listing->ID, 'logo', true)),
            'headline' => (string) (get_post_meta($listing->ID, 'storefront_headline', true) ?: 'Shop ' . $listing->post_title),
            'welcomeText' => (string) (get_post_meta($listing->ID, 'storefront_welcome_text', true) ?: 'A curated selection from this Connect767 business, available through secure checkout.'),
            'accentColor' => $accent ?: '#0f6b4f',
            'aboutText' => (string) get_post_meta($listing->ID, 'storefront_about_text', true),
            'shippingMessage' => (string) (get_post_meta($listing->ID, 'storefront_shipping_message', true) ?: 'Shipping and local pickup options are shown with each product.'),
            'policies' => (string) get_post_meta($listing->ID, 'storefront_policies', true),
            'featuredProductIds' => array_values(array_map('intval', is_array($featured) ? $featured : [])),
            'productOrder' => array_values(array_map('intval', is_array($order) ? $order : [])),
        ];
    }

    public static function public_storefront_settings(WP_REST_Request $request)
    {
        $listing = get_page_by_path(sanitize_title((string) $request->get_param('slug')), OBJECT, 'listing');
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        return rest_ensure_response(self::storefront_settings($listing));
    }

    public static function owner_storefront_settings(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $listing = self::require_owned_listing((int) $request->get_param('id'), $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }
        if ($request->get_method() === 'GET') {
            return rest_ensure_response(self::storefront_settings($listing));
        }

        $text_fields = [
            'headline' => 'storefront_headline',
            'welcomeText' => 'storefront_welcome_text',
            'aboutText' => 'storefront_about_text',
            'shippingMessage' => 'storefront_shipping_message',
            'policies' => 'storefront_policies',
        ];
        foreach ($text_fields as $param => $meta_key) {
            if ($request->get_param($param) !== null) {
                update_post_meta($listing->ID, $meta_key, sanitize_textarea_field((string) $request->get_param($param)));
            }
        }
        $accent = sanitize_hex_color((string) $request->get_param('accentColor'));
        if ($accent) {
            update_post_meta($listing->ID, 'storefront_accent_color', $accent);
        }

        $owned_product_ids = get_posts([
            'post_type' => 'vendor_product', 'post_status' => 'publish', 'numberposts' => -1,
            'fields' => 'ids', 'meta_query' => [['key' => 'listing_id', 'value' => $listing->ID]],
        ]);
        foreach (['featuredProductIds' => 'storefront_featured_product_ids', 'productOrder' => 'storefront_product_order'] as $param => $meta_key) {
            $decoded = json_decode((string) $request->get_param($param), true);
            $ids = array_values(array_intersect(array_map('intval', is_array($decoded) ? $decoded : []), array_map('intval', $owned_product_ids)));
            update_post_meta($listing->ID, $meta_key, wp_json_encode($ids));
        }

        self::handle_storefront_image($listing->ID, 'storefrontCover', 'storefront_cover_url');
        self::handle_storefront_image($listing->ID, 'storefrontLogo', 'storefront_logo_url');

        return rest_ensure_response(self::storefront_settings($listing));
    }

    private static function handle_storefront_image($listing_id, $field, $meta_key)
    {
        if (empty($_FILES[$field]['tmp_name'])) {
            return;
        }
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        $attachment_id = media_handle_upload($field, $listing_id);
        if (!is_wp_error($attachment_id)) {
            update_post_meta($listing_id, $meta_key, wp_get_attachment_url($attachment_id));
        }
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
     * Storefronts are available to every listing tier. Ownership is the
     * security boundary: a seller may only attach products to their own
     * directory profile.
     */
    private static function require_owned_listing($listing_id, $user_id)
    {
        $post = get_post($listing_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user_id) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
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
        $listing = self::require_owned_listing($listing_id, $user->ID);
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
        $fulfillment_mode = sanitize_key((string) $request->get_param('fulfillmentMode'));
        update_post_meta($product_id, 'fulfillment_mode', in_array($fulfillment_mode, ['none', 'shipping', 'pickup', 'both'], true) ? $fulfillment_mode : 'none');
        update_post_meta($product_id, 'shipping_fee_cents', max(0, (int) $request->get_param('shippingFeeCents')));
        update_post_meta($product_id, 'pickup_instructions', sanitize_textarea_field((string) $request->get_param('pickupInstructions')));

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
        if ($request->get_param('fulfillmentMode') !== null) {
            $fulfillment_mode = sanitize_key((string) $request->get_param('fulfillmentMode'));
            if (in_array($fulfillment_mode, ['none', 'shipping', 'pickup', 'both'], true)) {
                update_post_meta($product_id, 'fulfillment_mode', $fulfillment_mode);
            }
        }
        if ($request->get_param('shippingFeeCents') !== null) {
            update_post_meta($product_id, 'shipping_fee_cents', max(0, (int) $request->get_param('shippingFeeCents')));
        }
        if ($request->get_param('pickupInstructions') !== null) {
            update_post_meta($product_id, 'pickup_instructions', sanitize_textarea_field((string) $request->get_param('pickupInstructions')));
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
        $owner_payout_method = self::listing_payout_method($listing_id);
        if ($owner_payout_method === '') {
            return new WP_Error('c767_owner_payout_unavailable', 'This seller must add a payout method before accepting storefront payments.', ['status' => 409]);
        }
        $buyer_email = sanitize_email((string) $request->get_param('email'));
        $buyer_name = sanitize_text_field((string) $request->get_param('name'));
        $fulfillment = self::checkout_fulfillment($request, $product_id);
        if (is_wp_error($fulfillment)) {
            return $fulfillment;
        }
        $breakdown = self::payment_breakdown($price_cents, $fulfillment['fee_cents']);
        $total_cents = $breakdown['gross_amount_cents'];

        $intent = C767_Stripe_Checkout::stripe_request('/payment_intents', [
            'amount' => $total_cents,
            'currency' => 'usd',
            'metadata' => [
                'vendor_product_id' => $product_id,
                'listing_id' => $listing_id,
                'fulfillment_method' => $fulfillment['method'],
                'platform_fee_percent' => $breakdown['platform_fee_percent'],
                'platform_fee_amount_cents' => $breakdown['platform_fee_amount_cents'],
                'owner_payout_amount_cents' => $breakdown['owner_payout_amount_cents'],
            ],
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
            'amount_cents' => $total_cents,
            'product_amount_cents' => $price_cents,
            'shipping_fee_cents' => $fulfillment['fee_cents'],
            'platform_fee_percent' => $breakdown['platform_fee_percent'],
            'platform_fee_amount_cents' => $breakdown['platform_fee_amount_cents'],
            'owner_payout_amount_cents' => $breakdown['owner_payout_amount_cents'],
            'owner_payout_method' => $owner_payout_method,
            'owner_payout_status' => 'awaiting_payment',
            'fulfillment_method' => $fulfillment['method'],
            'shipping_address' => wp_json_encode($fulfillment['shipping']),
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
            $was_paid = get_post_meta($order_id, 'status', true) === 'paid';
            update_post_meta($order_id, 'status', 'paid');
            update_post_meta($order_id, 'owner_payout_status', 'pending');
            if (!$was_paid) {
                update_post_meta($order_id, 'paid_at', current_time('mysql', true));
                do_action('c767_vendor_order_paid', $order_id);
            }
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
        $owner_payout_method = self::listing_payout_method($listing_id);
        if ($owner_payout_method === '') {
            return new WP_Error('c767_owner_payout_unavailable', 'This seller must add a payout method before accepting storefront payments.', ['status' => 409]);
        }
        $buyer_email = sanitize_email((string) $request->get_param('email'));
        $buyer_name = sanitize_text_field((string) $request->get_param('name'));
        $fulfillment = self::checkout_fulfillment($request, $product_id);
        if (is_wp_error($fulfillment)) {
            return $fulfillment;
        }
        $breakdown = self::payment_breakdown($price_cents, $fulfillment['fee_cents']);
        $total_cents = $breakdown['gross_amount_cents'];

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
                    'value' => number_format($total_cents / 100, 2, '.', ''),
                ],
                'custom_id' => sprintf(
                    'listing:%d;product:%d;fee:%d',
                    $listing_id,
                    $product_id,
                    $breakdown['platform_fee_amount_cents']
                ),
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
            'amount_cents' => $total_cents,
            'product_amount_cents' => $price_cents,
            'shipping_fee_cents' => $fulfillment['fee_cents'],
            'platform_fee_percent' => $breakdown['platform_fee_percent'],
            'platform_fee_amount_cents' => $breakdown['platform_fee_amount_cents'],
            'owner_payout_amount_cents' => $breakdown['owner_payout_amount_cents'],
            'owner_payout_method' => $owner_payout_method,
            'owner_payout_status' => 'awaiting_payment',
            'fulfillment_method' => $fulfillment['method'],
            'shipping_address' => wp_json_encode($fulfillment['shipping']),
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
            $was_paid = get_post_meta($order_id, 'status', true) === 'paid';
            update_post_meta($order_id, 'status', 'paid');
            update_post_meta($order_id, 'owner_payout_status', 'pending');
            if (!$was_paid) {
                update_post_meta($order_id, 'paid_at', current_time('mysql', true));
                do_action('c767_vendor_order_paid', $order_id);
            }
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
                'productAmountCents' => (int) get_post_meta($post->ID, 'product_amount_cents', true),
                'shippingFeeCents' => (int) get_post_meta($post->ID, 'shipping_fee_cents', true),
                'platformFeePercent' => (int) (get_post_meta($post->ID, 'platform_fee_percent', true) ?: self::PLATFORM_FEE_PERCENT),
                'platformFeeAmountCents' => (int) get_post_meta($post->ID, 'platform_fee_amount_cents', true),
                'ownerPayoutAmountCents' => (int) get_post_meta($post->ID, 'owner_payout_amount_cents', true),
                'ownerPayoutStatus' => get_post_meta($post->ID, 'owner_payout_status', true) ?: 'pending',
                'fulfillmentMethod' => get_post_meta($post->ID, 'fulfillment_method', true) ?: 'none',
                'shippingAddress' => json_decode((string) get_post_meta($post->ID, 'shipping_address', true), true) ?: [],
                'pickupInstructions' => $product ? get_post_meta($product->ID, 'pickup_instructions', true) : '',
                'submittedAt' => $post->post_date,
            ];
        }, $orders);

        return rest_ensure_response($results);
    }
}
