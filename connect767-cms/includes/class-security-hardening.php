<?php
/** Baseline production hardening for the public WordPress origin. */
if (!defined('ABSPATH')) {
    exit;
}

class C767_Security_Hardening
{
    const LOGIN_LIMIT = 10;
    const LOGIN_WINDOW = 900;

    public static function init()
    {
        add_action('parse_request', [__CLASS__, 'serve_private_origin_robots'], 0);
        add_action('send_headers', [__CLASS__, 'security_headers']);
        // Some WordPress/nginx stacks bypass or replace the normal frontend
        // header phase for REST responses. Apply the same baseline immediately
        // before REST output so the headless API is protected consistently.
        add_filter('rest_pre_serve_request', [__CLASS__, 'rest_security_headers'], 20, 4);
        add_filter('xmlrpc_enabled', '__return_false');
        add_filter('the_generator', '__return_empty_string');
        add_filter('rest_endpoints', [__CLASS__, 'hide_public_user_routes']);
        add_filter('wp_robots', [__CLASS__, 'private_origin_robots_directives']);
        add_filter('wp_sitemaps_enabled', [__CLASS__, 'private_origin_sitemaps_enabled']);
        add_filter('authenticate', [__CLASS__, 'enforce_login_rate_limit'], 5, 3);
        add_action('wp_login_failed', [__CLASS__, 'record_login_failure']);
        add_action('wp_login', [__CLASS__, 'clear_login_failures']);
        add_filter('login_errors', [__CLASS__, 'generic_login_error']);
    }

    public static function security_headers()
    {
        if (is_ssl()) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(self)');
        header("Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
        if (self::is_private_cms_origin()) {
            header('X-Robots-Tag: noindex, nofollow, noarchive');
        }
    }

    /** Keep the headless WordPress origin out of search without affecting public-host installs. */
    private static function is_private_cms_origin()
    {
        $host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
        return $host && strpos($host, 'admin.') === 0;
    }

    /**
     * Serve a real robots.txt response even when the host/web server does not
     * pass WordPress's virtual robots rewrite through to do_robots().
     */
    public static function serve_private_origin_robots()
    {
        if (!self::is_private_cms_origin()) {
            return;
        }

        $request_path = (string) wp_parse_url(
            isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '',
            PHP_URL_PATH
        );
        if ($request_path !== '/robots.txt') {
            return;
        }

        status_header(200);
        nocache_headers();
        header('Content-Type: text/plain; charset=UTF-8');
        header('X-Robots-Tag: noindex, nofollow, noarchive');
        echo "User-agent: *\nDisallow: /\n";
        exit;
    }

    /** Reinforce page-level noindex metadata on the private CMS origin. */
    public static function private_origin_robots_directives($robots)
    {
        if (!self::is_private_cms_origin()) {
            return $robots;
        }

        $robots['noindex'] = true;
        $robots['nofollow'] = true;
        $robots['noarchive'] = true;
        unset($robots['index'], $robots['follow']);
        return $robots;
    }

    /** The public frontend owns the sitemap; the private CMS origin must not publish one. */
    public static function private_origin_sitemaps_enabled($enabled)
    {
        return self::is_private_cms_origin() ? false : $enabled;
    }

    public static function rest_security_headers($served)
    {
        self::security_headers();
        return $served;
    }

    /** Author details are delivered through approved content, not an enumerable index. */
    public static function hide_public_user_routes($endpoints)
    {
        if (is_user_logged_in() && current_user_can('list_users')) {
            return $endpoints;
        }
        foreach (array_keys($endpoints) as $route) {
            if ($route === '/wp/v2/users' || strpos($route, '/wp/v2/users/') === 0) {
                unset($endpoints[$route]);
            }
        }
        return $endpoints;
    }

    private static function request_ip()
    {
        return sanitize_text_field((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    }

    private static function login_key()
    {
        return 'c767_wp_login_' . md5(self::request_ip());
    }

    public static function enforce_login_rate_limit($user, $username, $password)
    {
        if ((int) get_transient(self::login_key()) >= self::LOGIN_LIMIT) {
            return new WP_Error('c767_login_rate_limit', 'Too many sign-in attempts. Please wait 15 minutes and try again.');
        }
        return $user;
    }

    public static function record_login_failure()
    {
        $key = self::login_key();
        set_transient($key, (int) get_transient($key) + 1, self::LOGIN_WINDOW);
    }

    public static function clear_login_failures()
    {
        delete_transient(self::login_key());
    }

    public static function generic_login_error()
    {
        return 'The sign-in details were not accepted.';
    }
}
