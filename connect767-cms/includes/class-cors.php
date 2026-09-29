<?php
/**
 * CORS support for the headless frontend. WordPress's default REST CORS
 * handling doesn't allow custom origins or the Authorization header, both
 * of which the React app needs.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_CORS
{
    public static function init()
    {
        // Handles the browser's preflight OPTIONS request as early as possible
        // (before WordPress's REST routing runs at all) — a preflight that
        // doesn't get an immediate 200 with the right headers makes the
        // browser block the real request from ever being sent, which looks
        // like "nothing happened" on the frontend with no visible error.
        add_action('init', [__CLASS__, 'maybe_handle_preflight'], 0);

        add_action('rest_api_init', [__CLASS__, 'add_headers'], 15);
    }

    public static function maybe_handle_preflight()
    {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : '';
        $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';

        if ($method !== 'OPTIONS' || strpos($uri, '/wp-json/') === false) {
            return;
        }

        header('Access-Control-Allow-Origin: ' . self::allowed_origin());
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 600');
        status_header(200);
        exit;
    }

    public static function add_headers()
    {
        remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');

        add_filter('rest_pre_serve_request', function ($value) {
            header('Access-Control-Allow-Origin: ' . self::allowed_origin());
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
            header('Access-Control-Allow-Credentials: true');

            return $value;
        });
    }

    /**
     * Reflects the request's Origin header rather than using a wildcard, so
     * Allow-Credentials can be true (required for the Authorization header
     * to work cross-origin).
     *
     * Real bug, found while investigating "Failed to fetch" reports against
     * the live site: the default allow-list only ever contained the local
     * dev server origins (localhost:5173/4173) — this site's own real
     * domain was never in it, and nothing elsewhere in the plugin added it.
     * Any cross-origin request from the actual deployed frontend (anywhere
     * other than localhost) fell through to the `$allowed[0] ?? $origin`
     * fallback, which returned `http://localhost:5173` as the
     * Access-Control-Allow-Origin value regardless of the real requesting
     * origin — a mismatched header the browser blocks outright, surfacing
     * as an opaque "TypeError: Failed to fetch" with no useful message.
     * Now includes this site's own `home_url()`/`site_url()` (both are
     * needed since they can differ) by default, so the common "frontend
     * talks to its own WordPress backend" case just works without any
     * manual configuration — the c767_allowed_origins filter remains for
     * anyone hosting the frontend on a genuinely separate domain.
     */
    private static function allowed_origin()
    {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? esc_url_raw($_SERVER['HTTP_ORIGIN']) : '*';

        $default_origins = array_values(array_unique(array_filter([
            untrailingslashit(home_url()),
            untrailingslashit(site_url()),
            // The production frontend is deliberately on a *different*
            // subdomain than WordPress (connect767.com vs. this site's own
            // admin.connect767.com) — a genuinely split headless setup, not
            // the "frontend and WP share one domain" case home_url()/
            // site_url() cover. Without these listed explicitly, every
            // request from the real frontend fell through to the
            // `$allowed[0]` fallback below, which returned this site's own
            // home_url() as Access-Control-Allow-Origin — a value that can
            // never match the browser's actual 'https://connect767.com'
            // Origin header, so the browser blocked every request outright
            // (visible as a CORS preflight failure, not a 404, once the
            // route itself was reachable).
            'https://connect767.com',
            'https://www.connect767.com',
            'http://localhost:5173',
            'http://localhost:4173',
        ])));

        $allowed = apply_filters('c767_allowed_origins', $default_origins);

        if ($allowed === '*' || in_array($origin, $allowed, true)) {
            return $origin;
        }

        // Fall back to the first configured origin rather than '*' so
        // credentialed requests still work for the known frontend.
        return $allowed[0] ?? $origin;
    }
}
