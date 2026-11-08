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

        register_rest_route(self::NAMESPACE_, '/vendor-orders/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'update_order'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-analytics/mine', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'analytics_mine'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products/(?P<id>\d+)/reviews', [
            'methods' => ['GET', 'POST'],
            'callback' => [__CLASS__, 'product_reviews'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/vendor-products/(?P<id>\d+)/view', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'record_product_view'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/(?P<slug>[a-zA-Z0-9-_]+)/storefront-view', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'record_storefront_view'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
    }

    private static function format_product($post)
    {
        $variants = json_decode((string) get_post_meta($post->ID, 'variants', true), true);
        $variants = is_array($variants) ? $variants : [];
        $track_stock = get_post_meta($post->ID, 'track_stock', true) === '1';
        $stock_quantity = max(0, (int) get_post_meta($post->ID, 'stock_quantity', true));
        $low_stock_threshold = max(0, (int) (get_post_meta($post->ID, 'low_stock_threshold', true) ?: 3));
        $saved_product_type = sanitize_key((string) get_post_meta($post->ID, 'product_type', true));
        $product_type = in_array($saved_product_type, ['simple', 'variable'], true)
            ? $saved_product_type
            : (!empty($variants) ? 'variable' : 'simple');
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
            'sku' => (string) get_post_meta($post->ID, 'sku', true),
            'category' => (string) get_post_meta($post->ID, 'product_category', true),
            'productType' => $product_type,
            'trackStock' => $track_stock,
            'stockQuantity' => $track_stock ? $stock_quantity : null,
            'lowStockThreshold' => $low_stock_threshold,
            'stockStatus' => !$track_stock ? 'available' : ($stock_quantity <= 0 ? 'sold_out' : ($stock_quantity <= $low_stock_threshold ? 'low_stock' : 'in_stock')),
            'variants' => array_values($variants),
            'reviewAverage' => (float) get_post_meta($post->ID, 'review_average', true),
            'reviewCount' => (int) get_post_meta($post->ID, 'review_count', true),
        ];
    }

    private static function sanitize_variants($value)
    {
        $decoded = is_array($value) ? $value : json_decode((string) $value, true);
        if (!is_array($decoded)) {
            return [];
        }
        $variants = [];
        foreach (array_slice($decoded, 0, 50) as $index => $variant) {
            if (!is_array($variant)) {
                continue;
            }
            $label = sanitize_text_field((string) ($variant['label'] ?? ''));
            if ($label === '') {
                continue;
            }
            $variants[] = [
                'id' => sanitize_key((string) ($variant['id'] ?? sanitize_title($label) . '-' . ($index + 1))),
                'label' => $label,
                'size' => sanitize_text_field((string) ($variant['size'] ?? '')),
                'color' => sanitize_text_field((string) ($variant['color'] ?? '')),
                'sku' => sanitize_text_field((string) ($variant['sku'] ?? '')),
                'priceCents' => max(0, (int) ($variant['priceCents'] ?? 0)),
                'stockQuantity' => max(0, (int) ($variant['stockQuantity'] ?? 0)),
                'lowStockThreshold' => max(0, (int) ($variant['lowStockThreshold'] ?? 3)),
            ];
        }
        return $variants;
    }

    private static function validate_inventory($product_type, $track_stock, $stock_quantity, $variants)
    {
        if ($product_type === 'simple') {
            if ($track_stock && $stock_quantity < 0) {
                return new WP_Error('c767_invalid_inventory', 'Stock quantity cannot be below zero.', ['status' => 400]);
            }
            return true;
        }
        if (empty($variants)) {
            return new WP_Error('c767_invalid_inventory', 'Add at least one complete product variation.', ['status' => 400]);
        }
        foreach ($variants as $index => $variant) {
            if (($variant['size'] === '' && $variant['color'] === '')
                || $variant['sku'] === ''
                || (int) $variant['priceCents'] <= 0) {
                return new WP_Error(
                    'c767_invalid_inventory',
                    sprintf('Complete the size or color, SKU, price, and stock for variation %d.', $index + 1),
                    ['status' => 400]
                );
            }
        }
        return true;
    }

    private static function refresh_listing_storefront_meta($listing_id)
    {
        $products = get_posts([
            'post_type' => 'vendor_product',
            'post_status' => 'publish',
            'numberposts' => -1,
            'meta_query' => [
                ['key' => 'listing_id', 'value' => (int) $listing_id],
                ['key' => 'active', 'value' => '1'],
            ],
        ]);
        $options = [];
        $search_terms = [];
        foreach ($products as $product) {
            $search_terms[] = $product->post_title;
            $search_terms[] = (string) get_post_meta($product->ID, 'product_category', true);
            $search_terms[] = (string) get_post_meta($product->ID, 'sku', true);
            $mode = self::product_fulfillment_mode($product->ID);
            if (in_array($mode, ['shipping', 'both'], true)) {
                $options[] = 'shipping';
            }
            if (in_array($mode, ['pickup', 'both'], true)) {
                $options[] = 'pickup';
            }
        }
        update_post_meta($listing_id, 'storefront_product_count', count($products));
        update_post_meta($listing_id, 'storefront_fulfillment_options', array_values(array_unique($options)));
        update_post_meta($listing_id, 'storefront_product_search', implode(' ', array_filter(array_unique($search_terms))));
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

    private static function cached_public_response($data)
    {
        $response = rest_ensure_response($data);
        $response->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        return $response;
    }

    /** Public — the "Buy" cards on a listing profile only ever show active items. */
    public static function list_for_listing(WP_REST_Request $request)
    {
        $slug = sanitize_title((string) $request->get_param('slug'));
        $listing = get_page_by_path($slug, OBJECT, 'listing');
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if (!self::is_account_storefront($listing)) {
            return self::cached_public_response([]);
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

        return self::cached_public_response(array_map([__CLASS__, 'format_product'], $products));
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
            'coverPosition' => self::sanitize_storefront_position(get_post_meta($listing->ID, 'storefront_cover_position', true)),
            'coverZoom' => self::sanitize_storefront_zoom(get_post_meta($listing->ID, 'storefront_cover_zoom', true) ?: 1),
            'logoUrl' => (string) (get_post_meta($listing->ID, 'storefront_logo_url', true) ?: get_post_meta($listing->ID, 'logo', true)),
            'headline' => (string) (get_post_meta($listing->ID, 'storefront_headline', true) ?: 'Shop ' . $listing->post_title),
            'welcomeText' => (string) (get_post_meta($listing->ID, 'storefront_welcome_text', true) ?: 'A curated selection from this Connect767 business, available through secure checkout.'),
            'accentColor' => $accent ?: '#0f6b4f',
            'aboutText' => (string) get_post_meta($listing->ID, 'storefront_about_text', true),
            'shippingMessage' => (string) (get_post_meta($listing->ID, 'storefront_shipping_message', true) ?: 'Shipping and local pickup options are shown with each product.'),
            'policies' => (string) get_post_meta($listing->ID, 'storefront_policies', true),
            'productGrid' => self::sanitize_layout_option(get_post_meta($listing->ID, 'storefront_product_grid', true), ['auto', '3', '4'], 'auto'),
            'imageRatio' => self::sanitize_layout_option(get_post_meta($listing->ID, 'storefront_image_ratio', true), ['square', 'portrait', 'landscape'], 'square'),
            'cardCorners' => self::sanitize_layout_option(get_post_meta($listing->ID, 'storefront_card_corners', true), ['rounded', 'soft', 'square'], 'rounded'),
            'contentWidth' => self::sanitize_layout_option(get_post_meta($listing->ID, 'storefront_content_width', true), ['standard', 'wide'], 'standard'),
            'defaultTab' => self::sanitize_layout_option(get_post_meta($listing->ID, 'storefront_default_tab', true), ['products', 'overview'], 'products'),
            'featuredProductIds' => array_values(array_map('intval', is_array($featured) ? $featured : [])),
            'productOrder' => array_values(array_map('intval', is_array($order) ? $order : [])),
            'connectPayoutEnabled' => (bool) get_option('connect767_stripe_connect_enabled', false) && preg_match('/^acct_[A-Za-z0-9]+$/', (string) get_post_meta($listing->ID, '_stripe_connect_account_id', true)),
        ];
    }

    public static function public_storefront_settings(WP_REST_Request $request)
    {
        $listing = get_page_by_path(sanitize_title((string) $request->get_param('slug')), OBJECT, 'listing');
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if (!self::is_account_storefront($listing)) {
            return new WP_Error('c767_not_account_storefront', 'This profile does not host the account storefront.', ['status' => 404]);
        }
        // Store design changes need to appear as soon as the owner publishes
        // them. Product/review endpoints may remain cached, but this small
        // settings response must not serve a stale layout.
        $response = rest_ensure_response(self::storefront_settings($listing));
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return $response;
    }

    public static function owner_storefront_settings(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $listing = self::require_account_storefront((int) $request->get_param('id'), $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }
        if ($request->get_method() === 'GET') {
            return rest_ensure_response(array_merge(self::storefront_settings($listing), C767_REST_Listings::payout_settings_for_owner($listing->ID), [
                'stripeConnectAccountId' => (string) get_post_meta($listing->ID, '_stripe_connect_account_id', true),
            ]));
        }

        if ($request->get_param('bookingPayoutMethod') !== null) {
            $payout = C767_REST_Listings::save_payout_settings_for_owner($listing->ID, $request);
            if (is_wp_error($payout)) {
                return $payout;
            }
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
        $layout_fields = [
            'productGrid' => ['storefront_product_grid', ['auto', '3', '4'], 'auto'],
            'imageRatio' => ['storefront_image_ratio', ['square', 'portrait', 'landscape'], 'square'],
            'cardCorners' => ['storefront_card_corners', ['rounded', 'soft', 'square'], 'rounded'],
            'contentWidth' => ['storefront_content_width', ['standard', 'wide'], 'standard'],
            'defaultTab' => ['storefront_default_tab', ['products', 'overview'], 'products'],
        ];
        foreach ($layout_fields as $param => [$meta_key, $allowed, $fallback]) {
            if ($request->get_param($param) !== null) {
                update_post_meta($listing->ID, $meta_key, self::sanitize_layout_option($request->get_param($param), $allowed, $fallback));
            }
        }
        if ($request->get_param('coverPosition') !== null) {
            update_post_meta($listing->ID, 'storefront_cover_position', self::sanitize_storefront_position($request->get_param('coverPosition')));
        }
        if ($request->get_param('coverZoom') !== null) {
            update_post_meta($listing->ID, 'storefront_cover_zoom', self::sanitize_storefront_zoom($request->get_param('coverZoom')));
        }
        if ($request->get_param('stripeConnectAccountId') !== null) {
            $account = sanitize_text_field((string) $request->get_param('stripeConnectAccountId'));
            if ($account === '') {
                delete_post_meta($listing->ID, '_stripe_connect_account_id');
            } elseif (preg_match('/^acct_[A-Za-z0-9]+$/', $account)) {
                update_post_meta($listing->ID, '_stripe_connect_account_id', $account);
            } else {
                return new WP_Error('c767_invalid_connect_account', 'Enter a valid Stripe Connect account ID beginning with acct_.', ['status' => 400]);
            }
        }

        $owned_product_ids = get_posts([
            'post_type' => 'vendor_product', 'post_status' => 'publish', 'numberposts' => -1,
            'fields' => 'ids', 'meta_query' => [['key' => 'listing_id', 'value' => $listing->ID]],
        ]);
        foreach (['featuredProductIds' => 'storefront_featured_product_ids', 'productOrder' => 'storefront_product_order'] as $param => $meta_key) {
            $raw = $request->get_param($param);
            if ($raw === null) {
                continue;
            }
            $decoded = is_array($raw) ? $raw : json_decode((string) $raw, true);
            $ids = array_values(array_intersect(array_map('intval', is_array($decoded) ? $decoded : []), array_map('intval', $owned_product_ids)));
            update_post_meta($listing->ID, $meta_key, wp_json_encode($ids));
        }

        self::handle_storefront_image($listing->ID, 'storefrontCover', 'storefront_cover_url');
        self::handle_storefront_image($listing->ID, 'storefrontLogo', 'storefront_logo_url');

        return rest_ensure_response(array_merge(self::storefront_settings($listing), C767_REST_Listings::payout_settings_for_owner($listing->ID), [
            'stripeConnectAccountId' => (string) get_post_meta($listing->ID, '_stripe_connect_account_id', true),
        ]));
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

    private static function sanitize_storefront_position($value)
    {
        $raw = trim((string) $value);
        if (preg_match('/^(-?\d{1,3}(?:\.\d+)?)%\s+(-?\d{1,3}(?:\.\d+)?)%$/', $raw, $matches)) {
            $x = max(0, min(100, (float) $matches[1]));
            $y = max(0, min(100, (float) $matches[2]));
            return round($x) . '% ' . round($y) . '%';
        }
        $keyword = sanitize_key($raw);
        $allowed = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
        return in_array($keyword, $allowed, true) ? $keyword : 'center';
    }

    private static function sanitize_storefront_zoom($value)
    {
        return max(1, min(2.5, (float) $value));
    }

    private static function sanitize_layout_option($value, $allowed, $fallback)
    {
        $value = sanitize_key((string) $value);
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    /** Owner's dashboard — every product across every listing they own, active or not. */
    public static function mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $storefront_listing_id = self::account_storefront_listing_id($user->ID);
        if (!$storefront_listing_id) {
            return rest_ensure_response([]);
        }

        $products = get_posts([
            'post_type' => 'vendor_product',
            'post_status' => 'publish',
            'numberposts' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => [
                ['key' => 'listing_id', 'value' => $storefront_listing_id],
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
     * A Connect767 account may own several directory profiles, but it may
     * operate only one storefront. The selected profile ID is persisted on
     * the WordPress user so every dashboard and API request resolves to the
     * same store. Existing sellers keep the profile that already has products
     * whenever possible.
     */
    private static function account_storefront_listing_id($user_id, $requested_id = 0)
    {
        $owned_ids = array_map('intval', self::owned_listing_ids($user_id));
        if (empty($owned_ids)) {
            return 0;
        }

        $saved_id = (int) get_user_meta($user_id, '_c767_storefront_listing_id', true);
        if ($saved_id && in_array($saved_id, $owned_ids, true)) {
            return $saved_id;
        }

        $product_ids = get_posts([
            'post_type' => 'vendor_product',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields' => 'ids',
            'orderby' => 'date',
            'order' => 'ASC',
        ]);
        foreach ($product_ids as $product_id) {
            $product_listing_id = (int) get_post_meta($product_id, 'listing_id', true);
            if (in_array($product_listing_id, $owned_ids, true)) {
                update_user_meta($user_id, '_c767_storefront_listing_id', $product_listing_id);
                return $product_listing_id;
            }
        }

        $requested_id = (int) $requested_id;
        $selected_id = $requested_id && in_array($requested_id, $owned_ids, true)
            ? $requested_id
            : (int) $owned_ids[0];
        update_user_meta($user_id, '_c767_storefront_listing_id', $selected_id);
        return $selected_id;
    }

    private static function require_account_storefront($listing_id, $user_id)
    {
        $listing = self::require_owned_listing($listing_id, $user_id);
        if (is_wp_error($listing)) {
            return $listing;
        }
        $storefront_id = self::account_storefront_listing_id($user_id, $listing_id);
        if ((int) $listing->ID !== (int) $storefront_id) {
            return new WP_Error('c767_storefront_limit', 'Each account can operate one storefront. Manage products from your existing storefront.', ['status' => 409]);
        }
        return $listing;
    }

    private static function is_account_storefront($listing)
    {
        return $listing
            && (int) $listing->ID === self::account_storefront_listing_id((int) $listing->post_author);
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
        $listing = self::require_account_storefront($listing_id, $user->ID);
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
        update_post_meta($product_id, 'sku', sanitize_text_field((string) $request->get_param('sku')));
        update_post_meta($product_id, 'product_category', sanitize_text_field((string) $request->get_param('category')));
        $product_type = sanitize_key((string) $request->get_param('productType'));
        $product_type = in_array($product_type, ['simple', 'variable'], true) ? $product_type : 'simple';
        $track_stock = filter_var($request->get_param('trackStock'), FILTER_VALIDATE_BOOLEAN) || $product_type === 'variable';
        $stock_quantity = max(0, (int) $request->get_param('stockQuantity'));
        $variants = self::sanitize_variants($request->get_param('variants'));
        $inventory_valid = self::validate_inventory($product_type, $track_stock, $stock_quantity, $variants);
        if (is_wp_error($inventory_valid)) {
            wp_delete_post($product_id, true);
            return $inventory_valid;
        }
        update_post_meta($product_id, 'product_type', $product_type);
        update_post_meta($product_id, 'track_stock', $track_stock ? '1' : '0');
        update_post_meta($product_id, 'stock_quantity', $stock_quantity);
        update_post_meta($product_id, 'low_stock_threshold', max(0, (int) ($request->get_param('lowStockThreshold') ?: 3)));
        update_post_meta($product_id, 'variants', wp_json_encode($variants));

        self::handle_image_upload($product_id);
        self::refresh_listing_storefront_meta($listing_id);

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
            $listing_id = (int) get_post_meta($product_id, 'listing_id', true);
            wp_delete_post($product_id, true);
            self::refresh_listing_storefront_meta($listing_id);
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
        if ($request->get_param('sku') !== null) {
            update_post_meta($product_id, 'sku', sanitize_text_field((string) $request->get_param('sku')));
        }
        if ($request->get_param('category') !== null) {
            update_post_meta($product_id, 'product_category', sanitize_text_field((string) $request->get_param('category')));
        }
        if ($request->get_param('productType') !== null || $request->get_param('variants') !== null) {
            $current_type = sanitize_key((string) get_post_meta($product_id, 'product_type', true));
            $next_type = $request->get_param('productType') !== null
                ? sanitize_key((string) $request->get_param('productType'))
                : $current_type;
            $next_type = in_array($next_type, ['simple', 'variable'], true) ? $next_type : 'simple';
            $next_track = $request->get_param('trackStock') !== null
                ? filter_var($request->get_param('trackStock'), FILTER_VALIDATE_BOOLEAN)
                : get_post_meta($product_id, 'track_stock', true) === '1';
            $next_stock = $request->get_param('stockQuantity') !== null
                ? max(0, (int) $request->get_param('stockQuantity'))
                : max(0, (int) get_post_meta($product_id, 'stock_quantity', true));
            $next_variants = $request->get_param('variants') !== null
                ? self::sanitize_variants($request->get_param('variants'))
                : self::sanitize_variants(get_post_meta($product_id, 'variants', true));
            $inventory_valid = self::validate_inventory($next_type, $next_track || $next_type === 'variable', $next_stock, $next_variants);
            if (is_wp_error($inventory_valid)) {
                return $inventory_valid;
            }
        }
        if ($request->get_param('productType') !== null) {
            $product_type = sanitize_key((string) $request->get_param('productType'));
            if (in_array($product_type, ['simple', 'variable'], true)) {
                update_post_meta($product_id, 'product_type', $product_type);
            }
        }
        if ($request->get_param('trackStock') !== null) {
            update_post_meta($product_id, 'track_stock', filter_var($request->get_param('trackStock'), FILTER_VALIDATE_BOOLEAN) ? '1' : '0');
        }
        if ($request->get_param('stockQuantity') !== null) {
            update_post_meta($product_id, 'stock_quantity', max(0, (int) $request->get_param('stockQuantity')));
        }
        if ($request->get_param('lowStockThreshold') !== null) {
            update_post_meta($product_id, 'low_stock_threshold', max(0, (int) $request->get_param('lowStockThreshold')));
        }
        if ($request->get_param('variants') !== null) {
            update_post_meta($product_id, 'variants', wp_json_encode(self::sanitize_variants($request->get_param('variants'))));
        }

        self::handle_image_upload($product_id);
        self::refresh_listing_storefront_meta((int) get_post_meta($product_id, 'listing_id', true));

        return rest_ensure_response(self::format_product(get_post($product_id)));
    }

    private static function purchase_selection(WP_REST_Request $request, $product_id)
    {
        $quantity = max(1, min(25, (int) ($request->get_param('quantity') ?: 1)));
        $base_price = (int) get_post_meta($product_id, 'price_cents', true);
        $track_stock = get_post_meta($product_id, 'track_stock', true) === '1';
        $stock = max(0, (int) get_post_meta($product_id, 'stock_quantity', true));
        $variant_id = sanitize_key((string) $request->get_param('variantId'));
        $selected = null;
        $variants = self::sanitize_variants(get_post_meta($product_id, 'variants', true));
        if (!empty($variants)) {
            foreach ($variants as $variant) {
                if ((string) $variant['id'] === $variant_id) {
                    $selected = $variant;
                    break;
                }
            }
            if (!$selected) {
                return new WP_Error('c767_variant_required', 'Choose an available product option.', ['status' => 400]);
            }
            $base_price = $selected['priceCents'] > 0 ? $selected['priceCents'] : $base_price;
            $track_stock = true;
            $stock = $selected['stockQuantity'];
        }
        if ($track_stock && $quantity > $stock) {
            return new WP_Error('c767_insufficient_stock', 'The requested quantity is no longer available.', ['status' => 409]);
        }
        return [
            'quantity' => $quantity,
            'unit_price_cents' => $base_price,
            'product_amount_cents' => $base_price * $quantity,
            'variant_id' => $selected['id'] ?? '',
            'variant_label' => $selected['label'] ?? '',
        ];
    }

    private static function stripe_connect_params($listing_id, $platform_fee_cents)
    {
        $account = (string) get_post_meta($listing_id, '_stripe_connect_account_id', true);
        $enabled = (bool) get_option('connect767_stripe_connect_enabled', false);
        if (!$enabled || !preg_match('/^acct_[A-Za-z0-9]+$/', $account)) {
            return [];
        }
        return [
            'application_fee_amount' => max(0, (int) $platform_fee_cents),
            'transfer_data' => ['destination' => $account],
        ];
    }

    /**
     * Public — creates a real Stripe PaymentIntent for exactly this
     * product's price, same PaymentIntent + confirm-server-side-only
     * pattern as C767_Stripe_Listing_Checkout. Payment lands in this
     * site's own Stripe account (see class doc comment above).
     */
    public static function create_checkout(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('vendor-stripe');
        if (is_wp_error($limited)) {
            return $limited;
        }
        $product_id = (int) $request->get_param('id');
        $product = get_post($product_id);
        if (!$product || $product->post_type !== 'vendor_product' || get_post_meta($product_id, 'active', true) !== '1') {
            return new WP_Error('c767_product_not_found', 'Product not found or no longer available.', ['status' => 404]);
        }

        $selection = self::purchase_selection($request, $product_id);
        if (is_wp_error($selection)) {
            return $selection;
        }
        $listing_id = (int) get_post_meta($product_id, 'listing_id', true);
        if (!self::is_account_storefront(get_post($listing_id))) {
            return new WP_Error('c767_storefront_limit', 'This product is not part of the seller’s active storefront.', ['status' => 409]);
        }
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
        $breakdown = self::payment_breakdown($selection['product_amount_cents'], $fulfillment['fee_cents']);
        $total_cents = $breakdown['gross_amount_cents'];

        $intent_params = [
            'amount' => $total_cents,
            'currency' => 'usd',
            'metadata' => [
                'vendor_product_id' => $product_id,
                'listing_id' => $listing_id,
                'fulfillment_method' => $fulfillment['method'],
                'platform_fee_percent' => $breakdown['platform_fee_percent'],
                'platform_fee_amount_cents' => $breakdown['platform_fee_amount_cents'],
                'owner_payout_amount_cents' => $breakdown['owner_payout_amount_cents'],
                'quantity' => $selection['quantity'],
                'variant_id' => $selection['variant_id'],
            ],
            'receipt_email' => $buyer_email ?: null,
            // Card-only — see the matching comment in
            // class-stripe-checkout.php::create_intent() for why this is
            // required to avoid the "must provide a return_url" error.
            'payment_method_types' => ['card'],
        ];
        $intent_params = array_merge($intent_params, self::stripe_connect_params($listing_id, $breakdown['platform_fee_amount_cents']));
        $intent = C767_Stripe_Checkout::stripe_request('/payment_intents', $intent_params);
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
            'product_amount_cents' => $selection['product_amount_cents'],
            'unit_price_cents' => $selection['unit_price_cents'],
            'quantity' => $selection['quantity'],
            'variant_id' => $selection['variant_id'],
            'variant_label' => $selection['variant_label'],
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
            'fulfillment_status' => 'new',
            'review_token' => wp_generate_password(32, false, false),
            'access_token' => wp_generate_password(40, false, false),
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($order_id, $key, $value);
        }

        return rest_ensure_response([
            'orderId' => $order_id,
            'clientSecret' => $intent['client_secret'],
            'accessToken' => $meta['access_token'],
        ]);
    }

    private static function public_order(WP_REST_Request $request)
    {
        $order_id = (int) $request->get_param('id');
        $order = get_post($order_id);
        if (!$order || $order->post_type !== 'vendor_order') {
            return new WP_Error('c767_order_not_found', 'Order not found.', ['status' => 404]);
        }
        $provided = (string) $request->get_param('accessToken');
        $expected = (string) get_post_meta($order_id, 'access_token', true);
        if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
            return new WP_Error('c767_order_forbidden', 'Invalid checkout access token.', ['status' => 403]);
        }
        return $order;
    }

    /** Never trusts the browser's word — asks Stripe directly, same as confirm_order()/confirm_payment() elsewhere. */
    public static function confirm_checkout(WP_REST_Request $request)
    {
        $order = self::public_order($request);
        if (is_wp_error($order)) {
            return $order;
        }
        $order_id = (int) $order->ID;

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
            $listing_id = (int) get_post_meta($order_id, 'listing_id', true);
            $connect = self::stripe_connect_params($listing_id, (int) get_post_meta($order_id, 'platform_fee_amount_cents', true));
            update_post_meta($order_id, 'owner_payout_status', empty($connect) ? 'pending' : 'automatic');
            if (!$was_paid) {
                self::adjust_inventory_for_paid_order($order_id);
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
        $limited = C767_Stripe_Checkout::check_public_rate_limit('vendor-paypal');
        if (is_wp_error($limited)) {
            return $limited;
        }
        $product_id = (int) $request->get_param('id');
        $product = get_post($product_id);
        if (!$product || $product->post_type !== 'vendor_product' || get_post_meta($product_id, 'active', true) !== '1') {
            return new WP_Error('c767_product_not_found', 'Product not found or no longer available.', ['status' => 404]);
        }

        $selection = self::purchase_selection($request, $product_id);
        if (is_wp_error($selection)) {
            return $selection;
        }
        $listing_id = (int) get_post_meta($product_id, 'listing_id', true);
        if (!self::is_account_storefront(get_post($listing_id))) {
            return new WP_Error('c767_storefront_limit', 'This product is not part of the seller’s active storefront.', ['status' => 409]);
        }
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
        $breakdown = self::payment_breakdown($selection['product_amount_cents'], $fulfillment['fee_cents']);
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
            'product_amount_cents' => $selection['product_amount_cents'],
            'unit_price_cents' => $selection['unit_price_cents'],
            'quantity' => $selection['quantity'],
            'variant_id' => $selection['variant_id'],
            'variant_label' => $selection['variant_label'],
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
            'fulfillment_status' => 'new',
            'review_token' => wp_generate_password(32, false, false),
            'access_token' => wp_generate_password(40, false, false),
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($order_id, $key, $value);
        }

        return rest_ensure_response([
            'orderId' => $order_id,
            'paypalOrderId' => $paypal_order['id'],
            'accessToken' => $meta['access_token'],
        ]);
    }

    /** Never trusts the browser's word — asks PayPal directly, same rule as confirm_checkout() above. */
    public static function confirm_paypal_checkout(WP_REST_Request $request)
    {
        $order = self::public_order($request);
        if (is_wp_error($order)) {
            return $order;
        }
        $order_id = (int) $order->ID;

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
                self::adjust_inventory_for_paid_order($order_id);
                update_post_meta($order_id, 'paid_at', current_time('mysql', true));
                do_action('c767_vendor_order_paid', $order_id);
            }
            return rest_ensure_response(['status' => 'paid', 'orderId' => $order_id]);
        }

        return rest_ensure_response(['status' => strtolower($capture['status'] ?? 'unknown'), 'orderId' => $order_id]);
    }

    private static function adjust_inventory_for_paid_order($order_id)
    {
        if (get_post_meta($order_id, 'inventory_adjusted', true) === '1') {
            return;
        }
        $product_id = (int) get_post_meta($order_id, 'product_id', true);
        $quantity = max(1, (int) get_post_meta($order_id, 'quantity', true));
        $variant_id = (string) get_post_meta($order_id, 'variant_id', true);
        if ($variant_id !== '') {
            $variants = self::sanitize_variants(get_post_meta($product_id, 'variants', true));
            foreach ($variants as &$variant) {
                if ((string) $variant['id'] === $variant_id) {
                    $variant['stockQuantity'] = max(0, (int) $variant['stockQuantity'] - $quantity);
                    break;
                }
            }
            unset($variant);
            update_post_meta($product_id, 'variants', wp_json_encode($variants));
        } elseif (get_post_meta($product_id, 'track_stock', true) === '1') {
            $stock = max(0, (int) get_post_meta($product_id, 'stock_quantity', true));
            update_post_meta($product_id, 'stock_quantity', max(0, $stock - $quantity));
        }
        update_post_meta($order_id, 'inventory_adjusted', '1');
    }

    /** Sales across every listing the current user owns — for manual payout bookkeeping. */
    public static function orders_mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $storefront_listing_id = self::account_storefront_listing_id($user->ID);
        $listing_ids = $storefront_listing_id ? [$storefront_listing_id] : [];
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
                'quantity' => max(1, (int) get_post_meta($post->ID, 'quantity', true)),
                'variantLabel' => (string) get_post_meta($post->ID, 'variant_label', true),
                'fulfillmentStatus' => (string) (get_post_meta($post->ID, 'fulfillment_status', true) ?: 'new'),
                'trackingNumber' => (string) get_post_meta($post->ID, 'tracking_number', true),
                'shippingCarrier' => (string) get_post_meta($post->ID, 'shipping_carrier', true),
                'sellerNote' => (string) get_post_meta($post->ID, 'seller_note', true),
                'refundStatus' => (string) get_post_meta($post->ID, 'refund_status', true),
                'submittedAt' => $post->post_date,
            ];
        }, $orders);

        return rest_ensure_response($results);
    }

    private static function owned_order($order_id, $user_id)
    {
        $order = get_post($order_id);
        if (!$order || $order->post_type !== 'vendor_order') {
            return new WP_Error('c767_order_not_found', 'Order not found.', ['status' => 404]);
        }
        $listing = get_post((int) get_post_meta($order_id, 'listing_id', true));
        if (!$listing || (int) $listing->post_author !== (int) $user_id) {
            return new WP_Error('c767_not_owner', 'This order does not belong to your storefront.', ['status' => 403]);
        }
        return $order;
    }

    public static function update_order(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $order_id = (int) $request->get_param('id');
        $order = self::owned_order($order_id, $user->ID);
        if (is_wp_error($order)) {
            return $order;
        }
        $status = sanitize_key((string) $request->get_param('fulfillmentStatus'));
        if ($status && in_array($status, ['new', 'processing', 'shipped', 'ready_for_pickup', 'completed', 'cancelled'], true)) {
            update_post_meta($order_id, 'fulfillment_status', $status);
        }
        foreach (['trackingNumber' => 'tracking_number', 'shippingCarrier' => 'shipping_carrier', 'sellerNote' => 'seller_note'] as $param => $meta_key) {
            if ($request->get_param($param) !== null) {
                update_post_meta($order_id, $meta_key, sanitize_textarea_field((string) $request->get_param($param)));
            }
        }
        if (filter_var($request->get_param('requestRefund'), FILTER_VALIDATE_BOOLEAN)) {
            update_post_meta($order_id, 'refund_status', 'requested');
        }
        return rest_ensure_response(['id' => $order_id, 'updated' => true]);
    }

    public static function analytics_mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $storefront_listing_id = self::account_storefront_listing_id($user->ID);
        $listing_ids = $storefront_listing_id ? [$storefront_listing_id] : [];
        $store_views = 0;
        $product_views = 0;
        $active_products = 0;
        foreach ($listing_ids as $listing_id) {
            $store_views += (int) get_post_meta($listing_id, 'storefront_view_count', true);
        }
        $products = empty($listing_ids) ? [] : get_posts([
            'post_type' => 'vendor_product', 'post_status' => 'publish', 'numberposts' => -1,
            'meta_query' => [['key' => 'listing_id', 'value' => $listing_ids, 'compare' => 'IN']],
        ]);
        foreach ($products as $product) {
            $product_views += (int) get_post_meta($product->ID, 'view_count', true);
            if (get_post_meta($product->ID, 'active', true) === '1') {
                $active_products++;
            }
        }
        $orders = empty($listing_ids) ? [] : get_posts([
            'post_type' => 'vendor_order', 'post_status' => 'publish', 'numberposts' => -1,
            'meta_query' => [
                ['key' => 'listing_id', 'value' => $listing_ids, 'compare' => 'IN'],
                ['key' => 'status', 'value' => 'paid'],
            ],
        ]);
        $revenue = 0;
        $fees = 0;
        $payouts = 0;
        foreach ($orders as $order) {
            $revenue += (int) get_post_meta($order->ID, 'amount_cents', true);
            $fees += (int) get_post_meta($order->ID, 'platform_fee_amount_cents', true);
            $payouts += (int) get_post_meta($order->ID, 'owner_payout_amount_cents', true);
        }
        return rest_ensure_response([
            'storeViews' => $store_views,
            'productViews' => $product_views,
            'activeProducts' => $active_products,
            'orders' => count($orders),
            'revenueCents' => $revenue,
            'feesCents' => $fees,
            'payoutsCents' => $payouts,
        ]);
    }

    public static function record_storefront_view(WP_REST_Request $request)
    {
        $listing = get_page_by_path(sanitize_title((string) $request->get_param('slug')), OBJECT, 'listing');
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if (!self::is_account_storefront($listing)) {
            return new WP_Error('c767_not_account_storefront', 'This profile does not host the account storefront.', ['status' => 404]);
        }
        $count = (int) get_post_meta($listing->ID, 'storefront_view_count', true) + 1;
        update_post_meta($listing->ID, 'storefront_view_count', $count);
        return rest_ensure_response(['count' => $count]);
    }

    public static function record_product_view(WP_REST_Request $request)
    {
        $product_id = (int) $request->get_param('id');
        $product = get_post($product_id);
        if (!$product || $product->post_type !== 'vendor_product') {
            return new WP_Error('c767_product_not_found', 'Product not found.', ['status' => 404]);
        }
        $count = (int) get_post_meta($product_id, 'view_count', true) + 1;
        update_post_meta($product_id, 'view_count', $count);
        return rest_ensure_response(['count' => $count]);
    }

    public static function product_reviews(WP_REST_Request $request)
    {
        $product_id = (int) $request->get_param('id');
        $product = get_post($product_id);
        if (!$product || $product->post_type !== 'vendor_product') {
            return new WP_Error('c767_product_not_found', 'Product not found.', ['status' => 404]);
        }
        if ($request->get_method() === 'GET') {
            $reviews = get_posts([
                'post_type' => 'vendor_product_review', 'post_status' => 'publish', 'numberposts' => 50,
                'orderby' => 'date', 'order' => 'DESC',
                'meta_query' => [['key' => 'product_id', 'value' => $product_id]],
            ]);
            return self::cached_public_response(array_map(function ($review) {
                return [
                    'id' => $review->ID,
                    'name' => get_post_meta($review->ID, 'buyer_name', true),
                    'rating' => (int) get_post_meta($review->ID, 'rating', true),
                    'text' => $review->post_content,
                    'verified' => true,
                    'submittedAt' => $review->post_date,
                ];
            }, $reviews));
        }

        $order_id = (int) $request->get_param('orderId');
        $email = sanitize_email((string) $request->get_param('email'));
        $order = get_post($order_id);
        if (!$order || $order->post_type !== 'vendor_order' || get_post_meta($order_id, 'status', true) !== 'paid' || (int) get_post_meta($order_id, 'product_id', true) !== $product_id || strtolower((string) get_post_meta($order_id, 'buyer_email', true)) !== strtolower($email)) {
            return new WP_Error('c767_review_not_verified', 'Only verified purchasers can review this product.', ['status' => 403]);
        }
        $existing = get_posts([
            'post_type' => 'vendor_product_review', 'post_status' => 'publish', 'numberposts' => 1,
            'meta_query' => [['key' => 'order_id', 'value' => $order_id]],
        ]);
        if ($existing) {
            return new WP_Error('c767_review_exists', 'This purchase has already been reviewed.', ['status' => 409]);
        }
        $rating = max(1, min(5, (int) $request->get_param('rating')));
        $text = sanitize_textarea_field((string) $request->get_param('text'));
        $review_id = wp_insert_post([
            'post_type' => 'vendor_product_review', 'post_status' => 'publish',
            'post_title' => sprintf('Verified review — %s', $product->post_title),
            'post_content' => $text,
        ], true);
        if (is_wp_error($review_id)) {
            return $review_id;
        }
        update_post_meta($review_id, 'product_id', $product_id);
        update_post_meta($review_id, 'order_id', $order_id);
        update_post_meta($review_id, 'buyer_name', sanitize_text_field((string) get_post_meta($order_id, 'buyer_name', true)));
        update_post_meta($review_id, 'rating', $rating);
        $all_reviews = get_posts([
            'post_type' => 'vendor_product_review', 'post_status' => 'publish', 'numberposts' => -1,
            'meta_query' => [['key' => 'product_id', 'value' => $product_id]],
        ]);
        $total = array_sum(array_map(function ($review) { return (int) get_post_meta($review->ID, 'rating', true); }, $all_reviews));
        update_post_meta($product_id, 'review_count', count($all_reviews));
        update_post_meta($product_id, 'review_average', count($all_reviews) ? round($total / count($all_reviews), 1) : 0);
        return rest_ensure_response(['id' => $review_id, 'verified' => true]);
    }
}
