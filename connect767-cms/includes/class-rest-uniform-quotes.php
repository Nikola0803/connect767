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
        $roster = self::sanitize_roster($request->get_param('roster'));

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

        $unit_count = self::roster_unit_count($roster);
        $title = sprintf(
            '%s — %d kit%s — %s',
            $template ?: 'Custom design',
            $unit_count,
            $unit_count === 1 ? '' : 's',
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
            'fitType' => sanitize_text_field((string) $request->get_param('fitType')),
            'kitType' => sanitize_text_field((string) $request->get_param('kitType')),
            'logoApplication' => sanitize_text_field((string) $request->get_param('logoApplication')),
            'insideCollarMessage' => rest_sanitize_boolean($request->get_param('insideCollarMessage')),
            'insideCollarText' => sanitize_text_field((string) $request->get_param('insideCollarText')),
            'fanJerseyAdded' => rest_sanitize_boolean($request->get_param('fanJerseyAdded')),
            'supporterJerseys' => self::sanitize_supporter_jerseys($request->get_param('supporterJerseys')),
            'unitPrice' => round((float) $request->get_param('unitPrice'), 2),
            'grandTotal' => round((float) $request->get_param('grandTotal'), 2),
            'unitCount' => $unit_count,
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
        update_post_meta($post_id, 'unit_count', $unit_count);

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
            '[Connect767] Uniform quote — %s — %d kits',
            $contact['club'] !== '' ? $contact['club'] : ($contact['name'] !== '' ? $contact['name'] : 'New request'),
            $unit_count
        );
        $body = sprintf(
            "Template: %s\nSport: %s\nKits: %d\n\n"
                . "FROM\n  Name:  %s\n  Email: %s\n  Phone: %s\n  Club:  %s\n\nNotes:\n%s\n\n"
                . "Account: %s\n\nView in wp-admin: %s",
            $template ?: 'Custom design',
            sanitize_text_field((string) $request->get_param('sport')) ?: 'n/a',
            $unit_count,
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
                    "Hi %s,\n\nThanks — we've got your %s design for %d kit%s.\n\n"
                        . "Our team will follow up with pricing and a production proof, usually "
                        . "within one business day.\n\n— Connect767",
                    $contact['name'] !== '' ? $contact['name'] : 'there',
                    $template ?: 'custom',
                    $unit_count,
                    $unit_count === 1 ? '' : 's'
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

    /**
     * Preserve the production fields required for a full team order while
     * rejecting arbitrary keys from this public endpoint.
     */
    private static function sanitize_roster($value)
    {
        $out = [];
        foreach ((array) $value as $entry) {
            $in = (array) $entry;
            $name = sanitize_text_field((string) ($in['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $out[] = [
                'id' => sanitize_text_field((string) ($in['id'] ?? '')),
                'name' => $name,
                'number' => sanitize_text_field((string) ($in['number'] ?? '')),
                'shortsNumber' => sanitize_text_field((string) ($in['shortsNumber'] ?? '')),
                'shirtSize' => sanitize_text_field((string) ($in['shirtSize'] ?? '')),
                'shortSize' => sanitize_text_field((string) ($in['shortSize'] ?? '')),
                'sockSize' => sanitize_text_field((string) ($in['sockSize'] ?? '')),
                'bottomLength' => sanitize_text_field((string) ($in['bottomLength'] ?? '')),
                'sleevePreference' => sanitize_text_field((string) ($in['sleevePreference'] ?? '')),
                'role' => sanitize_text_field((string) ($in['role'] ?? 'Player')),
                'quantity' => max(1, min(99, absint($in['quantity'] ?? 1))),
                'notes' => sanitize_textarea_field((string) ($in['notes'] ?? '')),
            ];
        }
        return $out;
    }

    private static function roster_unit_count($roster)
    {
        return array_reduce($roster, function ($total, $entry) {
            return $total + max(1, absint($entry['quantity'] ?? 1));
        }, 0);
    }

    private static function sanitize_supporter_jerseys($value)
    {
        $allowed_sizes = ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'];
        $combined = [];
        foreach ((array) $value as $entry) {
            $row = (array) $entry;
            $size = strtoupper(sanitize_text_field((string) ($row['size'] ?? '')));
            if (!in_array($size, $allowed_sizes, true)) {
                continue;
            }
            $quantity = max(1, min(99, absint($row['quantity'] ?? 1)));
            $combined[$size] = min(99, ($combined[$size] ?? 0) + $quantity);
        }
        return array_map(function ($size, $quantity) {
            return ['size' => $size, 'quantity' => $quantity];
        }, array_keys($combined), array_values($combined));
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
