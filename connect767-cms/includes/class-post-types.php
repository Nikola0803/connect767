<?php
/**
 * Custom Post Types and taxonomies: `listing` (the directory) and
 * `uniform_template` (the Uniform Studio's template gallery), plus the
 * `listing_category` taxonomy. Field names throughout this plugin are
 * chosen to match src/lib/mappers.js in the React app exactly — see
 * WORDPRESS.md in the frontend repo for the full field-by-field spec this
 * was built against.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Post_Types
{
    public static function init()
    {
        add_action('init', [__CLASS__, 'register_post_types']);
        add_action('init', [__CLASS__, 'register_taxonomies']);
        // Runs after the taxonomy is registered on the same 'init' hook
        // (default priority registers at 10, this at 20).
        add_action('init', [__CLASS__, 'cleanup_stray_industry_terms'], 20);
        add_action('rest_api_init', [__CLASS__, 'register_query_vars']);
    }

    /**
     * One-time data migration (option-flagged so it only ever runs once).
     *
     * Before 1.0.1, the listing submit/update endpoints passed the wizard's
     * raw *industry* slug to wp_set_object_terms(), and when that term
     * didn't exist yet WordPress created it as a brand-new TOP-LEVEL term
     * named after the slug — e.g. a top-level "accounting-and-bookkeeping"
     * sitting next to Services/Products/Rentals, which then showed up as a
     * major category on the directory page and the homepage pills.
     *
     * This walks data/category-taxonomy.json and, for every top-level
     * listing_category term whose slug is actually an industry slug,
     * moves it under its canonical parent category and restores its proper
     * label ("Accounting & Bookkeeping" instead of the raw slug). Existing
     * listing assignments are preserved — the term keeps its ID, only its
     * parent and name change.
     */
    public static function cleanup_stray_industry_terms()
    {
        if (get_option('c767_stray_industry_cleanup_1')) {
            return;
        }
        // Don't burn the one-shot flag before the taxonomy JSON is readable.
        $taxonomy_file = C767_PLUGIN_DIR . 'data/category-taxonomy.json';
        if (!file_exists($taxonomy_file)) {
            return;
        }
        $taxonomy = json_decode(file_get_contents($taxonomy_file), true);
        if (!is_array($taxonomy)) {
            return;
        }

        // industry slug => ['label' => ..., 'parent_slug' => ..., 'parent_label' => ...]
        $industry_map = [];
        foreach ($taxonomy as $cat) {
            foreach ($cat['industries'] ?? [] as $industry) {
                if (!empty($industry['slug'])) {
                    $industry_map[$industry['slug']] = [
                        'label' => $industry['label'] ?? $industry['slug'],
                        'parent_slug' => $cat['slug'] ?? '',
                        'parent_label' => $cat['label'] ?? '',
                    ];
                }
            }
        }

        $top_level = get_terms([
            'taxonomy' => 'listing_category',
            'hide_empty' => false,
            'parent' => 0,
        ]);
        if (is_wp_error($top_level)) {
            return; // Taxonomy not ready yet; retry on the next request.
        }

        foreach ($top_level as $term) {
            if (!isset($industry_map[$term->slug])) {
                continue; // A legitimate top-level category — leave it alone.
            }
            $info = $industry_map[$term->slug];

            $parent = get_term_by('slug', $info['parent_slug'], 'listing_category');
            if ($parent && !is_wp_error($parent)) {
                $parent_id = (int) $parent->term_id;
            } else {
                $created = wp_insert_term($info['parent_label'], 'listing_category', [
                    'slug' => $info['parent_slug'],
                ]);
                if (is_wp_error($created)) {
                    continue;
                }
                $parent_id = (int) $created['term_id'];
            }

            wp_update_term($term->term_id, 'listing_category', [
                'parent' => $parent_id,
                'name' => $info['label'],
            ]);

            // Listings assigned only to the stray industry term were
            // invisible to the directory's top-level category filter —
            // give them the parent category term as well.
            $posts = get_objects_in_term($term->term_id, 'listing_category');
            if (!is_wp_error($posts)) {
                foreach ($posts as $post_id) {
                    wp_set_object_terms($post_id, [$parent_id], 'listing_category', true);
                }
            }
        }

        // clean_taxonomy_cache() runs inside wp_update_term(), but the
        // hierarchy option can stay stale within this request — refresh it
        // so the very next term query already sees the new parents.
        delete_option('listing_category_children');

        update_option('c767_stray_industry_cleanup_1', 1);
    }

    public static function register_post_types()
    {
        register_post_type('listing', [
            'label' => 'Listings',
            'labels' => [
                'name' => 'Listings',
                'singular_name' => 'Listing',
                'add_new_item' => 'Add New Listing',
                'edit_item' => 'Edit Listing',
                'all_items' => 'All Listings',
                'menu_name' => 'Directory',
            ],
            'public' => true,
            'has_archive' => true,
            'rewrite' => ['slug' => 'listings'],
            'show_in_rest' => true,
            'rest_base' => 'listing',
            'menu_icon' => 'dashicons-store',
            'supports' => ['title', 'editor', 'thumbnail', 'author', 'custom-fields'],
        ]);

        register_post_type('uniform_template', [
            'label' => 'Uniform Templates',
            'labels' => [
                'name' => 'Uniform Templates',
                'singular_name' => 'Uniform Template',
                'add_new_item' => 'Add New Template',
                'edit_item' => 'Edit Template',
                'all_items' => 'All Templates',
                'menu_name' => 'Uniform Studio',
            ],
            'public' => true,
            'has_archive' => false,
            'rewrite' => ['slug' => 'uniform-templates'],
            'show_in_rest' => true,
            'rest_base' => 'uniform_template',
            'menu_icon' => 'dashicons-tshirt',
            'supports' => ['title', 'editor', 'thumbnail'],
        ]);

        // Product Configurator — admin-managed product types for the shop's
        // Product Customizer (src/pages/ProductCustomizerPage.jsx). Each
        // entry controls what the customizer shows for that product: base
        // price, an optional 3D model, the garment color palette, printing
        // techniques, and — via the `zones` repeater in class-meta-fields.php
        // — exactly which placements exist and what can be customized on
        // each one (text/logo/recolor), replacing what used to be hardcoded
        // in the frontend's src/data/customizer.js.
        register_post_type('product_type', [
            'label' => 'Product Types',
            'labels' => [
                'name' => 'Product Types',
                'singular_name' => 'Product Type',
                'add_new_item' => 'Add New Product Type',
                'edit_item' => 'Edit Product Type',
                'all_items' => 'All Product Types',
                'menu_name' => 'Product Configurator',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => true,
            'menu_icon' => 'dashicons-art',
            'has_archive' => false,
            'show_in_rest' => true,
            'rest_base' => 'product_type',
            'supports' => ['title', 'thumbnail', 'page-attributes'],
            'capability_type' => 'post',
        ]);

        register_post_type('uniform_quote', [
            'label' => 'Uniform Quote Requests',
            'labels' => [
                'name' => 'Quote Requests',
                'singular_name' => 'Quote Request',
                'all_items' => 'Quote Requests',
                'menu_name' => 'Quote Requests',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'edit.php?post_type=uniform_template',
            'show_in_rest' => false,
            'supports' => ['title'],
            'capability_type' => 'post',
        ]);

        register_post_type('product_quote', [
            'label' => 'Custom Product Orders',
            'labels' => [
                'name' => 'Custom Product Orders',
                'singular_name' => 'Custom Product Order',
                'all_items' => 'Custom Product Orders',
                'menu_name' => 'Custom Orders',
            ],
            'public' => false,
            'show_ui' => true,
            'menu_icon' => 'dashicons-art',
            'show_in_menu' => true,
            'show_in_rest' => false,
            'supports' => ['title'],
            'capability_type' => 'post',
        ]);

        // Booking requests submitted through a listing's public "Request a
        // booking" form (only shown when that listing's owner has switched
        // on `booking_enabled` from their dashboard — see
        // class-rest-bookings.php). Not shown in wp/v2 REST or the public
        // site at all; owners see their own requests through
        // GET /connect767/v1/bookings/mine, admins through this post list.
        register_post_type('booking', [
            'label' => 'Booking Requests',
            'labels' => [
                'name' => 'Booking Requests',
                'singular_name' => 'Booking Request',
                'all_items' => 'Booking Requests',
                'menu_name' => 'Bookings',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'edit.php?post_type=listing',
            'show_in_rest' => false,
            'supports' => ['title'],
            'capability_type' => 'post',
        ]);

        // Marketplace: sellable items a Classified listing owner adds from
        // their dashboard (class-rest-vendor-products.php). "Platform
        // collects" model — payment goes to this site's own Stripe account
        // (the same one Shop checkout and Classified listing fees already
        // use), not a per-vendor Stripe Connect account; the site owner
        // pays vendors out separately, outside the app. vendor_order
        // exists purely so both the vendor and the site admin can see what
        // sold for that manual payout bookkeeping.
        register_post_type('vendor_product', [
            'label' => 'Vendor Products',
            'labels' => [
                'name' => 'Vendor Products',
                'singular_name' => 'Vendor Product',
                'all_items' => 'Vendor Products',
                'menu_name' => 'Vendor Products',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'edit.php?post_type=listing',
            'show_in_rest' => false,
            'supports' => ['title'],
            'capability_type' => 'post',
        ]);

        register_post_type('vendor_order', [
            'label' => 'Vendor Orders',
            'labels' => [
                'name' => 'Vendor Orders',
                'singular_name' => 'Vendor Order',
                'all_items' => 'Vendor Orders',
                'menu_name' => 'Vendor Orders',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'edit.php?post_type=listing',
            'show_in_rest' => false,
            'supports' => ['title'],
            'capability_type' => 'post',
        ]);
    }

    public static function register_taxonomies()
    {
        register_taxonomy('listing_category', 'listing', [
            'label' => 'Listing Categories',
            'labels' => [
                'name' => 'Categories',
                'singular_name' => 'Category',
            ],
            'hierarchical' => true,
            'show_in_rest' => true,
            'rest_base' => 'listing_category',
            'rewrite' => ['slug' => 'listing-category'],
        ]);

        register_taxonomy('uniform_sport', 'uniform_template', [
            'label' => 'Sports',
            'labels' => [
                'name' => 'Sports',
                'singular_name' => 'Sport',
            ],
            'hierarchical' => true,
            'show_in_rest' => true,
            'rest_base' => 'uniform_sport',
            'rewrite' => ['slug' => 'sport'],
        ]);
    }

    /**
     * Lets the frontend query GET /wp/v2/listing?featured=true for the
     * homepage's featured-listings section (see repository.js:getFeaturedListings).
     */
    public static function register_query_vars()
    {
        add_filter('rest_listing_query', function ($args, $request) {
            $featured = $request->get_param('featured');
            if ($featured !== null) {
                $args['meta_query'][] = [
                    'key' => 'featured',
                    'value' => filter_var($featured, FILTER_VALIDATE_BOOLEAN) ? '1' : '0',
                    'compare' => '=',
                ];
            }
            return $args;
        }, 10, 2);
    }
}
