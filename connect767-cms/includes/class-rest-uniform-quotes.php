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

        // This route is public (no auth), so the frontend's own check can't be
        // trusted — a quote with no reachable email is unactionable, and
        // accepting it silently is worse than rejecting it loudly.
        $contact_email = sanitize_email((string) (((array) $request->get_param('contact'))['email'] ?? ''));
        if (!is_email($contact_email)) {
            return new WP_Error(
                'c767_contact_required',
                'A valid email address is required so we can send the quote back.',
                ['status' => 400]
            );
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

        $contact = self::sanitize_contact($request->get_param('contact'));

        $payload = [
            'template' => $template,
            'sport' => sanitize_text_field((string) $request->get_param('sport')),
            'collar' => sanitize_text_field((string) $request->get_param('collar')),
            'sleeve' => sanitize_text_field((string) $request->get_param('sleeve')),
            'colors' => self::sanitize_shallow_array($request->get_param('colors')),
            'layers' => $request->get_param('layers'),
            // Where each piece of artwork actually sits on the garment, as
            // placed in the 3D configurator. Without this the quote carried
            // only the flat editor's default coordinates, so a crest dragged
            // onto the left chest reached production dead-centre.
            'placements3d' => $request->get_param('placements3d'),
            // 'flat' or '3d' — tells production which coordinate system is
            // authoritative for this design.
            'designMode' => sanitize_text_field((string) $request->get_param('designMode')),
            'roster' => $roster,
            'contact' => $contact,
        ];

        update_post_meta($post_id, 'quote_payload', wp_json_encode($payload));
        update_post_meta($post_id, 'roster_count', count($roster));

        // Promoted out of the payload blob so wp-admin can show and search
        // them as columns, and so a reply doesn't require opening the JSON.
        foreach ($contact as $key => $value) {
            if ($value !== '') {
                update_post_meta($post_id, 'contact_' . $key, $value);
            }
        }

        // The preview image is a large base64 PNG from html-to-image — store
        // it as its own meta key so it's easy to skip when just listing quotes.
        $preview = (string) $request->get_param('previewImage');
        if ($preview) {
            update_post_meta($post_id, 'preview_image', $preview);
        }

        $user = get_user_by('id', get_current_user_id());
        $to = get_option('admin_email');
        $subject = sprintf(
            '[Connect767] Uniform quote — %s — %d players',
            $contact['club'] !== '' ? $contact['club'] : ($contact['name'] !== '' ? $contact['name'] : 'New request'),
            count($roster)
        );
        $body = sprintf(
            "Template: %s\nSport: %s\nPlayers: %d\n\n"
                . "FROM\n  Name:  %s\n  Email: %s\n  Phone: %s\n  Club:  %s\n\nNotes:\n%s\n\n"
                . "Account: %s\n\nView in wp-admin: %s",
            $template ?: 'Custom design',
            sanitize_text_field((string) $request->get_param('sport')) ?: 'n/a',
            count($roster),
            $contact['name'] !== '' ? $contact['name'] : '(not given)',
            $contact['email'] !== '' ? $contact['email'] : '(not given)',
            $contact['phone'] !== '' ? $contact['phone'] : '(not given)',
            $contact['club'] !== '' ? $contact['club'] : '(not given)',
            $contact['notes'] !== '' ? $contact['notes'] : '(none)',
            $user ? $user->user_email : 'Guest (not signed in)',
            admin_url('post.php?post=' . $post_id . '&action=edit')
        );

        // Reply-To the customer, so hitting reply in the inbox actually
        // reaches them instead of bouncing back to the site's own address.
        $headers = [];
        if ($contact['email'] !== '') {
            $headers[] = sprintf(
                'Reply-To: %s <%s>',
                $contact['name'] !== '' ? $contact['name'] : $contact['email'],
                $contact['email']
            );
        }
        wp_mail($to, $subject, $body, $headers);

        // Acknowledgement to the customer. Someone who has just spent twenty
        // minutes designing a kit and hit send with no confirmation has no way
        // to tell whether it worked.
        if ($contact['email'] !== '') {
            wp_mail(
                $contact['email'],
                'We received your Connect767 uniform quote request',
                sprintf(
                    "Hi %s,\n\nThanks — we've got your %s design for %d player%s.\n\n"
                        . "Our team will follow up with pricing and a production proof, usually "
                        . "within one business day.\n\n— Connect767",
                    $contact['name'] !== '' ? $contact['name'] : 'there',
                    $template ?: 'custom',
                    count($roster),
                    count($roster) === 1 ? '' : 's'
                )
            );
        }

        do_action('c767_uniform_quote_submitted', $post_id);

        return rest_ensure_response([
            'id' => $post_id,
            'message' => "We've received your quote request.",
        ]);
    }

    /**
     * Customer contact block. Kept to a fixed set of keys rather than passing
     * the posted object through, so a crafted request can't write arbitrary
     * meta. Email is validated rather than merely escaped — an unusable
     * address defeats the whole point of collecting it.
     */
    private static function sanitize_contact($value)
    {
        $in = (array) $value;
        $email = sanitize_email((string) ($in['email'] ?? ''));

        return [
            'name' => sanitize_text_field((string) ($in['name'] ?? '')),
            'email' => is_email($email) ? $email : '',
            'phone' => sanitize_text_field((string) ($in['phone'] ?? '')),
            'club' => sanitize_text_field((string) ($in['club'] ?? '')),
            'notes' => sanitize_textarea_field((string) ($in['notes'] ?? '')),
        ];
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
