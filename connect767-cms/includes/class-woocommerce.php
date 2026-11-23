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
    const READY_MADE_CATEGORY_SLUG = 'ready-made-designs';
    const READY_MADE_META = '_c767_ready_made';
    const UNIFORM_CATEGORY_META = '_c767_uniform_category';

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

        add_action('woocommerce_product_options_general_product_data', [__CLASS__, 'render_ready_made_product_fields']);
        add_action('woocommerce_process_product_meta', [__CLASS__, 'save_ready_made_product_fields']);

        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function uniform_category_options()
    {
        return [
            '' => 'Choose a category',
            'soccer' => 'Soccer',
            'basketball' => 'Basketball',
            'netball' => 'Netball',
            'cricket' => 'Cricket',
            'goalkeeper' => 'Goalkeeper',
            'other' => 'Clothing & Other',
        ];
    }

    public static function minimum_order_quantity_for_category($category)
    {
        $minimums = [
            'soccer' => 22,
            'basketball' => 10,
            'netball' => 10,
            'cricket' => 20,
            'goalkeeper' => 1,
            'other' => 10,
        ];
        $category = sanitize_key((string) $category);
        return $minimums[$category] ?? 1;
    }

    public static function render_ready_made_product_fields()
    {
        echo '<div class="options_group">';
        woocommerce_wp_checkbox([
            'id' => self::READY_MADE_META,
            'label' => 'Ready-Made Uniform Design',
            'description' => 'Display this product on the Ready-Made Designs shop page and enforce its team-order minimum.',
        ]);
        woocommerce_wp_select([
            'id' => self::UNIFORM_CATEGORY_META,
            'label' => 'Uniform category',
            'description' => 'Controls the minimum order quantity used by the storefront and checkout.',
            'desc_tip' => true,
            'options' => self::uniform_category_options(),
        ]);
        echo '</div>';
    }

    public static function save_ready_made_product_fields($product_id)
    {
        if (!current_user_can('edit_post', $product_id)) {
            return;
        }

        $ready_made = isset($_POST[self::READY_MADE_META]) ? 'yes' : 'no';
        $category = isset($_POST[self::UNIFORM_CATEGORY_META])
            ? sanitize_key(wp_unslash($_POST[self::UNIFORM_CATEGORY_META]))
            : '';
        if (!array_key_exists($category, self::uniform_category_options())) {
            $category = '';
        }

        update_post_meta($product_id, self::READY_MADE_META, $ready_made);
        update_post_meta($product_id, self::UNIFORM_CATEGORY_META, $ready_made === 'yes' ? $category : '');

        $term = term_exists(self::READY_MADE_CATEGORY_SLUG, 'product_cat');
        if (!$term && $ready_made === 'yes') {
            $term = wp_insert_term('Ready-Made Designs', 'product_cat', ['slug' => self::READY_MADE_CATEGORY_SLUG]);
            if (is_array($term) && !empty($term['term_id'])) {
                update_term_meta((int) $term['term_id'], 'c767_icon', 'ri-layout-grid-line');
            }
        }
        $term_id = is_array($term) ? (int) $term['term_id'] : (int) $term;
        if ($term_id) {
            if ($ready_made === 'yes') {
                wp_set_object_terms($product_id, [$term_id], 'product_cat', true);
            } else {
                wp_remove_object_terms($product_id, [$term_id], 'product_cat');
            }
        }
    }

    private static function product_meta_id($product)
    {
        return $product && $product->is_type('variation') ? (int) $product->get_parent_id() : (int) $product->get_id();
    }

    private static function is_ready_made_product($product)
    {
        return $product && get_post_meta(self::product_meta_id($product), self::READY_MADE_META, true) === 'yes';
    }

    private static function ready_made_uniform_category($product)
    {
        return sanitize_key((string) get_post_meta(self::product_meta_id($product), self::UNIFORM_CATEGORY_META, true));
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

        register_rest_route(self::NAMESPACE_, '/checkout/local-dominica', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'local_dominica_checkout'],
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

        // Preserve the manual order set in WordPress (Products > Sorting).
        // The frontend applies the Featured-first grouping without losing this
        // catalog order inside the featured and non-featured groups.
        $products = wc_get_products([
            'status' => 'publish',
            'limit' => -1,
            'orderby' => 'menu_order',
            'order' => 'ASC',
        ]);
        return rest_ensure_response(array_map([__CLASS__, 'format_product'], $products));
    }

    private static function format_product($product)
    {
        $image_id = $product->get_image_id();
        $image_ids = array_values(array_unique(array_filter(array_merge(
            $image_id ? [$image_id] : [],
            $product->get_gallery_image_ids()
        ))));
        $description = $product->get_description();
        $description_mentions_size_guide = (bool) preg_match(
            '/size\s*(chart|guide)|sizing|measurement/i',
            wp_strip_all_tags($description . ' ' . $product->get_short_description())
        );
        $has_size_attribute = false;
        foreach ($product->get_attributes() as $attribute) {
            $attribute_name = self::normalize_image_match_text(wc_attribute_label($attribute->get_name()));
            if (in_array($attribute_name, ['size', 'sizes', 'sizing'], true)) {
                $has_size_attribute = true;
                break;
            }
        }
        $images = array_values(array_filter(array_map(function ($attachment_id) use ($description_mentions_size_guide, $has_size_attribute) {
            $src = wp_get_attachment_url($attachment_id);
            if (!$src) {
                return null;
            }

            $metadata = wp_get_attachment_metadata($attachment_id);
            $width = (int) ($metadata['width'] ?? 0);
            $height = (int) ($metadata['height'] ?? 0);
            $title = get_the_title($attachment_id);
            $alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
            $caption = wp_get_attachment_caption($attachment_id);
            $search_text = self::normalize_image_match_text(implode(' ', [
                $title,
                $alt,
                $caption,
                pathinfo(wp_parse_url($src, PHP_URL_PATH) ?: '', PATHINFO_FILENAME),
            ]));
            $explicit_size_chart = preg_match('/(sizechart|sizeguide|sizingchart|measurement)/', $search_text);
            $likely_legacy_chart = ($description_mentions_size_guide || $has_size_attribute)
                && $height > 0
                && ($width / $height) >= 2.5;

            return [
                'id' => $attachment_id,
                'src' => $src,
                'name' => $title,
                'alt' => $alt,
                'width' => $width,
                'height' => $height,
                'is_size_chart' => (bool) ($explicit_size_chart || $likely_legacy_chart),
            ];
        }, $image_ids)));
        if (empty($images)) {
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
            'description' => $description,
            'short_description' => $product->get_short_description(),
            'type' => $product->get_type(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'on_sale' => $product->is_on_sale(),
            'featured' => $product->is_featured(),
            'menu_order' => $product->get_menu_order(),
            'date_created' => $product->get_date_created()
                ? $product->get_date_created()->date(DATE_ATOM)
                : null,
            'average_rating' => $product->get_average_rating(),
            'rating_count' => $product->get_rating_count(),
            'stock_status' => $product->get_stock_status(),
            'stock_quantity' => $product->get_stock_quantity(),
            'backorders_allowed' => $product->backorders_allowed(),
            'purchasable' => $product->is_purchasable(),
            'categories' => $categories,
            'tags' => $tags,
            'images' => $images,
            'size_chart' => current(array_filter($images, function ($image) {
                return !empty($image['is_size_chart']);
            })) ?: null,
            'ready_made' => self::is_ready_made_product($product),
            'uniform_category' => self::ready_made_uniform_category($product),
            'minimum_order_quantity' => self::minimum_order_quantity_for_category(self::ready_made_uniform_category($product)),
        ];

        // Real size/color (etc.) support — previously this endpoint only
        // ever returned simple-product data, so a "T-Shirt" configured in
        // WooCommerce the normal way (a variable product with Size/Color
        // attributes) had no way for the frontend to show a size or color
        // picker at all, and "add to cart" had no variation ID to add.
        if ($product->is_type('variable')) {
            $color_image_map = self::build_color_image_map($product, $image_ids);
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

            $result['variations'] = array_map(function ($variation_id) use ($color_image_map) {
                $variation = wc_get_product($variation_id);
                if (!$variation) {
                    return null;
                }
                // A variation may manage its own stock (the normal setup for
                // size-specific quantities) or inherit inventory from its
                // parent. Always expose the effective stock owner so the
                // storefront can prevent the cart from exceeding what
                // WooCommerce will accept at checkout.
                $stock_owner_id = method_exists($variation, 'get_stock_managed_by_id')
                    ? (int) $variation->get_stock_managed_by_id()
                    : (int) $variation->get_id();
                $stock_owner = $stock_owner_id === (int) $variation->get_id()
                    ? $variation
                    : wc_get_product($stock_owner_id);
                if (!$stock_owner) {
                    $stock_owner = $variation;
                }
                // `get_image_id()` in view context inherits the parent product's
                // thumbnail when the variation itself has no image. That made
                // every color report the exact same URL. Prefer a genuinely
                // assigned variation image, then the matching parent-gallery
                // color image built below.
                $variation_image_id = (int) $variation->get_image_id('edit');
                if (!$variation_image_id && !empty($color_image_map)) {
                    foreach ($variation->get_variation_attributes() as $attribute_name => $value) {
                        if (self::is_color_attribute($attribute_name)) {
                            $color_key = self::normalize_image_match_text($value);
                            $variation_image_id = (int) ($color_image_map[$color_key] ?? 0);
                            break;
                        }
                    }
                }
                return [
                    'id' => $variation->get_id(),
                    'attributes' => $variation->get_variation_attributes(),
                    'price' => $variation->get_price(),
                    'regular_price' => $variation->get_regular_price(),
                    'on_sale' => $variation->is_on_sale(),
                    'stock_status' => $variation->get_stock_status(),
                    'stock_quantity' => $stock_owner->get_stock_quantity(),
                    'backorders_allowed' => $stock_owner->backorders_allowed(),
                    'purchasable' => $variation->is_purchasable(),
                    'image' => $variation_image_id ? wp_get_attachment_url($variation_image_id) : null,
                ];
            }, $product->get_children());
            $result['variations'] = array_values(array_filter($result['variations']));
        }

        return $result;
    }

    /**
     * Match a variable product's color options to its product-gallery images.
     *
     * A large part of the imported catalog stores one mockup per color in the
     * parent gallery, but leaves every WC variation image blank. WooCommerce's
     * normal getter then inherits the same parent thumbnail for every color.
     * Use descriptive filenames first ("navy-blue", "brown", etc.), then pair
     * any remaining colors with the remaining gallery images in catalog order.
     */
    private static function build_color_image_map($product, array $image_ids)
    {
        $color_options = [];
        foreach ($product->get_attributes() as $attribute) {
            if (!self::is_color_attribute($attribute->get_name())) {
                continue;
            }
            $color_options = $attribute->is_taxonomy()
                ? array_map(function ($term_id) use ($attribute) {
                    $term = get_term($term_id, $attribute->get_name());
                    return $term && !is_wp_error($term) ? $term->name : (string) $term_id;
                }, $attribute->get_options())
                : $attribute->get_options();
            break;
        }

        if (empty($color_options) || empty($image_ids)) {
            return [];
        }

        $candidates = [];
        foreach ($image_ids as $attachment_id) {
            $file = get_attached_file($attachment_id);
            $search_text = self::normalize_image_match_text(implode(' ', [
                get_the_title($attachment_id),
                get_post_meta($attachment_id, '_wp_attachment_image_alt', true),
                $file ? pathinfo($file, PATHINFO_FILENAME) : '',
            ]));
            if (strpos($search_text, 'sizechart') !== false || strpos($search_text, 'measurement') !== false) {
                continue;
            }
            $candidates[(int) $attachment_id] = $search_text;
        }

        $map = [];
        $used = [];

        // These legacy products keep their color photography in the parent
        // gallery and use camera-generated filenames for several colors. A
        // blind gallery-order fallback paired Navy with Milk/Cream, Black
        // with Chocolate, and Blue with a red crew-neck photo. Pin the
        // visually verified filename fragments before applying the generic
        // filename and order matching below. This remains product-wide: every
        // size variation for a color receives the same correct image.
        $verified_overrides = self::verified_color_image_overrides($product->get_slug());
        foreach ($verified_overrides as $color => $filename_fragment) {
            $color_key = self::normalize_image_match_text($color);
            $image_key = self::normalize_image_match_text($filename_fragment);
            foreach ($candidates as $attachment_id => $search_text) {
                if (!isset($used[$attachment_id]) && strpos($search_text, $image_key) !== false) {
                    $map[$color_key] = $attachment_id;
                    $used[$attachment_id] = true;
                    break;
                }
            }
        }

        $sortable_options = $color_options;
        usort($sortable_options, function ($a, $b) {
            return strlen(self::normalize_image_match_text($b)) <=> strlen(self::normalize_image_match_text($a));
        });

        foreach ($sortable_options as $option) {
            $color_key = self::normalize_image_match_text($option);
            if (isset($map[$color_key]) || strlen($color_key) < 3) {
                continue;
            }
            foreach ($candidates as $attachment_id => $search_text) {
                if (!isset($used[$attachment_id]) && strpos($search_text, $color_key) !== false) {
                    $map[$color_key] = $attachment_id;
                    $used[$attachment_id] = true;
                    break;
                }
            }
        }

        $remaining_images = array_values(array_filter(array_keys($candidates), function ($attachment_id) use ($used) {
            return !isset($used[$attachment_id]);
        }));
        foreach ($color_options as $option) {
            $color_key = self::normalize_image_match_text($option);
            if (!isset($map[$color_key]) && !empty($remaining_images)) {
                $map[$color_key] = array_shift($remaining_images);
            }
        }

        return $map;
    }

    private static function verified_color_image_overrides($product_slug)
    {
        $overrides = [
            'unisex-stay-connected-t-shirt' => [
                'black' => 'WhatsAppImage2023-01-19at1.55.11AM',
                'chocolate' => 'WhatsAppImage2023-01-19at1.56.56AM',
                'cream' => 'MilkC767',
                'navy' => 'WhatsAppImage2023-01-19at1.52.39AM',
                'ocean-blue' => 'BlueC767',
                'white' => 'WhiteC767',
            ],
            'unisex-sissarou-t-shirt' => [
                'black' => 'WhatsAppImage2023-01-19at2.11.09AM',
                'chocolate' => 'WhatsAppImage2023-01-19at2.06.55AM_1',
                'cream' => 'Milkparrot',
                'green' => 'Greenparrot',
                'navy' => 'WhatsAppImage2023-01-19at2.08.59AM',
                'white' => 'Whiteparrot',
            ],
            'cotton-crew-neck-t-shirts' => [
                'blue' => '174A0524-Edit-scaled-1-scaled',
                'red' => '174A9975-Edit-scaled-1-scaled',
            ],
        ];

        return $overrides[$product_slug] ?? [];
    }

    private static function is_color_attribute($name)
    {
        $name = strtolower((string) $name);
        return strpos($name, 'color') !== false || strpos($name, 'colour') !== false;
    }

    private static function normalize_image_match_text($value)
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower(remove_accents((string) $value)));
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

    /**
     * Build one shipment-ready WooCommerce order for every Shop payment path.
     * Stripe, PayPal, and the hosted WooCommerce fallback all call this method
     * so customer addresses, shipping lines, taxes, and totals stay identical.
     */
    public static function build_pending_order(array $items, $email, array $shipping, $allow_local_arrangement = false, array $order_context = [])
    {
        if (empty($items)) {
            return new WP_Error('c767_empty_cart', 'Cart is empty.', ['status' => 400]);
        }

        $email = sanitize_email((string) $email);
        if (!$email || !is_email($email)) {
            return new WP_Error('c767_invalid_email', 'A valid email address is required.', ['status' => 400]);
        }

        $address = self::sanitize_shipping_address($shipping);
        if (is_wp_error($address)) {
            return $address;
        }

        $order = wc_create_order();
        if (is_wp_error($order)) {
            return new WP_Error('c767_order_failed', $order->get_error_message(), ['status' => 400]);
        }

        foreach ($items as $item) {
            $slug = sanitize_title((string) ($item['slug'] ?? ''));
            $qty = max(1, (int) ($item['qty'] ?? 1));
            $variation_id = (int) ($item['variationId'] ?? 0);

            if ($variation_id) {
                $variation = wc_get_product($variation_id);
                if ($variation && $variation->is_type('variation') && $variation->is_purchasable()) {
                    $stock_check = self::validate_requested_stock($variation, $qty);
                    if (is_wp_error($stock_check)) {
                        $order->delete(true);
                        return $stock_check;
                    }
                    $order->add_product($variation, $qty);
                    continue;
                }
            }

            $product_id = self::product_id_from_slug($slug);
            $product = $product_id ? wc_get_product($product_id) : null;
            if ($product && $product->is_purchasable()) {
                $stock_check = self::validate_requested_stock($product, $qty);
                if (is_wp_error($stock_check)) {
                    $order->delete(true);
                    return $stock_check;
                }
                $order->add_product($product, $qty);
            }
        }

        if (count($order->get_items()) === 0) {
            $order->delete(true);
            return new WP_Error('c767_no_valid_items', 'None of the cart items matched a real product.', ['status' => 400]);
        }

        $minimum_check = self::validate_ready_made_order_minimums($order);
        if (is_wp_error($minimum_check)) {
            $order->delete(true);
            return $minimum_check;
        }

        $roster = self::validate_ready_made_roster($order, (array) ($order_context['readyMadeRoster'] ?? []));
        if (is_wp_error($roster)) {
            $order->delete(true);
            return $roster;
        }
        if (!empty($roster)) {
            $order->update_meta_data('_c767_ready_made_roster', wp_json_encode($roster));
            $order->update_meta_data('Connect767 Team Roster', sprintf('%d roster row%s attached', count($roster), count($roster) === 1 ? '' : 's'));
            $roster_lines = array_map(function ($row) {
                return sprintf(
                    '%s%s — %s top / %s bottom / %s sleeve — Qty %d%s',
                    $row['name'],
                    $row['number'] !== '' ? ' #' . $row['number'] : '',
                    $row['shirt_size'],
                    $row['bottom_size'],
                    $row['sleeve'],
                    $row['quantity'],
                    $row['product_title'] !== '' ? ' — ' . $row['product_title'] : ''
                );
            }, $roster);
            $order->add_order_note("Ready-Made Team Roster:\n" . implode("\n", $roster_lines), false);
        }

        $ready_made_units = self::ready_made_unit_counts($order);
        $ready_made_extras = self::validate_ready_made_extras($ready_made_units, (array) ($order_context['readyMadeExtras'] ?? []), $roster);
        if (is_wp_error($ready_made_extras)) {
            $order->delete(true);
            return $ready_made_extras;
        }
        if (!empty($ready_made_units)) {
            $address_check = C767_Uniform_Checkout::validate_north_american_address($address);
            if (is_wp_error($address_check)) {
                $order->delete(true);
                return $address_check;
            }
        }

        if ($ready_made_extras['supporter_total'] > 0) {
            $fee = new WC_Order_Item_Fee();
            $fee->set_name(sprintf('Supporter jerseys · %d × $15.00', $ready_made_extras['supporter_quantity']));
            $fee->set_amount($ready_made_extras['supporter_total']);
            $fee->set_total($ready_made_extras['supporter_total']);
            $fee->set_tax_status('taxable');
            $fee->add_meta_data('Sizes', $ready_made_extras['supporter_summary'], true);
            $order->add_item($fee);
        }
        if ($ready_made_extras['extra_socks_total'] > 0) {
            $fee = new WC_Order_Item_Fee();
            $fee->set_name(sprintf('Extra socks · %d × $5.00', $ready_made_extras['extra_socks']));
            $fee->set_amount($ready_made_extras['extra_socks_total']);
            $fee->set_total($ready_made_extras['extra_socks_total']);
            $fee->set_tax_status('taxable');
            $order->add_item($fee);
        }
        $production_fees = [
            ['total' => $ready_made_extras['polo_collar_total'], 'name' => sprintf('Polo style collars · %d × $2.00', $ready_made_extras['kit_quantity'])],
            ['total' => $ready_made_extras['long_sleeve_total'], 'name' => sprintf('Long-sleeve upgrades · %d × $2.00', $ready_made_extras['long_sleeve_quantity'])],
            ['total' => $ready_made_extras['embroidery_total'], 'name' => sprintf('Embroidered team logos · %d × $1.50', $ready_made_extras['kit_quantity'])],
            ['total' => $ready_made_extras['inside_collar_total'], 'name' => sprintf('Inside-collar logo or message · %d × $1.00', $ready_made_extras['kit_quantity'])],
        ];
        foreach ($production_fees as $production_fee) {
            if ($production_fee['total'] <= 0) continue;
            $fee = new WC_Order_Item_Fee();
            $fee->set_name($production_fee['name']);
            $fee->set_amount($production_fee['total']);
            $fee->set_total($production_fee['total']);
            $fee->set_tax_status('taxable');
            $order->add_item($fee);
        }
        if (!empty($ready_made_units)) {
            $collar_attachment = $ready_made_extras['inside_collar_attachment'];
            if ($collar_attachment) {
                $order->update_meta_data('_c767_ready_made_collar_attachment', wp_json_encode($collar_attachment));
            }
            $stored_extras = $ready_made_extras;
            $stored_extras['inside_collar_attachment'] = $collar_attachment ? array_diff_key($collar_attachment, ['src' => true]) : null;
            $order->update_meta_data('_c767_ready_made_extras', wp_json_encode($stored_extras));
            if ($ready_made_extras['inside_collar_enabled']) {
                $order->add_order_note('Inside-collar customization: ' . ($ready_made_extras['inside_collar_message'] !== '' ? $ready_made_extras['inside_collar_message'] : 'Artwork attached'), false);
            }
        }

        $billing = $address;
        $billing['email'] = $email;
        $order->set_address($billing, 'billing');
        $order->set_address($address, 'shipping');
        $order->calculate_totals(false);

        if ($allow_local_arrangement && $address['country'] === 'DM') {
            $shipping_item = new WC_Order_Item_Shipping();
            $shipping_item->set_method_title('Local delivery / pickup arrangement');
            $shipping_item->set_method_id('c767_local_arrangement');
            $shipping_item->set_total(0);
            $shipping_item->set_taxes([]);
        } elseif (!empty($ready_made_units)) {
            $shipping_units = array_sum($ready_made_units) + $ready_made_extras['supporter_quantity'];
            $shipping_rate = C767_Uniform_Checkout::uniform_shipping_rate($address['country'], $shipping_units);
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
        } else {
            $shipping_rate = self::calculate_shipping_rate($order, $address);
            if (is_wp_error($shipping_rate)) {
                $order->delete(true);
                return $shipping_rate;
            }
            $shipping_item = new WC_Order_Item_Shipping();
            $shipping_item->set_method_title($shipping_rate->get_label());
            $shipping_item->set_method_id($shipping_rate->get_method_id());
            $shipping_item->set_instance_id($shipping_rate->get_instance_id());
            $shipping_item->set_total((float) $shipping_rate->get_cost());
            $shipping_item->set_taxes($shipping_rate->get_taxes());
        }
        $order->add_item($shipping_item);

        $order->calculate_totals();
        $order->set_status('pending');
        $order->save();

        return $order;
    }

    /**
     * Recheck stock on the server immediately before creating an order.
     * The storefront warning is helpful feedback, but checkout must remain
     * authoritative when inventory changes in another session or a request
     * is submitted without using the storefront UI.
     */
    private static function validate_requested_stock($product, $quantity)
    {
        if (!$product->is_in_stock()) {
            return new WP_Error(
                'c767_out_of_stock',
                sprintf('%s is currently out of stock.', $product->get_name()),
                ['status' => 409]
            );
        }

        if (!$product->has_enough_stock($quantity)) {
            $available = $product->get_stock_quantity();
            $message = is_numeric($available)
                ? sprintf('Only %d of %s are currently available.', max(0, (int) $available), $product->get_name())
                : sprintf('%s is not available in the requested quantity.', $product->get_name());

            return new WP_Error('c767_insufficient_stock', $message, ['status' => 409]);
        }

        return true;
    }

    private static function validate_ready_made_order_minimums(WC_Order $order)
    {
        $totals = [];
        foreach ($order->get_items('line_item') as $item) {
            $product = $item->get_product();
            if (!self::is_ready_made_product($product)) {
                continue;
            }
            $category = self::ready_made_uniform_category($product);
            if (!$category) {
                return new WP_Error(
                    'c767_ready_made_category_required',
                    sprintf('The ready-made design “%s” needs a uniform category before it can be ordered.', $item->get_name()),
                    ['status' => 400]
                );
            }
            $totals[$category] = ($totals[$category] ?? 0) + max(1, (int) $item->get_quantity());
        }

        if (!empty($totals) && get_current_user_id() <= 0) {
            return new WP_Error(
                'c767_ready_made_account_required',
                'Sign in before ordering a ready-made uniform design.',
                ['status' => 401]
            );
        }

        foreach ($totals as $category => $quantity) {
            $minimum = self::minimum_order_quantity_for_category($category);
            if ($quantity < $minimum) {
                return new WP_Error(
                    'c767_ready_made_minimum',
                    sprintf('Minimum order: %d ready-made %s units. Your cart currently has %d.', $minimum, $category, $quantity),
                    ['status' => 400, 'category' => $category, 'minimumQuantity' => $minimum, 'quantity' => $quantity]
                );
            }
        }

        if (!empty($totals['goalkeeper']) && empty($totals['soccer'])) {
            return new WP_Error(
                'c767_goalkeeper_requires_soccer',
                'Ready-made goalkeeper designs must be ordered with a ready-made soccer order.',
                ['status' => 400]
            );
        }

        return true;
    }

    private static function validate_ready_made_roster(WC_Order $order, array $rows)
    {
        $required = 0;
        foreach ($order->get_items('line_item') as $item) {
            if (self::is_ready_made_product($item->get_product())) {
                $required += max(1, (int) $item->get_quantity());
            }
        }
        if ($required === 0) {
            return [];
        }
        if (empty($rows)) {
            return new WP_Error('c767_ready_made_roster_required', 'Complete the Team Roster before checking out.', ['status' => 400]);
        }

        $clean = [];
        $assigned = 0;
        foreach ($rows as $row) {
            $name = sanitize_text_field((string) ($row['name'] ?? ''));
            $quantity = max(0, (int) ($row['quantity'] ?? 0));
            if ($name === '' || $quantity < 1) {
                return new WP_Error('c767_ready_made_roster_invalid', 'Every Team Roster row needs a player name and quantity.', ['status' => 400]);
            }
            $assigned += $quantity;
            $clean[] = [
                'product_slug' => sanitize_title((string) ($row['productSlug'] ?? '')),
                'product_title' => sanitize_text_field((string) ($row['productTitle'] ?? '')),
                'name' => $name,
                'number' => sanitize_text_field((string) ($row['number'] ?? '')),
                'shirt_size' => sanitize_text_field((string) ($row['shirtSize'] ?? '')),
                'bottom_size' => sanitize_text_field((string) ($row['bottomSize'] ?? '')),
                'sleeve' => (($row['sleeve'] ?? 'Short') === 'Long') ? 'Long' : 'Short',
                'quantity' => $quantity,
                'notes' => sanitize_textarea_field((string) ($row['notes'] ?? '')),
            ];
        }
        if ($assigned !== $required) {
            return new WP_Error('c767_ready_made_roster_quantity', sprintf('Team Roster quantity must equal the %d ready-made uniforms in this order.', $required), ['status' => 400]);
        }
        return $clean;
    }

    private static function ready_made_unit_counts(WC_Order $order)
    {
        $counts = [];
        foreach ($order->get_items('line_item') as $item) {
            $product = $item->get_product();
            if (!self::is_ready_made_product($product)) {
                continue;
            }
            $category = self::ready_made_uniform_category($product);
            if ($category) {
                $counts[$category] = ($counts[$category] ?? 0) + max(1, (int) $item->get_quantity());
            }
        }
        return $counts;
    }

    private static function validate_ready_made_extras(array $unit_counts, array $extras, array $roster = [])
    {
        if (empty($unit_counts)) {
            return [
                'required_socks' => 0,
                'socks_quantity' => 0,
                'extra_socks' => 0,
                'extra_socks_total' => 0.00,
                'supporter_jerseys' => [],
                'supporter_quantity' => 0,
                'supporter_total' => 0.00,
                'supporter_summary' => '',
                'kit_quantity' => 0,
                'polo_collar' => false,
                'polo_collar_total' => 0.00,
                'mixed_sleeves' => false,
                'long_sleeve_quantity' => 0,
                'long_sleeve_total' => 0.00,
                'embroidered_logo' => false,
                'embroidery_total' => 0.00,
                'inside_collar_enabled' => false,
                'inside_collar_message' => '',
                'inside_collar_attachment' => null,
                'inside_collar_total' => 0.00,
            ];
        }
        $required_socks = (int) (($unit_counts['soccer'] ?? 0) + ($unit_counts['goalkeeper'] ?? 0));
        $socks_quantity = $required_socks > 0 ? max(0, (int) ($extras['socksQuantity'] ?? 0)) : 0;
        if ($required_socks > 0 && $socks_quantity < $required_socks) {
            return new WP_Error(
                'c767_ready_made_socks_required',
                sprintf('Sock quantity must be at least %d to match the full-uniform order.', $required_socks),
                ['status' => 400]
            );
        }

        $supporter_rows = [];
        $supporter_quantity = 0;
        $allowed_sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
        if (rest_sanitize_boolean($extras['supporterEnabled'] ?? false)) {
            foreach ((array) ($extras['supporterJerseys'] ?? []) as $row) {
                $size = sanitize_text_field((string) ($row['size'] ?? ''));
                $quantity = max(0, (int) ($row['quantity'] ?? 0));
                if (in_array($size, $allowed_sizes, true) && $quantity > 0) {
                    $supporter_rows[] = ['size' => $size, 'quantity' => $quantity];
                    $supporter_quantity += $quantity;
                }
            }
            if ($supporter_quantity < 1) {
                return new WP_Error('c767_ready_made_supporter_required', 'Add at least one supporter jersey size and quantity.', ['status' => 400]);
            }
        }

        $extra_socks = max(0, $socks_quantity - $required_socks);
        $kit_quantity = array_sum($unit_counts);
        $polo_collar = rest_sanitize_boolean($extras['poloCollar'] ?? false);
        $mixed_sleeves = rest_sanitize_boolean($extras['mixedSleeves'] ?? false);
        $long_sleeve_quantity = 0;
        if ($mixed_sleeves) {
            foreach ($roster as $row) {
                if (($row['sleeve'] ?? 'Short') === 'Long') {
                    $long_sleeve_quantity += max(0, (int) ($row['quantity'] ?? 0));
                }
            }
        }
        $embroidered_logo = rest_sanitize_boolean($extras['embroideredLogo'] ?? false);
        $inside_collar_enabled = rest_sanitize_boolean($extras['insideCollarEnabled'] ?? false);
        $inside_collar_message = $inside_collar_enabled ? sanitize_text_field((string) ($extras['insideCollarMessage'] ?? '')) : '';
        $inside_collar_attachment = $inside_collar_enabled
            ? C767_REST_Uniform_Quotes::sanitize_collar_attachment($extras['insideCollarAttachment'] ?? null)
            : null;
        if ($inside_collar_enabled && $inside_collar_message === '' && !$inside_collar_attachment) {
            return new WP_Error(
                'c767_ready_made_inside_collar_required',
                'Enter an inside-collar message or attach a valid logo/artwork file.',
                ['status' => 400]
            );
        }
        return [
            'required_socks' => $required_socks,
            'socks_quantity' => $socks_quantity,
            'extra_socks' => $extra_socks,
            'extra_socks_total' => $extra_socks * 5.00,
            'supporter_jerseys' => $supporter_rows,
            'supporter_quantity' => $supporter_quantity,
            'supporter_total' => $supporter_quantity * 15.00,
            'supporter_summary' => implode(', ', array_map(function ($row) {
                return $row['size'] . ' × ' . $row['quantity'];
            }, $supporter_rows)),
            'kit_quantity' => $kit_quantity,
            'polo_collar' => $polo_collar,
            'polo_collar_total' => $polo_collar ? $kit_quantity * 2.00 : 0.00,
            'mixed_sleeves' => $mixed_sleeves,
            'long_sleeve_quantity' => $long_sleeve_quantity,
            'long_sleeve_total' => $long_sleeve_quantity * 2.00,
            'embroidered_logo' => $embroidered_logo,
            'embroidery_total' => $embroidered_logo ? $kit_quantity * 1.50 : 0.00,
            'inside_collar_enabled' => $inside_collar_enabled,
            'inside_collar_message' => $inside_collar_message,
            'inside_collar_attachment' => $inside_collar_attachment,
            'inside_collar_total' => $inside_collar_enabled ? $kit_quantity * 1.00 : 0.00,
        ];
    }

    public static function sanitize_shipping_address(array $shipping)
    {
        $address = [
            'first_name' => sanitize_text_field((string) ($shipping['firstName'] ?? '')),
            'last_name' => sanitize_text_field((string) ($shipping['lastName'] ?? '')),
            'company' => sanitize_text_field((string) ($shipping['company'] ?? '')),
            'address_1' => sanitize_text_field((string) ($shipping['address1'] ?? '')),
            'address_2' => sanitize_text_field((string) ($shipping['address2'] ?? '')),
            'city' => sanitize_text_field((string) ($shipping['city'] ?? '')),
            'state' => strtoupper(sanitize_text_field((string) ($shipping['state'] ?? ''))),
            'postcode' => sanitize_text_field((string) ($shipping['postcode'] ?? '')),
            'country' => strtoupper(sanitize_text_field((string) ($shipping['country'] ?? 'US'))),
            'phone' => wc_sanitize_phone_number((string) ($shipping['phone'] ?? '')),
        ];

        $required_fields = ['first_name', 'last_name', 'address_1', 'city', 'country'];
        if ($address['country'] === 'US') {
            $required_fields[] = 'state';
            $required_fields[] = 'postcode';
        }

        foreach ($required_fields as $field) {
            if ($address[$field] === '') {
                return new WP_Error('c767_incomplete_shipping_address', 'Complete every required shipping-address field.', ['status' => 400]);
            }
        }

        $countries = WC()->countries->get_countries();
        if (!isset($countries[$address['country']])) {
            return new WP_Error('c767_invalid_shipping_country', 'Choose a valid shipping country.', ['status' => 400]);
        }

        if ($address['country'] === 'US') {
            $states = WC()->countries->get_states('US');
            if (!$address['state'] || !isset($states[$address['state']])) {
                return new WP_Error('c767_invalid_shipping_state', 'Choose a valid U.S. state.', ['status' => 400]);
            }
        }

        return $address;
    }

    public static function calculate_shipping_rate(WC_Order $order, array $address)
    {
        $contents = [];
        $contents_cost = 0.0;

        foreach ($order->get_items('line_item') as $item_id => $item) {
            $product = $item->get_product();
            if (!$product || !$product->needs_shipping()) {
                continue;
            }
            $contents[$item_id] = [
                'key' => (string) $item_id,
                'product_id' => $item->get_product_id(),
                'variation_id' => $item->get_variation_id(),
                'variation' => [],
                'quantity' => $item->get_quantity(),
                'data' => $product,
                'line_total' => (float) $item->get_total(),
                'line_tax' => 0,
                'line_subtotal' => (float) $item->get_subtotal(),
                'line_subtotal_tax' => 0,
            ];
            $contents_cost += (float) $item->get_total();
        }

        if (empty($contents)) {
            return new WP_Error('c767_no_shippable_items', 'This order does not contain shippable products.', ['status' => 400]);
        }

        $package = [
            'contents' => $contents,
            'contents_cost' => $contents_cost,
            'applied_coupons' => [],
            'user' => ['ID' => get_current_user_id()],
            'destination' => [
                'country' => $address['country'],
                'state' => $address['state'],
                'postcode' => $address['postcode'],
                'city' => $address['city'],
                'address' => $address['address_1'],
                'address_1' => $address['address_1'],
                'address_2' => $address['address_2'],
            ],
        ];

        $zone = WC_Shipping_Zones::get_zone_matching_package($package);
        $rates = [];
        foreach ($zone->get_shipping_methods(true) as $method) {
            $method->rates = [];
            $method->calculate_shipping($package);
            foreach ($method->rates as $rate) {
                $rates[] = $rate;
            }
        }

        if (empty($rates)) {
            return new WP_Error('c767_no_shipping_method', 'No shipping method is available for this address.', ['status' => 400]);
        }

        usort($rates, function ($a, $b) {
            return (float) $a->get_cost() <=> (float) $b->get_cost();
        });

        return $rates[0];
    }

    public static function checkout(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('shop-hosted');
        if (is_wp_error($limited)) {
            return $limited;
        }
        $items = (array) $request->get_param('items');
        $shipping = (array) $request->get_param('shipping');
        $order = self::build_pending_order($items, $request->get_param('email'), $shipping, false, [
            'readyMadeRoster' => (array) $request->get_param('readyMadeRoster'),
            'readyMadeExtras' => (array) $request->get_param('readyMadeExtras'),
        ]);
        if (is_wp_error($order)) {
            return $order;
        }

        do_action('c767_checkout_order_created', $order);

        return rest_ensure_response([
            'orderId' => $order->get_id(),
            'checkoutUrl' => $order->get_checkout_payment_url(),
            'total' => $order->get_total(),
        ]);
    }

    /**
     * Reserve a normal Shop order for payment in person in Dominica.
     * The country is checked again server-side so this route cannot be used
     * to bypass online payment for orders outside Dominica.
     */
    public static function local_dominica_checkout(WP_REST_Request $request)
    {
        $limited = C767_Stripe_Checkout::check_public_rate_limit('shop-local-dominica');
        if (is_wp_error($limited)) {
            return $limited;
        }

        $shipping = (array) $request->get_param('shipping');
        $order = self::build_pending_order(
            (array) $request->get_param('items'),
            $request->get_param('email'),
            $shipping,
            true,
            [
                'readyMadeRoster' => (array) $request->get_param('readyMadeRoster'),
                'readyMadeExtras' => (array) $request->get_param('readyMadeExtras'),
            ]
        );
        if (is_wp_error($order)) {
            return $order;
        }

        if ($order->get_shipping_country() !== 'DM') {
            $order->delete(true);
            return new WP_Error(
                'c767_local_payment_country',
                'Pay Locally in Dominica is only available for delivery addresses in Dominica.',
                ['status' => 400]
            );
        }

        $instructions = 'Complete payment locally in Dominica. The Connect767 team will email the customer with the payment location and instructions.';
        $order->set_payment_method('c767_local_dominica');
        $order->set_payment_method_title('Pay Locally in Dominica');
        $order->set_customer_note($instructions);
        $order->update_meta_data('_c767_local_dominica_payment', 'yes');
        $order->save();
        $order->update_status('on-hold', $instructions, true);

        do_action('c767_checkout_order_created', $order);

        return rest_ensure_response([
            'orderId' => $order->get_id(),
            'status' => $order->get_status(),
            'subtotal' => (float) $order->get_subtotal(),
            'tax' => (float) $order->get_total_tax(),
            'shipping' => (float) $order->get_shipping_total(),
            'total' => (float) $order->get_total(),
            'currency' => $order->get_currency(),
            'instructions' => $instructions,
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
