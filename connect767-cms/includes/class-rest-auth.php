<?php
/**
 * Auth endpoints under connect767/v1 — register (WP core has no REST
 * registration endpoint) and login (issues our own JWT rather than
 * depending on a third-party JWT plugin, so this works from a plain
 * plugin install with zero extra configuration).
 *
 * Matches src/lib/authClient.js in the frontend:
 *   POST /connect767/v1/auth/register  { name, email, password, accountType }
 *   POST /connect767/v1/auth/login     { email, password }
 *   GET  /connect767/v1/auth/me        (Authorization: Bearer <token>)
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Auth
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/auth/register', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'register'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/auth/login', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'login'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/auth/me', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'me'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function register(WP_REST_Request $request)
    {
        $name = sanitize_text_field($request->get_param('name'));
        $email = sanitize_email($request->get_param('email'));
        $password = (string) $request->get_param('password');
        $account_type = sanitize_key($request->get_param('accountType') ?: 'customer');

        if (!$name || !$email || !$password) {
            return new WP_Error('c767_missing_fields', 'Name, email, and password are required.', ['status' => 400]);
        }
        if (!is_email($email)) {
            return new WP_Error('c767_invalid_email', 'Please enter a valid email address.', ['status' => 400]);
        }
        if (email_exists($email)) {
            return new WP_Error('c767_email_exists', 'An account with that email already exists.', ['status' => 409]);
        }
        if (strlen($password) < 8) {
            return new WP_Error('c767_weak_password', 'Password must be at least 8 characters.', ['status' => 400]);
        }

        $username = self::unique_username_from_email($email);

        $user_id = wp_insert_user([
            'user_login' => $username,
            'user_email' => $email,
            'user_pass' => $password,
            'display_name' => $name,
            'first_name' => $name,
            'role' => 'subscriber',
        ]);

        if (is_wp_error($user_id)) {
            return new WP_Error('c767_registration_failed', $user_id->get_error_message(), ['status' => 400]);
        }

        $safe_account_type = in_array($account_type, ['customer', 'business'], true) ? $account_type : 'customer';
        update_user_meta($user_id, 'c767_account_type', $safe_account_type);

        do_action('c767_user_registered', $user_id, $safe_account_type);

        $user = get_user_by('id', $user_id);
        return rest_ensure_response([
            'token' => C767_JWT::issue(['user_id' => $user_id]),
            'user' => self::format_user($user),
        ]);
    }

    public static function login(WP_REST_Request $request)
    {
        $email = sanitize_email($request->get_param('email'));
        $password = (string) $request->get_param('password');

        if (!$email || !$password) {
            return new WP_Error('c767_missing_fields', 'Email and password are required.', ['status' => 400]);
        }

        $user = get_user_by('email', $email);
        $username = $user ? $user->user_login : $email;

        $result = wp_authenticate($username, $password);
        if (is_wp_error($result)) {
            return new WP_Error('c767_invalid_credentials', 'Incorrect email or password.', ['status' => 401]);
        }

        return rest_ensure_response([
            'token' => C767_JWT::issue(['user_id' => $result->ID]),
            'user' => self::format_user($result),
        ]);
    }

    public static function me(WP_REST_Request $request)
    {
        $user = self::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }
        return rest_ensure_response(['user' => self::format_user($user)]);
    }

    /**
     * Resolves the current user from a Bearer token. Other route classes
     * (listings, uniform quotes) call this to require authentication.
     * Returns a WP_User on success, WP_Error on failure.
     */
    public static function user_from_request(WP_REST_Request $request)
    {
        $token = C767_JWT::bearer_token_from_request($request);
        if (!$token) {
            return new WP_Error('c767_no_token', 'Authorization required.', ['status' => 401]);
        }

        $payload = C767_JWT::verify($token);
        if (is_wp_error($payload)) {
            return $payload;
        }

        $user = get_user_by('id', $payload['user_id'] ?? 0);
        if (!$user) {
            return new WP_Error('c767_user_not_found', 'User no longer exists.', ['status' => 401]);
        }

        return $user;
    }

    private static function format_user($user)
    {
        return [
            'id' => $user->ID,
            'name' => $user->display_name,
            'email' => $user->user_email,
            'accountType' => get_user_meta($user->ID, 'c767_account_type', true) ?: 'customer',
        ];
    }

    private static function unique_username_from_email($email)
    {
        $base = sanitize_user(current(explode('@', $email)), true) ?: 'user';
        $username = $base;
        $i = 1;
        while (username_exists($username)) {
            $username = $base . $i;
            $i++;
        }
        return $username;
    }
}
