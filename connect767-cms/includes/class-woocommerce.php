<?php
/**
 * WooCommerce integration. Everything here is a no-op if WooCommerce isn't
 * active — the rest of the site (listings, blog, uniforms) doesn't depend
 * on it.
 *
 *  - Adds an "icon" field to product categories (Remix Icon class name,
 *    e.g. ri-t-shirt-line) so the shop page's category pills have icons,
 *    exposed via the woocommerce_rest_prepare_product_cat filter to match
 *    what src/lib/mappers.js's mapWcCategory expects at wc.acf.icon.
 *
 *  - POST /connect767/v1/checkout — headless checkout bridge. Takes cart
 *    items from the React cart drawer, creates a real WooCommerce order,
 *    and returns the order's native "pay for order" URL so the browser can
 *    be redirected there to complete payment through whatever gateways are
 *    configured in WooCommerce (Stripe, PayPal, etc.) — building a second,
 *    custom payment flow isn't necessary or wise; WooCommerce already
 *    solves that well.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_WooCommerce
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        if (!class_exists('WooCommerce')) {
            return;
        }

        add_action('product_cat_add_form_fields', [__CLASS__, 'render_icon_field_add']);
        add_action('product_cat_edit_form_fields', [__CLASS__, 'render_icon_field_edit']);
        add_action('created_product_cat', [__CLASS__, 'save_icon_field']);
        add_action('edited_product_cat', [__CLASS__, 'save_icon_field']);

        add_filter('woocommerce_rest_prepare_product_cat', [__CLASS__, 'inject_icon_into_rest'], 10, 3);
        add_filter('woocommerce_rest_prepare_product_object', [__CLASS__, 'inject_fallback_image'], 10, 3);
        register_post_meta('product', 'fallback_image', [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);

        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    /**
     * If a product has no real gallery image attached (sample-imported
     * products reference an external URL rather than a downloaded media
     * attachment — see class-importer.php), fall back to that URL so
     * mapWcProduct's `wc.images[0].src` still resolves to something.
     */
    public static function inject_fallback_image($response, $product, $request)
    {
        $data = $response->get_data();
        if (empty($data['images'])) {
            $fallback = get_post_meta($product->get_id(), 'fallback_image', true);
            if ($fallback) {
                $data['images'] = [['id' => 0, 'src' => $fallback, 'alt' => $product->get_name()]];
                $response->set_data($data);
            }
        }
        return $response;
    }

    // ---------- Category icon field ----------

    public static function render_icon_field_add()
    {
        ?>
        <div class="form-field">
            <label for="c767_icon">Icon (Remix Icon class)</label>
            <input type="text" name="c767_icon" id="c767_icon" placeholder="ri-t-shirt-line" />
            <p class="description">Used for the category pill icon on the Shop page. Browse icons at remixicon.com.</p>
        </div>
        <?php
    }

    public static function render_icon_field_edit($term)
    {
        $icon = get_term_meta($term->term_id, 'c767_icon', true);
        ?>
        <tr class="form-field">
            <th scope="row"><label for="c767_icon">Icon (Remix Icon class)</label></th>
            <td>
                <input type="text" name="c767_icon" id="c767_icon" value="<?php echo esc_attr($icon); ?>" placeholder="ri-t-shirt-line" />
                <p class="description">Used for the category pill icon on the Shop page. Browse icons at remixicon.com.</p>
            </td>
        </tr>
        <?php
    }

    public static function save_icon_field($term_id)
    {
        if (isset($_POST['c767_icon'])) {
            update_term_meta($term_id, 'c767_icon', sanitize_text_field(wp_unslash($_POST['c767_icon'])));
        }
    }

    public static function inject_icon_into_rest($response, $item, $request)
    {
        $icon = get_term_meta($item->term_id, 'c767_icon', true);
        $data = $response->get_data();
        $data['acf'] = ['icon' => $icon ?: 'ri-price-tag-3-line'];
        $response->set_data($data);
        return $response;
    }

    // ---------- Headless product/category proxy ----------

    /**
     * Real WooCommerce data via the plugin's own REST namespace instead of
     * the frontend hitting wc/v3 directly with a consumer key/secret baked
     * into the client-side JS bundle — anyone can read that out of the
     * built bundle in devtools, which is fine for local development but
     * not something that belongs in a production site. These proxy
     * endpoints read the data server-side (wc_get_products(), no API keys
     * involved) and return it pre-shaped to match what wc/v3 would have
     * returned, so src/lib/mappers.js's mapWcProduct/mapWcCategory don't
     * need to change — only the URL the frontend calls does (see
     * src/lib/config.js's customApiUrl vs wcApiUrl).
     */
    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/checkout', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/shop/products', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'list_products'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/shop/categories', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'list_categories'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function list_products(WP_REST_Request $request)
    {
        $slug = $request->get_param('slug');

        // wc_get_products() doesn't recognize a 'slug' query var — WC_Product_Query
        // only matches post_name via 'name', so passing 'slug' here was silently
        // ignored and every request returned the entire catalog regardless of what
        // slug was asked for. That's why the product detail page always rendered
        // whichever product happened to come back first: the real bug behind
        // "every product link goes to the same item" (see WORDPRESS.md), not the
        // getProductBySlug() client-side filtering added as a defensive fix. Reuse
        // the same get_page_by_path() lookup product_id_from_slug() already uses
        // for checkout, which is known to resolve a WooCommerce product by slug
        // correctly.
        if ($slug) {
            $product_id = self::product_id_from_slug(sanitize_title($slug));
            $product = $product_id ? wc_get_product($product_id) : null;
            $products = ($product && $product->get_status() === 'publish') ? [$product] : [];
            return rest_ensure_response(array_map([__CLASS__, 'format_product'], $products));
        }

        $products = wc_get_products(['status' => 'publish', 'limit' => -1]);
        return rest_ensure_response(array_map([__CLASS__, 'format_product'], $products));
    }

    private static function format_product($product)
    {
        $image_id = $product->get_image_id();
        $images = [];
        if ($image_id) {
            $images[] = ['id' => $image_id, 'src' => wp_get_attachment_url($image_id)];
        } else {
            $fallback = get_post_meta($product->get_id(), 'fallback_image', true);
            if ($fallback) {
                $images[] = ['id' => 0, 'src' => $fallback];
            }
        }

        $categories = array_map(function ($term) {
            return ['name' => $term->name, 'slug' => $term->slug];
        }, wc_get_product_terms($product->get_id(), 'product_cat'));

        $tags = array_map(function ($term) {
            return ['name' => $term->name];
        }, wc_get_product_terms($product->get_id(), 'product_tag'));

        $result = [
            'id' => $product->get_id(),
            'slug' => $product->get_slug(),
            'name' => $product->get_name(),
            'type' => $product->get_type(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'on_sale' => $product->is_on_sale(),
            'average_rating' => $product->get_average_rating(),
            'rating_count' => $product->get_rating_count(),
            'stock_status' => $product->get_stock_status(),
            'purchasable' => $product->is_purchasable(),
            'categories' => $categories,
            'tags' => $tags,
            'images' => $images,
        ];

        // Real size/color (etc.) support — previously this endpoint only
        // ever returned simple-product data, so a "T-Shirt" configured in
        // WooCommerce the normal way (a variable product with Size/Color
        // attributes) had no way for the frontend to show a size or color
        // picker at all, and "add to cart" had no variation ID to add.
        if ($product->is_type('variable')) {
            $result['attributes'] = array_map(function ($attribute) {
                // WC_Product_Attribute::get_options() behaves differently
                // depending on attribute type: for a *global* attribute
                // (the standard, taxonomy-based way WooCommerce sites
                // usually set up Size/Color — anything named "pa_...")
                // it returns raw term IDs (integers), not label strings.
                // Only custom (non-taxonomy) attributes get real string
                // values directly. Passing a bare integer through to the
                // frontend crashed the variation picker entirely
                // (`n.toLowerCase is not a function` — a number has no
                // such method) the moment anyone selected an option.
                $options = $attribute->is_taxonomy()
                    ? array_map(function ($term_id) use ($attribute) {
                        $term = get_term($term_id, $attribute->get_name());
                        return $term && !is_wp_error($term) ? $term->name : (string) $term_id;
                    }, $attribute->get_options())
                    : $attribute->get_options();

                return [
                    'name' => wc_attribute_label($attribute->get_name()),
                    'options' => $options,
                ];
            }, array_values($product->get_attributes()));

            $result['variations'] = array_map(function ($variation_id) {
                $variation = wc_get_product($variation_id);
                if (!$variation) {
                    return null;
                }
                $variation_image_id = $variation->get_image_id();
                return [
                    'id' => $variation->get_id(),
                    'attributes' => $variation->get_variation_attributes(),
                    'price' => $variation->get_price(),
                    'regular_price' => $variation->get_regular_price(),
                    'on_sale' => $variation->is_on_sale(),
                    'stock_status' => $variation->get_stock_status(),
                    'purchasable' => $variation->is_purchasable(),
                    'image' => $variation_image_id ? wp_get_attachment_url($variation_image_id) : null,
                ];
            }, $product->get_children());
            $result['variations'] = array_values(array_filter($result['variations']));
        }

        return $result;
    }

    public static function list_categories()
    {
        $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
        if (is_wp_error($terms)) {
            return rest_ensure_response([]);
        }

        return rest_ensure_response(array_map(function ($term) {
            $icon = get_term_meta($term->term_id, 'c767_icon', true);
            return [
                'slug' => $term->slug,
                'name' => $term->name,
                'acf' => ['icon' => $icon ?: 'ri-price-tag-3-line'],
            ];
        }, $terms));
    }

    // ---------- Headless checkout ----------

    public static function checkout(WP_REST_Request $request)
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
            $slug = sanitize_title((string) ($item['slug'] ?? ''));
            $qty = max(1, (int) ($item['qty'] ?? 1));
            $variation_id = (int) ($item['variationId'] ?? 0);

            // A variation ID (from a size/color pick) always takes
            // priority — adding the parent variable product instead would
            // silently order the wrong size/color, or fail outright, since
            // a variable product itself generally isn't purchasable.
            if ($variation_id) {
                $variation = wc_get_product($variation_id);
                if ($variation && $variation->is_type('variation')) {
                    $order->add_product($variation, $qty);
                    continue;
                }
            }

            $product_id = self::product_id_from_slug($slug);
            if (!$product_id) {
                continue;
            }
            $product = wc_get_product($product_id);
            if (!$product || !$product->is_purchasable()) {
                continue;
            }
            $order->add_product($product, $qty);
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

        do_action('c767_checkout_order_created', $order);

        return rest_ensure_response([
            'orderId' => $order->get_id(),
            'checkoutUrl' => $order->get_checkout_payment_url(),
            'total' => $order->get_total(),
        ]);
    }

    private static function product_id_from_slug($slug)
    {
        if (!$slug) {
            return 0;
        }
        $post = get_page_by_path($slug, OBJECT, 'product');
        return $post ? $post->ID : 0;
    }
}
