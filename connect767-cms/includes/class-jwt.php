<?php
/**
 * Minimal HS256 JWT implementation — no Composer / external library
 * dependency, so this plugin works from a plain zip upload. Handles exactly
 * what the auth routes need: issue a signed token on login/register, verify
 * it on authenticated requests.
 *
 * The signing secret is derived from WordPress's own AUTH_KEY/SECURE_AUTH_KEY
 * salts (already unique per install) unless C767_JWT_SECRET is defined in
 * wp-config.php.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_JWT
{
    public static function secret()
    {
        if (defined('C767_JWT_SECRET') && C767_JWT_SECRET) {
            return C767_JWT_SECRET;
        }
        $key = (defined('AUTH_KEY') && AUTH_KEY) ? AUTH_KEY : 'connect767-fallback-secret-change-me';
        $salt = (defined('AUTH_SALT') && AUTH_SALT) ? AUTH_SALT : '';
        return $key . $salt;
    }

    public static function issue($payload, $ttlSeconds = DAY_IN_SECONDS * 14)
    {
        $header = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));

        $payload['iat'] = time();
        $payload['exp'] = time() + $ttlSeconds;
        $body = self::base64UrlEncode(json_encode($payload));

        $signature = self::sign("$header.$body");

        return "$header.$body.$signature";
    }

    /** Returns the decoded payload array, or a WP_Error if invalid/expired. */
    public static function verify($token)
    {
        $parts = explode('.', (string) $token);
        if (count($parts) !== 3) {
            return new WP_Error('c767_bad_token', 'Malformed token.', ['status' => 401]);
        }
        [$header, $body, $signature] = $parts;

        $expected = self::sign("$header.$body");
        if (!hash_equals($expected, $signature)) {
            return new WP_Error('c767_bad_signature', 'Invalid token signature.', ['status' => 401]);
        }

        $payload = json_decode(self::base64UrlDecode($body), true);
        if (!is_array($payload)) {
            return new WP_Error('c767_bad_payload', 'Invalid token payload.', ['status' => 401]);
        }

        if (isset($payload['exp']) && time() > $payload['exp']) {
            return new WP_Error('c767_expired_token', 'Token has expired.', ['status' => 401]);
        }

        return $payload;
    }

    /** Pulls "Bearer <token>" out of the Authorization header, if present. */
    public static function bearer_token_from_request(WP_REST_Request $request)
    {
        $header = $request->get_header('authorization');
        if (!$header) {
            return null;
        }
        if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
            return trim($matches[1]);
        }
        return null;
    }

    private static function sign($data)
    {
        return self::base64UrlEncode(hash_hmac('sha256', $data, self::secret(), true));
    }

    private static function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode($data)
    {
        $padded = str_pad($data, strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + 4 - strlen($data) % 4, '=');
        return base64_decode(strtr($padded, '-_', '+/'));
    }
}
