<?php
/**
 * Plugin Name: Connect767 Frontend Loader
 * Plugin URI: https://connect767.com
 * Description: Serves the built Connect767 React app (Vite production build) as the site's actual front-end, at the site's own domain — no separate hosting, no iframe. Upload the app's `dist` build as a zip, flip on "SPA takeover," and every non-admin, non-API request is answered with the app's index.html so React Router handles the URL client-side. Pairs with the connect767-cms plugin (REST API, auth, content) but doesn't require it.
 * Version: 1.0.1
 * Author: Connect767
 * Text Domain: connect767-frontend
 * Requires PHP: 7.4
 * Requires at least: 6.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('C767F_VERSION', '1.0.1');
define('C767F_PLUGIN_FILE', __FILE__);
define('C767F_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('C767F_PLUGIN_URL', plugin_dir_url(__FILE__));
define('C767F_DIST_DIR', C767F_PLUGIN_DIR . 'dist/');
define('C767F_DIST_URL', C767F_PLUGIN_URL . 'dist/');

function c767f_require_includes()
{
    $includes = [
        'includes/class-uploader.php',
        'includes/class-spa-router.php',
    ];
    foreach ($includes as $file) {
        $path = C767F_PLUGIN_DIR . $file;
        if (file_exists($path)) {
            require_once $path;
        }
    }
}
c767f_require_includes();

function c767f_init_plugin()
{
    C767F_Uploader::init();
    C767F_SPA_Router::init();
}
add_action('plugins_loaded', 'c767f_init_plugin');

function c767f_activate()
{
    if (!file_exists(C767F_DIST_DIR)) {
        wp_mkdir_p(C767F_DIST_DIR);
    }
    // Deliberately does NOT enable SPA takeover on activation — stays off
    // until an admin uploads a real build and flips it on, so installing
    // this plugin can never immediately break an existing site.
}
register_activation_hook(__FILE__, 'c767f_activate');

function c767f_deactivate()
{
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'c767f_deactivate');
