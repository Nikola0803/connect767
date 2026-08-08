<?php
/**
 * POST /connect767/v1/uniform-quotes — the Uniform Studio's roster/quote
 * request (src/pages/UniformStudioPage.jsx). Stores the full design state
 * (layers, colors, roster) as a private `uniform_quote` post and emails the
 * site admin, rather than trying to re-render the design server-side —
 * the client-generated PNG preview is stored as-is.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Uniform_Quotes
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/uniform-quotes', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'submit'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function submit(WP_REST_Request $request)
    {
        $template = sanitize_text_field((string) $request->get_param('template'));
        $roster = (array) $request->get_param('roster');

        if (empty($roster)) {
            return new WP_Error('c767_empty_roster', 'At least one player is required.', ['status' => 400]);
        }

        $title = sprintf(
            '%s — %d player%s — %s',
            $template ?: 'Custom design',
            count($roster),
            count($roster) === 1 ? '' : 's',
            current_time('Y-m-d H:i')
        );

        $post_id = wp_insert_post([
            'post_type' => 'uniform_quote',
            'post_status' => 'private',
            'post_title' => $title,
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('c767_quote_failed', $post_id->get_error_message(), ['status' => 400]);
        }

        $payload = [
            'template' => $template,
            'collar' => sanitize_text_field((string) $request->get_param('collar')),
            'sleeve' => sanitize_text_field((string) $request->get_param('sleeve')),
            'colors' => self::sanitize_shallow_array($request->get_param('colors')),
            'layers' => $request->get_param('layers'),
            'roster' => $roster,
        ];

        update_post_meta($post_id, 'quote_payload', wp_json_encode($payload));
        update_post_meta($post_id, 'roster_count', count($roster));

        // The preview image is a large base64 PNG from html-to-image — store
        // it as its own meta key so it's easy to skip when just listing quotes.
        $preview = (string) $request->get_param('previewImage');
        if ($preview) {
            update_post_meta($post_id, 'preview_image', $preview);
        }

        $user = get_user_by('id', get_current_user_id());
        $to = get_option('admin_email');
        $subject = sprintf('[Connect767] New uniform quote request — %d players', count($roster));
        $body = sprintf(
            "Template: %s\nPlayers: %d\nSubmitted by: %s\n\nView in wp-admin: %s",
            $template ?: 'Custom design',
            count($roster),
            $user ? $user->user_email : 'Guest',
            admin_url('post.php?post=' . $post_id . '&action=edit')
        );
        wp_mail($to, $subject, $body);

        do_action('c767_uniform_quote_submitted', $post_id);

        return rest_ensure_response([
            'id' => $post_id,
            'message' => "We've received your quote request.",
        ]);
    }

    private static function sanitize_shallow_array($value)
    {
        $out = [];
        foreach ((array) $value as $key => $v) {
            $out[sanitize_key($key)] = sanitize_text_field((string) $v);
        }
        return $out;
    }
}
