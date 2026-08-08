<?php
/**
 * Plugin Name: Connect767 CMS
 * Plugin URI: https://connect767.com
 * Description: Content management, REST API, auth, and WooCommerce checkout bridge for the Connect767 headless React frontend. Registers the Listing and Uniform Template custom post types, exposes the connect767/v1 REST namespace (auth, AI matching, listing submissions, uniform quotes, headless checkout), and includes a one-click sample content importer matching the frontend's local fixture data.
 * Version: 1.0.1
 * Author: Connect767
 * Text Domain: connect767-cms
 * Requires PHP: 7.4
 * Requires at least: 6.0
 *
 * WooCommerce is a soft dependency: shop/checkout routes only activate if
 * WooCommerce is active. Everything else (listings, blog, uniforms, auth)
 * works standalone.
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

define('C767_VERSION', '1.0.1');
define('C767_PLUGIN_FILE', __FILE__);
define('C767_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('C767_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Autoload the plugin's own includes. Kept intentionally simple (no
 * Composer dependency) so the plugin works by just uploading the folder,
 * no build step required.
 */
function c767_require_includes()
{
    $includes = [
        'includes/class-cors.php',
        'includes/class-jwt.php',
        'includes/class-post-types.php',
        'includes/class-meta-fields.php',
        'includes/class-rest-auth.php',
        'includes/class-rest-match.php',
        'includes/class-rest-listings.php',
        'includes/class-rest-listing-reviews.php',
        'includes/class-rest-bookings.php',
        'includes/class-rest-uniform-quotes.php',
        'includes/class-rest-product-quotes.php',
        'includes/class-woocommerce.php',
        'includes/class-checkout-branding.php',
        'includes/class-stripe-checkout.php',
        'includes/class-paypal-checkout.php',
        'includes/class-stripe-listing-checkout.php',
        'includes/class-rest-vendor-products.php',
        'includes/class-admin-dashboard.php',
        'includes/class-listing-review.php',
        'includes/class-notifications.php',
        'includes/class-importer.php',
    ];

    foreach ($includes as $file) {
        $path = C767_PLUGIN_DIR . $file;
        if (file_exists($path)) {
            require_once $path;
        }
    }
}
c767_require_includes();

/**
 * Boot every module. Each class exposes a static init() that wires its own
 * hooks — keeps this file a plain manifest, easy to see everything the
 * plugin does at a glance.
 */
function c767_init_plugin()
{
    C767_CORS::init();
    C767_Post_Types::init();
    C767_Meta_Fields::init();
    C767_REST_Auth::init();
    C767_REST_Match::init();
    C767_REST_Listings::init();
    C767_Rest_Listing_Reviews::init();
    C767_Rest_Bookings::init();
    C767_REST_Uniform_Quotes::init();
    C767_REST_Product_Quotes::init();
    C767_WooCommerce::init();
    C767_Checkout_Branding::init();
    C767_Stripe_Checkout::init();
    C767_PayPal_Checkout::init();
    C767_Stripe_Listing_Checkout::init();
    C767_Rest_Vendor_Products::init();
    C767_Admin_Dashboard::init();
    C767_Listing_Review::init();
    C767_Notifications::init();
    C767_Importer::init();
}
add_action('plugins_loaded', 'c767_init_plugin');

/**
 * Flush rewrite rules on activation/deactivation so the new CPT permalinks
 * and REST routes work immediately without needing a manual visit to
 * Settings > Permalinks.
 */
function c767_activate()
{
    c767_require_includes();
    C767_Post_Types::register_post_types();
    C767_Post_Types::register_taxonomies();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'c767_activate');

function c767_deactivate()
{
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'c767_deactivate');
