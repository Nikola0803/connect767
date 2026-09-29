<?php
/**
 * The actual "router". Two jobs, in order:
 *
 *  1. If the requested path matches a real file inside the uploaded dist/
 *     folder (JS bundles, CSS, fonts, images, favicon — anything Vite
 *     built), serve that file directly with the correct Content-Type and
 *     long-lived caching. This is the standard, battle-tested way to host
 *     a Vite/CRA-style SPA (equivalent to nginx's `try_files $uri
 *     $uri/ /index.html;` or `serve -s`) — it means a plain `npm run
 *     build` output works with zero special configuration, since every
 *     asset reference (HTML attributes, CSS @font-face url()s, and
 *     JS-bundled string literals like an <img src="/uploads/...">) all
 *     resolve to real files at the site root exactly as built, instead of
 *     needing every reference rewritten after the fact.
 *  2. Otherwise, serve index.html and let React Router handle the path
 *     client-side — this is the actual SPA fallback, and only applies to
 *     real *routes* (/shop, /listings/:slug, etc.), never to static files.
 *
 * Only active once an admin has both uploaded a build AND explicitly
 * flipped on "SPA takeover" (see class-uploader.php) — never auto-enables
 * itself.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767F_SPA_Router
{
    /** Path prefixes WordPress must keep handling normally. */
    private static $reserved_prefixes = [
        '/wp-admin',
        '/wp-json',
        '/wp-login.php',
        '/wp-register.php',
        '/wp-cron.php',
        '/xmlrpc.php',
        '/wp-content',
        '/wp-includes',
        '/feed',
        '/sitemap.xml',
        '/sitemap_index.xml',
        '/robots.txt',
    ];

    private static $mime_types = [
        'html' => 'text/html; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'mjs' => 'application/javascript; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'eot' => 'application/vnd.ms-fontobject',
        'txt' => 'text/plain; charset=UTF-8',
        'map' => 'application/json; charset=UTF-8',
        'webmanifest' => 'application/manifest+json',
    ];

    public static function init()
    {
        add_action('template_redirect', [__CLASS__, 'maybe_serve_spa'], 0);
    }

    public static function maybe_serve_spa()
    {
        if (is_admin() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }

        if (!get_option('c767f_takeover_active')) {
            return;
        }

        $index_path = C767F_DIST_DIR . 'index.html';
        if (!file_exists($index_path)) {
            return;
        }

        $path = self::current_path();
        if (self::is_reserved($path)) {
            return;
        }

        // Job 1: a real built file (JS/CSS/fonts/images/favicon/etc.) —
        // serve it directly, whatever the extension, so nothing needs
        // rewriting after the build.
        $file_path = self::resolve_static_file($path);
        if ($file_path) {
            self::serve_file($file_path);
        }

        // Job 2: not a real file — treat it as a client-side route and let
        // React Router take over.
        self::serve_index($index_path);
    }

    private static function current_path()
    {
        $uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
        $path = wp_parse_url($uri, PHP_URL_PATH);
        return $path ? $path : '/';
    }

    private static function is_reserved($path)
    {
        $prefixes = array_merge(self::$reserved_prefixes, self::woocommerce_prefixes());
        $prefixes = apply_filters('c767f_reserved_prefixes', $prefixes);
        foreach ($prefixes as $prefix) {
            if ($prefix && strpos($path, $prefix) === 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * WooCommerce needs to render its own real pages for cart, checkout,
     * and my-account — critically including the payment step itself
     * (`/checkout/order-pay/...`, reached after this plugin's headless
     * `checkout()` REST endpoint creates the order and redirects there).
     * Without these excluded, the SPA takeover swallowed that redirect
     * and served the React app instead, which has no route for it —
     * meaning every real order hit a 404 at the exact moment of payment,
     * not the demo/informational cart+checkout the React app has its own
     * UI for.
     *
     * Reads WooCommerce's *actual configured* page URLs
     * (`wc_get_page_permalink()`) rather than hardcoding the default
     * "/cart", "/checkout", "/my-account" slugs, since a site owner can
     * (and often does) rename these in WooCommerce → Settings → Advanced.
     */
    private static function woocommerce_prefixes()
    {
        if (!function_exists('wc_get_page_permalink')) {
            return [];
        }

        $pages = ['cart', 'checkout', 'myaccount'];
        $prefixes = [];
        foreach ($pages as $page) {
            $url = wc_get_page_permalink($page);
            $path = $url ? wp_parse_url($url, PHP_URL_PATH) : null;
            if ($path) {
                $prefixes[] = untrailingslashit($path);
            }
        }
        return $prefixes;
    }

    /**
     * Maps a request path directly onto the dist/ folder and returns the
     * real filesystem path if (and only if) a file genuinely exists there
     * — never guesses, never falls back to index.html itself (that's the
     * caller's job). Guards against path traversal since this reads
     * directly from a URL.
     */
    private static function resolve_static_file($path)
    {
        $relative = ltrim($path, '/');
        if ($relative === '' || $relative === 'index.html') {
            return null; // handled as the SPA shell, not a static passthrough
        }

        $candidate = realpath(C767F_DIST_DIR . $relative);
        $dist_real = realpath(C767F_DIST_DIR);

        if (
            $candidate === false ||
            $dist_real === false ||
            strpos($candidate, $dist_real) !== 0 || // path traversal guard
            !is_file($candidate)
        ) {
            return null;
        }

        return $candidate;
    }

    private static function serve_file($file_path)
    {
        $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
        $mime = self::$mime_types[$ext] ?? 'application/octet-stream';

        status_header(200);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($file_path));
        // Vite fingerprints filenames (index-<hash>.js), so a built asset
        // never changes contents without also changing its URL — safe to
        // cache aggressively. index.html itself is served separately,
        // below, without this header.
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($file_path); // phpcs:ignore -- static local file resolved and traversal-checked above
        exit;
    }

    private static function serve_index($index_path)
    {
        status_header(200);
        nocache_headers();
        header('Content-Type: text/html; charset=UTF-8');
        echo file_get_contents($index_path); // phpcs:ignore -- static local file, not user input
        exit;
    }
}
