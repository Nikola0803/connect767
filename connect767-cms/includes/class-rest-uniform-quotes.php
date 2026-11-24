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
    const MAX_REQUEST_BYTES = 12582912;
    const MAX_PREVIEW_BYTES = 5242880;

    public static function minimum_full_kits($sport)
    {
        $minimums = ['soccer' => 22, 'basketball' => 10, 'cricket' => 20, 'netball' => 10, 'goalkeeper' => 1, 'other' => 10];
        return $minimums[sanitize_key((string) $sport)] ?? 1;
    }

    public static function validate_full_kit_minimum($sport, $unit_count)
    {
        $minimum = self::minimum_full_kits($sport);
        if ($unit_count < $minimum) {
            return new WP_Error('c767_kit_minimum', sprintf(
                'Minimum order: %d full kits for %s. Extra shirts do not count toward this minimum.',
                $minimum,
                sanitize_key((string) $sport) ?: 'this sport'
            ), ['status' => 400, 'minimumKits' => $minimum, 'kitCount' => $unit_count]);
        }
        return true;
    }

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
        $limited = C767_Stripe_Checkout::check_public_rate_limit('uniform-quote', 10, HOUR_IN_SECONDS);
        if (is_wp_error($limited)) {
            return $limited;
        }
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return new WP_Error('c767_account_required', 'Sign in before requesting a uniform quote.', ['status' => 401]);
        }
        if (strlen(wp_json_encode($request->get_params())) > self::MAX_REQUEST_BYTES) {
            return new WP_Error('c767_quote_too_large', 'The quote request is too large. Remove oversized previews or attachments and try again.', ['status' => 413]);
        }
        $raw_designs = (array) $request->get_param('designs');
        if (empty($raw_designs)) $raw_designs = [(array) $request->get_params()];
        if (count($raw_designs) > 10) return new WP_Error('c767_too_many_designs', 'A quote can contain up to 10 uniform designs.', ['status' => 400]);
        $quote_designs = [];
        $unit_count = 0;
        foreach ($raw_designs as $index => $raw_design) {
            $design = self::sanitize_quote_design((array) $raw_design);
            if (empty($design['roster'])) return new WP_Error('c767_empty_roster', 'At least one player is required for design ' . ($index + 1) . '.', ['status' => 400]);
            $design_unit_count = self::roster_unit_count($design['roster']);
            $minimum_check = self::validate_full_kit_minimum($design['sport'], $design_unit_count);
            if (is_wp_error($minimum_check)) return $minimum_check;
            $design['unitCount'] = $design_unit_count;
            $unit_count += $design_unit_count;
            $quote_designs[] = $design;
        }
        $template = $quote_designs[0]['template'];
        $roster = $quote_designs[0]['roster'];

        // Validate the reachable contact address independently of account auth.
        $contact_email = sanitize_email((string) (((array) $request->get_param('contact'))['email'] ?? ''));
        if (!is_email($contact_email)) {
            return new WP_Error(
                'c767_contact_required',
                'A valid email address is required so we can send the quote back.',
                ['status' => 400]
            );
        }

        $title = sprintf(
            '%s%s — %d kit%s — %s',
            $template ?: 'Custom design',
            count($quote_designs) > 1 ? ' +' . (count($quote_designs) - 1) . ' design' . (count($quote_designs) === 2 ? '' : 's') : '',
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
        $collar_attachment = rest_sanitize_boolean($request->get_param('insideCollarMessage'))
            ? self::sanitize_collar_attachment($request->get_param('insideCollarAttachment')) : null;
        if ($collar_attachment) {
            update_post_meta($post_id, 'inside_collar_attachment', $collar_attachment);
        }

        $payload = $quote_designs[0];
        $payload['designs'] = $quote_designs;
        $payload['designCount'] = count($quote_designs);
        $payload['unitCount'] = $unit_count;
        $payload['grandTotal'] = round((float) $request->get_param('grandTotal'), 2);
        $payload['contact'] = $contact;

        update_post_meta($post_id, 'quote_payload', wp_json_encode($payload));
        update_post_meta($post_id, 'roster_count', count($roster));
        update_post_meta($post_id, 'unit_count', $unit_count);
        update_post_meta($post_id, 'design_count', count($quote_designs));

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
        if ($preview && strpos($preview, 'data:image/') === 0 && strlen($preview) <= self::MAX_PREVIEW_BYTES) {
            update_post_meta($post_id, 'preview_image', $preview);
        }
        foreach ($raw_designs as $index => $raw_design) {
            $design_preview = (string) (((array) $raw_design)['previewImage'] ?? '');
            if (strpos($design_preview, 'data:image/') === 0 && strlen($design_preview) <= 5242880) {
                update_post_meta($post_id, 'preview_image_' . ($index + 1), $design_preview);
            }
        }

        $user = get_user_by('id', get_current_user_id());
        $to = get_option('admin_email');
        $subject = sprintf(
            '[Connect767] Uniform quote — %s — %d design%s / %d kits',
            $contact['club'] !== '' ? $contact['club'] : ($contact['name'] !== '' ? $contact['name'] : 'New request'),
            count($quote_designs),
            count($quote_designs) === 1 ? '' : 's',
            $unit_count
        );
        $body = sprintf(
            "Template: %s\nSport: %s\nDesigns: %d\nKits: %d\n\n"
                . "FROM\n  Name:  %s\n  Email: %s\n  Phone: %s\n  Club:  %s\n\nNotes:\n%s\n\n"
                . "Account: %s\n\nView in wp-admin: %s",
            $template ?: 'Custom design',
            $quote_designs[0]['sport'] ?: 'n/a',
            count($quote_designs),
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
        C767_Notifications::send_branded_mail(
            $to,
            $subject,
            $body,
            $headers,
            ['cta_url' => admin_url('post.php?post=' . $post_id . '&action=edit'), 'cta_label' => 'Review quote']
        );

        // Acknowledgement to the customer. Someone who has just spent twenty
        // minutes designing a kit and hit send with no confirmation has no way
        // to tell whether it worked.
        if ($contact['email'] !== '') {
            C767_Notifications::send_branded_mail(
                $contact['email'],
                'We received your Connect767 uniform quote request',
                sprintf(
                    "Hi %s,\n\nThanks — we've got your %d uniform design%s for %d kit%s.\n\n"
                        . "Our team will follow up with pricing and a production proof, usually "
                        . "within one business day.\n\n— Connect767",
                    $contact['name'] !== '' ? $contact['name'] : 'there',
                    count($quote_designs),
                    count($quote_designs) === 1 ? '' : 's',
                    $unit_count,
                    $unit_count === 1 ? '' : 's'
                ),
                [],
                [
                    'cta_url' => c767_frontend_url('/uniforms'),
                    'cta_label' => 'Return to Uniform Studio',
                ]
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
    public static function sanitize_collar_attachment($value)
    {
        if (!is_array($value)) return null;
        $src = (string) ($value['src'] ?? '');
        if (strlen($src) > 2800000 || !preg_match('#^data:(image/png|image/jpeg|image/webp|application/pdf);base64,([A-Za-z0-9+/=]+)$#D', $src, $matches)) return null;
        $bytes = base64_decode($matches[2], true);
        if ($bytes === false || strlen($bytes) === 0 || strlen($bytes) > 2097152) return null;
        if ($matches[1] === 'application/pdf') {
            if (strpos($bytes, '%PDF-') !== 0) return null;
        } else {
            $image = @getimagesizefromstring($bytes);
            if (!$image || ($image['mime'] ?? '') !== $matches[1]) return null;
        }
        return ['name' => sanitize_file_name((string) ($value['name'] ?? 'collar-artwork')), 'type' => $matches[1], 'size' => strlen($bytes), 'src' => $src];
    }

    private static function sanitize_quote_design(array $input)
    {
        $collar_attachment = rest_sanitize_boolean($input['insideCollarMessage'] ?? false)
            ? self::sanitize_collar_attachment($input['insideCollarAttachment'] ?? null) : null;
        return [
            'template' => sanitize_text_field((string) ($input['template'] ?? 'Custom design')),
            'templateSlug' => sanitize_key((string) ($input['templateSlug'] ?? '')),
            'sport' => sanitize_key((string) ($input['sport'] ?? '')),
            'collar' => sanitize_text_field((string) ($input['collar'] ?? '')),
            'sleeve' => sanitize_text_field((string) ($input['sleeve'] ?? '')),
            'fitType' => sanitize_text_field((string) ($input['fitType'] ?? '')),
            'kitType' => 'Full',
            'extraTeamShirts' => self::sanitize_supporter_jerseys($input['extraTeamShirts'] ?? []),
            'logoApplication' => sanitize_text_field((string) ($input['logoApplication'] ?? '')),
            'insideCollarMessage' => rest_sanitize_boolean($input['insideCollarMessage'] ?? false),
            'insideCollarText' => sanitize_text_field((string) ($input['insideCollarText'] ?? '')),
            'insideCollarAttachment' => $collar_attachment ? array_diff_key($collar_attachment, ['src' => true]) : null,
            'fanJerseyAdded' => rest_sanitize_boolean($input['fanJerseyAdded'] ?? false),
            'supporterJerseys' => self::sanitize_supporter_jerseys($input['supporterJerseys'] ?? []),
            'unitPrice' => round((float) ($input['unitPrice'] ?? 0), 2),
            'grandTotal' => round((float) ($input['grandTotal'] ?? 0), 2),
            'colors' => self::sanitize_shallow_array($input['colors'] ?? []),
            'layers' => $input['layers'] ?? [],
            'placements3d' => $input['placements3d'] ?? [],
            'designMode' => sanitize_text_field((string) ($input['designMode'] ?? 'flat')),
            'roster' => self::sanitize_roster($input['roster'] ?? []),
            'socksQuantity' => absint($input['socksQuantity'] ?? 0),
            'projectId' => sanitize_text_field((string) ($input['projectId'] ?? '')),
            'aiPromptHistory' => self::sanitize_prompt_history($input['aiPromptHistory'] ?? []),
        ];
    }

    private static function sanitize_prompt_history($value)
    {
        $out = [];
        foreach (array_slice((array) $value, 0, 100) as $entry) {
            $row = (array) $entry;
            $response = $row['response'] ?? '';
            if (!is_string($response)) $response = wp_json_encode($response);
            $out[] = [
                'id' => sanitize_text_field((string) ($row['id'] ?? '')),
                'prompt' => sanitize_textarea_field((string) ($row['prompt'] ?? '')),
                'mode' => sanitize_key((string) ($row['mode'] ?? 'uniform')),
                'kind' => sanitize_text_field((string) ($row['kind'] ?? 'AI design')),
                'brandName' => sanitize_text_field((string) ($row['brandName'] ?? '')),
                'style' => sanitize_text_field((string) ($row['style'] ?? '')),
                'response' => sanitize_textarea_field((string) $response),
                'createdAt' => sanitize_text_field((string) ($row['createdAt'] ?? '')),
            ];
        }
        return $out;
    }

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
