<?php
/**
 * One-click sample content importer. Seeds listings, listing categories,
 * blog posts + categories, uniform templates + sports, and (if
 * WooCommerce is active) products + product categories — from the exact
 * same fixture data the React frontend ships with locally
 * (src/data/*.js), exported to JSON in this plugin's /data folder. This
 * means the live backend and the frontend's offline fallback show
 * identical content, so switching VITE_WP_BASE_URL on/off is seamless
 * during development.
 *
 * Idempotent: re-running skips anything already imported (matched by a
 * `c767_seed_slug` meta key), so it's safe to click more than once.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Importer
{
    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'add_admin_page'], 10);
        add_action('admin_post_c767_import_sample_content', [__CLASS__, 'handle_import']);
        add_action('admin_post_c767_cleanup_stale_content', [__CLASS__, 'handle_cleanup']);
    }

    /**
     * The importer only ever adds content matched by `c767_seed_slug` — it
     * never removes anything, even if a slug disappears from the current
     * fixture data (e.g. the 12 placeholder listings that existed before
     * this plugin's data was trimmed down to 3 real ones). Re-running the
     * importer after fixture data changes doesn't clean up what's no
     * longer there. This does: for each seeded post type, trash any
     * `c767_seed_slug`-tagged post whose slug isn't in the *current*
     * fixture JSON, leaving anything the admin created manually
     * (no seed marker) completely untouched.
     */
    public static function handle_cleanup()
    {
        if (!current_user_can('manage_options') || !check_admin_referer('c767_cleanup_stale_content')) {
            wp_die('Not allowed.');
        }

        $current_slugs = [
            'listing' => wp_list_pluck(self::load_json('listings.json'), 'slug'),
            'post' => wp_list_pluck(self::load_json('blog-posts.json'), 'slug'),
            'uniform_template' => wp_list_pluck(self::load_json('uniform-templates.json'), 'slug'),
            'product' => wp_list_pluck(self::load_json('products.json'), 'slug'),
        ];

        $removed = 0;
        foreach ($current_slugs as $post_type => $keep_slugs) {
            $seeded = get_posts([
                'post_type' => $post_type,
                'post_status' => 'any',
                'numberposts' => -1,
                'meta_key' => 'c767_seed_slug',
            ]);
            foreach ($seeded as $post) {
                $seed_slug = get_post_meta($post->ID, 'c767_seed_slug', true);
                if ($seed_slug && !in_array($seed_slug, $keep_slugs, true)) {
                    wp_trash_post($post->ID);
                    $removed++;
                }
            }
        }

        wp_safe_redirect(add_query_arg(
            ['page' => 'connect767-import', 'cleaned' => $removed],
            admin_url('admin.php')
        ));
        exit;
    }

    public static function add_admin_page()
    {
        add_submenu_page(
            'connect767-cms',
            'Import Sample Content',
            'Import Sample Content',
            'manage_options',
            'connect767-import',
            [__CLASS__, 'render_admin_page']
        );
    }

    public static function render_admin_page()
    {
        $imported = get_option('c767_sample_content_imported_at');
        ?>
        <div class="wrap">
            <h1>Import Sample Content</h1>
            <p>This plugin powers the Connect767 headless React frontend: listings, the Uniform
                Studio's templates, blog content, auth, AI matching, and (with WooCommerce active)
                shop products and checkout.</p>

            <?php if (isset($_GET['cleaned'])) : ?>
                <div class="notice notice-success is-dismissible">
                    <p><?php echo esc_html((int) $_GET['cleaned']); ?> outdated item(s) moved to trash.</p>
                </div>
            <?php endif; ?>

            <h2>Sample content</h2>
            <?php if ($imported) : ?>
                <p>Sample content was last imported on
                    <strong><?php echo esc_html(date_i18n('F j, Y g:i a', $imported)); ?></strong>.
                    Re-running is safe — anything already imported is skipped.</p>
            <?php else : ?>
                <p>No sample content imported yet. This seeds the full 7-category / 191-industry
                    taxonomy and 3 directory listings — all real, client-provided businesses with
                    full profiles (Kalinago Tours, Finance Focus Consultancy, and Catherine
                    Lewis) — plus 9 blog posts (including 3 real community spotlights) and 6 uniform templates. All placeholder/dummy
                    listings and shop products have been removed; the shop stays empty until real
                    products are added the same way (see the frontend's README.md).</p>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="c767_import_sample_content" />
                <?php wp_nonce_field('c767_import_sample_content'); ?>
                <?php submit_button($imported ? 'Re-run sample content import' : 'Import sample content'); ?>
            </form>

            <h2>Remove outdated content</h2>
            <p class="description">If the fixture data changed since you last imported (for
                example, placeholder listings were replaced with real ones), re-running the
                import above won't remove what's no longer current — it only ever adds. This
                finds anything this plugin previously imported (tagged with a
                <code>c767_seed_slug</code>) whose slug isn't in the <em>current</em> fixture
                data anymore, and moves it to trash. Anything you created manually is never
                touched.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" onsubmit="return confirm('Move outdated sample content to trash? This only affects previously-imported items no longer in the current fixture data.');">
                <input type="hidden" name="action" value="c767_cleanup_stale_content" />
                <?php wp_nonce_field('c767_cleanup_stale_content'); ?>
                <?php submit_button('Remove outdated sample content', 'secondary'); ?>
            </form>

            <p><a href="<?php echo esc_url(admin_url('admin.php?page=connect767-cms')); ?>">&larr; Back to Connect767 dashboard</a></p>
        </div>
        <?php
    }

    public static function handle_import()
    {
        if (!current_user_can('manage_options') || !check_admin_referer('c767_import_sample_content')) {
            wp_die('Not allowed.');
        }

        self::import_listings();
        self::import_blog();
        self::import_uniform_studio();
        if (class_exists('WooCommerce')) {
            self::import_shop();
        }

        update_option('c767_sample_content_imported_at', time());

        wp_safe_redirect(add_query_arg(['page' => 'connect767-import', 'imported' => '1'], admin_url('admin.php')));
        exit;
    }

    // ---------- Helpers ----------

    private static function load_json($filename)
    {
        $path = C767_PLUGIN_DIR . 'data/' . $filename;
        if (!file_exists($path)) {
            return [];
        }
        $data = json_decode(file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    /**
     * The fixture JSON mirrors the React app's src/data/*.js exactly,
     * including a handful of real (non-readdy.ai) listings whose images are
     * local paths like `/uploads/kalinago-tours-walking.jpeg` — real only in
     * the frontend's own `public/` folder, not reachable from a separate
     * WordPress install. Those specific images are bundled with this plugin
     * under assets/real-listings/, so resolve `/uploads/...` references to
     * that URL instead. Remote (readdy.ai) URLs pass through unchanged.
     */
    private static function resolve_image_url($url)
    {
        if (strpos($url, '/uploads/') === 0) {
            return plugins_url('assets/real-listings/' . basename($url), C767_PLUGIN_FILE);
        }
        return $url;
    }

    /** Finds an existing post by our seed marker so re-imports don't duplicate. */
    private static function find_seeded_post($seed_slug, $post_type)
    {
        $existing = get_posts([
            'post_type' => $post_type,
            'post_status' => 'any',
            'meta_key' => 'c767_seed_slug',
            'meta_value' => $seed_slug,
            'numberposts' => 1,
        ]);
        return $existing ? $existing[0] : null;
    }

    private static function ensure_term($name, $taxonomy, $icon = null, $parent = 0)
    {
        // Passing $parent disambiguates name collisions between a top-level
        // category and an industry that happens to share the same name
        // under a different category (e.g. "Fitness" is both one of the 7
        // top-level categories AND, after correcting the source
        // spreadsheet's "Fitneess" typo, an industry under "Events"). A
        // parent-blind term_exists() lookup would find the wrong one and
        // nest the whole Fitness category as a child of Events.
        $term = term_exists($name, $taxonomy, $parent);
        if (!$term) {
            $args = $parent ? ['parent' => $parent] : [];
            $term = wp_insert_term($name, $taxonomy, $args);
        }
        if (is_wp_error($term)) {
            return 0;
        }
        // term_exists()/wp_insert_term() return term_id as a numeric string
        // (straight from the DB layer) — wp_set_object_terms() later does a
        // strict is_int() check to decide "is this a term ID or a term
        // name/slug to look up", so an uncast numeric string is silently
        // treated as a *name* and creates a garbage new term. Cast here so
        // every caller gets a real int.
        $term_id = is_array($term) ? (int) $term['term_id'] : (int) $term;
        if ($icon) {
            update_term_meta($term_id, 'c767_icon', $icon);
        }
        return $term_id;
    }

    // ---------- Listings ----------

    /**
     * Builds the full hierarchical taxonomy — 26 top-level categories with
     * 191 industries nested under them — from category-taxonomy.json (the
     * same canonical list src/data/industries.js in the frontend ships
     * with). Returns a lookup of slug => term_id for both categories and
     * industries so import_listings() can assign the right terms by ID
     * (safer than by name across a hierarchical taxonomy).
     */
    private static function import_listing_categories()
    {
        $term_ids = [];
        foreach (self::load_json('category-taxonomy.json') as $cat) {
            $cat_term_id = self::ensure_term($cat['label'], 'listing_category', $cat['icon'] ?? null);
            $term_ids[$cat['slug']] = $cat_term_id;

            foreach ($cat['industries'] as $industry) {
                $industry_term = term_exists($industry['label'], 'listing_category', $cat_term_id);
                if (!$industry_term) {
                    $industry_term = wp_insert_term($industry['label'], 'listing_category', [
                        'parent' => $cat_term_id,
                    ]);
                }
                if (!is_wp_error($industry_term)) {
                    $term_ids[$industry['slug']] = is_array($industry_term)
                        ? (int) $industry_term['term_id']
                        : (int) $industry_term;
                }
            }
        }
        return $term_ids;
    }

    private static function import_listings()
    {
        $listings = self::load_json('listings.json');
        $details = self::load_json('listing-details.json');
        $taxonomy_term_ids = self::import_listing_categories();

        foreach ($listings as $item) {
            if (self::find_seeded_post($item['slug'], 'listing')) {
                continue;
            }

            $detail = $details[$item['slug']] ?? null;

            $post_id = wp_insert_post([
                'post_type' => 'listing',
                'post_status' => 'publish',
                'post_title' => $item['title'],
                'post_name' => $item['slug'],
                'post_content' => $detail['description'] ?? '',
            ], true);

            if (is_wp_error($post_id)) {
                continue;
            }

            update_post_meta($post_id, 'c767_seed_slug', $item['slug']);

            // Assign both the parent category term and the specific industry
            // term — lets the frontend filter at either level from the same
            // taxonomy without hierarchy-aware query logic.
            $term_ids = array_filter([
                $taxonomy_term_ids[$item['categorySlug']] ?? null,
                $taxonomy_term_ids[$item['industrySlug']] ?? null,
            ]);
            if ($term_ids) {
                wp_set_object_terms($post_id, array_values($term_ids), 'listing_category');
            }

            // All 3 real listings are featured — there's no dummy content
            // left to pick a curated subset from.
            $feature_slugs = ['kalinago-tours', 'finance-focus-consultancy', 'catherine-lewis'];
            $meta = [
                'price_tier' => $item['price'],
                'tier' => $item['badge'],
                'verified' => $item['verified'] ? '1' : '0',
                'featured' => in_array($item['slug'], $feature_slugs, true) ? '1' : '0',
                'rating' => $item['rating'],
                'review_count' => trim((string) $item['reviews'], '()'),
                'location_display' => $item['location'],
            ];

            if ($detail) {
                $meta['description'] = $detail['description'] ?? '';
                $meta['tags'] = wp_json_encode($detail['tags'] ?? []);
                $meta['amenities'] = wp_json_encode($detail['amenities'] ?? []);
                $meta['hours'] = wp_json_encode($detail['hours'] ?? []);
                $meta['gallery'] = wp_json_encode(array_map(function ($img) {
                    return ['url' => self::resolve_image_url($img['src']), 'alt' => $img['alt']];
                }, $detail['gallery'] ?? []));
                $meta['reviews'] = wp_json_encode(array_map(function ($r) {
                    return ['name' => $r['name'], 'time' => $r['time'], 'stars' => $r['stars'], 'text' => $r['text']];
                }, $detail['reviews'] ?? []));
                $meta['phone'] = $detail['contact']['phone'] ?? '';
                $meta['email'] = $detail['contact']['email'] ?? '';
                $meta['website'] = $detail['contact']['websiteUrl'] ?? '';
                $meta['address'] = $detail['contact']['address'] ?? '';
                $meta['instagram'] = $detail['contact']['instagram'] ?? '';
                $meta['facebook'] = $detail['contact']['facebook'] ?? '';
                $meta['map_embed_url'] = $detail['mapEmbedUrl'] ?? '';
            }

            foreach ($meta as $key => $value) {
                update_post_meta($post_id, $key, $value);
            }

            if (!empty($item['image'])) {
                update_post_meta($post_id, 'fallback_image', esc_url_raw(self::resolve_image_url($item['image'])));
            }
        }
    }

    // ---------- Blog ----------

    private static function import_blog()
    {
        $posts = self::load_json('blog-posts.json');

        foreach ($posts as $item) {
            if (self::find_seeded_post($item['slug'], 'post')) {
                continue;
            }

            $content = '';
            foreach ($item['body'] as $block) {
                $content .= $block['type'] === 'h2'
                    ? '<h2>' . esc_html($block['text']) . '</h2>'
                    : '<p>' . esc_html($block['text']) . '</p>';
            }

            $post_id = wp_insert_post([
                'post_type' => 'post',
                'post_status' => 'publish',
                'post_title' => $item['title'],
                'post_name' => $item['slug'],
                'post_excerpt' => $item['excerpt'],
                'post_content' => $content,
            ], true);

            if (is_wp_error($post_id)) {
                continue;
            }

            update_post_meta($post_id, 'c767_seed_slug', $item['slug']);
            wp_set_post_categories($post_id, [self::ensure_term($item['tag'], 'category')]);

            preg_match('/\d+/', $item['readTime'], $matches);
            update_post_meta($post_id, 'reading_time', $matches[0] ?? 5);
            update_post_meta($post_id, 'author_key', $item['author']);
            update_post_meta($post_id, 'tags', wp_json_encode($item['tags'] ?? []));
            update_post_meta($post_id, 'body', wp_json_encode($item['body'] ?? []));

            if (!empty($item['image'])) {
                update_post_meta($post_id, 'fallback_image', esc_url_raw(self::resolve_image_url($item['image'])));
            }
        }
    }

    // ---------- Uniform Studio ----------

    private static function import_uniform_studio()
    {
        foreach (self::load_json('uniform-sports.json') as $sport) {
            self::ensure_term($sport['label'], 'uniform_sport', $sport['icon']);
        }

        foreach (self::load_json('uniform-templates.json') as $item) {
            if (self::find_seeded_post($item['slug'], 'uniform_template')) {
                continue;
            }

            $post_id = wp_insert_post([
                'post_type' => 'uniform_template',
                'post_status' => 'publish',
                'post_title' => $item['name'],
                'post_name' => $item['slug'],
            ], true);

            if (is_wp_error($post_id)) {
                continue;
            }

            update_post_meta($post_id, 'c767_seed_slug', $item['slug']);
            update_post_meta($post_id, 'description', $item['description']);
            update_post_meta($post_id, 'default_collar', $item['defaultCollar']);
            update_post_meta($post_id, 'default_sleeve', $item['defaultSleeve']);

            $sport_label = self::sport_label_for_slug($item['sportSlug']);
            if ($sport_label) {
                wp_set_object_terms($post_id, $sport_label, 'uniform_sport');
            }
        }
    }

    private static function sport_label_for_slug($slug)
    {
        foreach (self::load_json('uniform-sports.json') as $sport) {
            if ($sport['slug'] === $slug) {
                return $sport['label'];
            }
        }
        return null;
    }

    // ---------- Shop (WooCommerce) ----------

    private static function import_shop()
    {
        foreach (self::load_json('shop-categories.json') as $cat) {
            $term = term_exists($cat['label'], 'product_cat');
            $term_id = 0;
            if (!$term) {
                $inserted = wp_insert_term($cat['label'], 'product_cat');
                if (!is_wp_error($inserted)) {
                    $term_id = (int) $inserted['term_id'];
                }
            } else {
                $term_id = is_array($term) ? (int) $term['term_id'] : (int) $term;
            }
            if ($term_id) {
                update_term_meta($term_id, 'c767_icon', $cat['icon']);
            }
        }

        foreach (self::load_json('products.json') as $item) {
            if (self::find_seeded_post($item['slug'], 'product')) {
                continue;
            }

            $product = new WC_Product_Simple();
            $product->set_name($item['title']);
            $product->set_slug($item['slug']);
            $product->set_status('publish');
            $product->set_regular_price((string) ($item['originalPrice'] ?? $item['price']));
            if (!empty($item['originalPrice'])) {
                $product->set_sale_price((string) $item['price']);
            }
            $product->set_catalog_visibility('visible');
            $product->set_manage_stock(false);
            $product->set_stock_status('instock');

            $category_label = self::shop_category_label_for_slug($item['category']);
            if ($category_label) {
                $term = get_term_by('name', $category_label, 'product_cat');
                if ($term) {
                    $product->set_category_ids([$term->term_id]);
                }
            }

            $tag_ids = [];
            foreach ($item['tags'] ?? [] as $tag_name) {
                $tag_ids[] = self::ensure_term($tag_name, 'product_tag');
            }
            if ($tag_ids) {
                $product->set_tag_ids(array_filter($tag_ids));
            }

            $product_id = $product->save();
            update_post_meta($product_id, 'c767_seed_slug', $item['slug']);
            if (!empty($item['image'])) {
                update_post_meta($product_id, 'fallback_image', esc_url_raw(self::resolve_image_url($item['image'])));
            }
        }
    }

    private static function shop_category_label_for_slug($slug)
    {
        foreach (self::load_json('shop-categories.json') as $cat) {
            if ($cat['slug'] === $slug) {
                return $cat['label'];
            }
        }
        return null;
    }
}
