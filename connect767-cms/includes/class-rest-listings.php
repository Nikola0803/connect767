<?php
/**
 * POST /connect767/v1/listings — authenticated write endpoint for
 * src/pages/AddListingPage.jsx. Creates the listing as `pending` rather
 * than writing directly to wp/v2/listing, so submissions go through
 * moderation before appearing in the public directory.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Listings
{
    const NAMESPACE_ = 'connect767/v1';
    const RENTAL_BOOKING_TYPES = [
        'rental', 'apartments', 'audio-equipment', 'boats', 'electronics',
        'heavy-equipment', 'hotels', 'jet-ski', 'long-term-rental-housing',
        'musical-equipment', 'short-term-rental-housing', 'tools', 'vehicles',
        'video-equipment', 'video-games',
    ];

    private static function sanitize_booking_type($value)
    {
        $type = sanitize_key((string) $value);
        return $type === 'appointment' || in_array($type, self::RENTAL_BOOKING_TYPES, true)
            ? $type
            : 'appointment';
    }

    private static function payout_encryption_key()
    {
        return hash('sha256', wp_salt('auth') . '|connect767-booking-payout-v1', true);
    }

    /** Payout destinations are private listing-owner data and are encrypted at rest. */
    private static function encrypt_payout_details($details)
    {
        if (!function_exists('openssl_encrypt')) {
            return new WP_Error('c767_payout_encryption_unavailable', 'Secure payout storage is unavailable. Please contact Connect767 support.', ['status' => 503]);
        }
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt(
            wp_json_encode($details),
            'aes-256-gcm',
            self::payout_encryption_key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );
        if ($ciphertext === false) {
            return new WP_Error('c767_payout_encryption_failed', 'Payout details could not be secured. Please try again.', ['status' => 500]);
        }
        return base64_encode($iv . $tag . $ciphertext);
    }

    private static function decrypt_payout_details($payload)
    {
        if (!$payload || !function_exists('openssl_decrypt')) {
            return [];
        }
        $decoded = base64_decode((string) $payload, true);
        if ($decoded === false || strlen($decoded) <= 28) {
            return [];
        }
        $plaintext = openssl_decrypt(
            substr($decoded, 28),
            'aes-256-gcm',
            self::payout_encryption_key(),
            OPENSSL_RAW_DATA,
            substr($decoded, 0, 12),
            substr($decoded, 12, 16)
        );
        $details = $plaintext === false ? null : json_decode($plaintext, true);
        return is_array($details) ? $details : [];
    }

    /** Private helper for the administrator payout queue; never exposed over REST. */
    public static function payout_destination_for_admin($listing_id)
    {
        if (!current_user_can('manage_options')) {
            return [];
        }
        return [
            'method' => (string) get_post_meta((int) $listing_id, '_booking_payout_method', true),
            'details' => self::decrypt_payout_details(get_post_meta((int) $listing_id, '_booking_payout_details', true)),
        ];
    }

    private static function sanitize_payout_details(WP_REST_Request $request, $required)
    {
        $method = sanitize_key((string) $request->get_param('bookingPayoutMethod'));
        if (!$required && !in_array($method, ['bank', 'digital'], true)) {
            return ['method' => '', 'details' => []];
        }
        if (!in_array($method, ['bank', 'digital'], true)) {
            return new WP_Error('c767_payout_required', 'Choose where Connect767 should send your booking payouts.', ['status' => 400]);
        }

        if ($method === 'bank') {
            $details = [
                'accountName' => sanitize_text_field((string) $request->get_param('bookingPayoutAccountName')),
                'bankName' => sanitize_text_field((string) $request->get_param('bookingPayoutBankName')),
                'bankCountry' => sanitize_text_field((string) $request->get_param('bookingPayoutBankCountry')),
                'accountNumber' => preg_replace('/[^A-Za-z0-9 .-]/', '', (string) $request->get_param('bookingPayoutAccountNumber')),
                'routingNumber' => preg_replace('/[^A-Za-z0-9 -]/', '', (string) $request->get_param('bookingPayoutRoutingNumber')),
                'swiftCode' => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $request->get_param('bookingPayoutSwiftCode'))),
            ];
            if ($required && (!$details['accountName'] || !$details['bankName'] || !$details['bankCountry'] || !$details['accountNumber'] || (!$details['routingNumber'] && !$details['swiftCode']))) {
                return new WP_Error('c767_incomplete_bank_payout', 'Complete the bank payout details, including a routing number or SWIFT/BIC.', ['status' => 400]);
            }
        } else {
            $providers = ['NBD MoBanking', 'Remitly', 'PayPal', 'Wise', 'Zelle', 'Cash App', 'Venmo', 'Other digital wallet'];
            $provider = sanitize_text_field((string) $request->get_param('bookingPayoutDigitalProvider'));
            $details = [
                'digitalProvider' => in_array($provider, $providers, true) ? $provider : '',
                'digitalAccount' => sanitize_text_field((string) $request->get_param('bookingPayoutDigitalAccount')),
            ];
            if ($required && (!$details['digitalProvider'] || !$details['digitalAccount'])) {
                return new WP_Error('c767_incomplete_digital_payout', 'Choose a digital payment provider and enter its payout email, username, or handle.', ['status' => 400]);
            }
        }

        return ['method' => $method, 'details' => $details];
    }

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    /**
     * Resolve the wizard's submitted category slug (an *industry* slug like
     * "accounting-and-bookkeeping") to a term ID it's safe to assign.
     *
     * The old code passed the raw slug string straight to
     * wp_set_object_terms(). When that industry term didn't exist yet,
     * WordPress created a brand-new TOP-LEVEL term named after the slug —
     * which is exactly how "accounting-and-bookkeeping" ended up sitting
     * next to Services/Products/Rentals as a major category on the
     * directory page and the homepage pills.
     *
     * Now: reuse the existing term if there is one; otherwise create it
     * under its canonical parent from data/category-taxonomy.json (creating
     * the parent too if needed). Returns an int term_id, or 0 if the slug
     * isn't in the canonical taxonomy and doesn't already exist — in that
     * case nothing gets assigned rather than polluting the taxonomy.
     */
    private static function resolve_category_term($slug)
    {
        $taxonomy_file = C767_PLUGIN_DIR . 'data/category-taxonomy.json';
        if (!file_exists($taxonomy_file)) {
            return 0;
        }
        $taxonomy = json_decode(file_get_contents($taxonomy_file), true);
        if (!is_array($taxonomy)) {
            return 0;
        }

        foreach ($taxonomy as $cat) {
            // The submitted slug can also be a top-level category slug.
            if (($cat['slug'] ?? '') === $slug) {
                $existing = get_term_by('slug', $slug, 'listing_category');
                if ($existing && !is_wp_error($existing)) {
                    return (int) $existing->term_id;
                }
                $created = wp_insert_term($cat['label'], 'listing_category', ['slug' => $cat['slug']]);
                return is_wp_error($created) ? 0 : (int) $created['term_id'];
            }
            foreach ($cat['industries'] ?? [] as $industry) {
                if (($industry['slug'] ?? '') !== $slug) {
                    continue;
                }
                // Ensure the parent category term exists first.
                $parent = get_term_by('slug', $cat['slug'], 'listing_category');
                if ($parent && !is_wp_error($parent)) {
                    $parent_id = (int) $parent->term_id;
                } else {
                    $created_parent = wp_insert_term($cat['label'], 'listing_category', ['slug' => $cat['slug']]);
                    if (is_wp_error($created_parent)) {
                        return 0;
                    }
                    $parent_id = (int) $created_parent['term_id'];
                }

                // Repair an existing canonical industry if an older plugin
                // version created it as a top-level term. Reusing it without
                // fixing the parent leaves cards and category filters with no
                // trustworthy parent-category relationship.
                $existing = get_term_by('slug', $slug, 'listing_category');
                if ($existing && !is_wp_error($existing)) {
                    if ((int) $existing->parent !== $parent_id || $existing->name !== $industry['label']) {
                        $updated = wp_update_term($existing->term_id, 'listing_category', [
                            'parent' => $parent_id,
                            'name' => $industry['label'],
                        ]);
                        if (is_wp_error($updated)) {
                            return 0;
                        }
                    }
                    return (int) $existing->term_id;
                }

                $created = wp_insert_term($industry['label'], 'listing_category', [
                    'slug' => $industry['slug'],
                    'parent' => $parent_id,
                ]);
                return is_wp_error($created) ? 0 : (int) $created['term_id'];
            }
        }

        return 0;
    }

    /**
     * Assign the resolved category term (plus its parent, so the listing is
     * findable when filtering by the top-level category alone).
     */
    private static function assign_category($post_id, $slug)
    {
        $term_id = self::resolve_category_term($slug);
        if (!$term_id) {
            return new WP_Error('c767_invalid_category', 'Choose a valid industry from the listing form.', ['status' => 400]);
        }
        $term_ids = [$term_id];
        $term = get_term($term_id, 'listing_category');
        if ($term && !is_wp_error($term) && $term->parent) {
            $term_ids[] = (int) $term->parent;
        }
        $assigned = wp_set_object_terms($post_id, $term_ids, 'listing_category');
        if (is_wp_error($assigned)) {
            return new WP_Error('c767_category_save_failed', 'The industry and parent category could not be saved. Please try again.', ['status' => 500]);
        }
        update_post_meta($post_id, 'category_slug', $slug);
        return true;
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/listings', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'submit'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/mine', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'mine'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        // Edit an existing listing — src/pages/AddListingPage.jsx reuses the
        // same wizard in "edit mode" (route /listings/:slug/edit) rather than
        // a separate form. POST rather than PUT/PATCH so PHP still populates
        // $_FILES for a replaced logo/cover/gallery photo the same way
        // submit() relies on — PUT requests don't get that multipart parsing
        // without extra plumbing WordPress doesn't do for us.
        register_rest_route(self::NAMESPACE_, '/listings/(?P<id>\d+)', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'update'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/(?P<id>\d+)/booking', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'set_booking_enabled'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/(?P<id>\d+)/booking', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'get_booking_settings'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/(?P<id>\d+)/tier', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'set_tier'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);
    }

    /**
     * Owner-initiated plan change from the account dashboard.
     *
     * update() deliberately never touches `tier`, because moving to Classified
     * is a paid action rather than a plain edit — but that left an existing
     * Free listing with no route to upgrade at all, short of deleting it and
     * starting the wizard again.
     *
     * Upgrading marks the listing Classified/unpaid exactly as submit() does,
     * and returns `paymentRequired` so the client can send the owner through
     * the same Stripe/PayPal flow the submission wizard already uses. Nothing
     * here grants a paid tier for free: `payment_status` stays `unpaid` until
     * the payment callback clears it.
     */
    public static function set_tier(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user->ID) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
        }

        $wants_classified = $request->get_param('tier') === 'classified';
        $tier = $wants_classified ? 'Classified' : 'Free';
        $already_paid = get_post_meta($post_id, 'payment_status', true) === 'paid';

        update_post_meta($post_id, 'tier', $tier);
        update_post_meta(
            $post_id,
            'payment_status',
            $wants_classified ? ($already_paid ? 'paid' : 'unpaid') : 'n/a'
        );

        return rest_ensure_response([
            'id' => $post_id,
            'tier' => $tier,
            'paymentRequired' => $wants_classified && !$already_paid,
        ]);
    }

    /**
     * Owner-only on/off switch for a listing's public "Request a booking"
     * form — DashboardPage.jsx's per-listing toggle. Anyone can flip their
     * own listing's switch regardless of tier; there's no plan requirement
     * on this, unlike Classified's paid Stripe gate.
     */
    private static function owned_listing_for_booking(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user->ID) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
        }

        return $post;
    }

    public static function get_booking_settings(WP_REST_Request $request)
    {
        $post = self::owned_listing_for_booking($request);
        if (is_wp_error($post)) {
            return $post;
        }

        $payout = self::decrypt_payout_details(get_post_meta($post->ID, '_booking_payout_details', true));
        return rest_ensure_response([
            'id' => $post->ID,
            'bookingEnabled' => get_post_meta($post->ID, 'booking_enabled', true) === '1',
            'hideContactInfo' => get_post_meta($post->ID, 'hide_contact_info', true) === '1',
            // Owner-only contact values. Public listing REST responses redact
            // these when hide_contact_info is enabled.
            'phone' => (string) get_post_meta($post->ID, 'phone', true),
            'email' => (string) get_post_meta($post->ID, 'email', true),
            'website' => (string) get_post_meta($post->ID, 'website', true),
            'instagram' => (string) get_post_meta($post->ID, 'instagram', true),
            'facebook' => (string) get_post_meta($post->ID, 'facebook', true),
            'youtube' => (string) get_post_meta($post->ID, 'youtube', true),
            'twitter' => (string) get_post_meta($post->ID, 'twitter', true),
            'whatsapp' => (string) get_post_meta($post->ID, 'whatsapp', true),
            'bookingType' => self::sanitize_booking_type(get_post_meta($post->ID, 'booking_type', true)),
            'bookingPriceCents' => (int) get_post_meta($post->ID, 'booking_price_cents', true),
            'bookingDurationMinutes' => (int) (get_post_meta($post->ID, 'booking_duration_minutes', true) ?: 30),
            // Owner-authenticated endpoint only. This value is deliberately
            // absent from public listing REST metadata.
            'bookingMeetingUrl' => (string) get_post_meta($post->ID, 'booking_meeting_url', true),
            'bookingPayoutMethod' => (string) get_post_meta($post->ID, '_booking_payout_method', true),
            'bookingPayoutAccountName' => (string) ($payout['accountName'] ?? ''),
            'bookingPayoutBankName' => (string) ($payout['bankName'] ?? ''),
            'bookingPayoutBankCountry' => (string) ($payout['bankCountry'] ?? ''),
            'bookingPayoutAccountNumber' => (string) ($payout['accountNumber'] ?? ''),
            'bookingPayoutRoutingNumber' => (string) ($payout['routingNumber'] ?? ''),
            'bookingPayoutSwiftCode' => (string) ($payout['swiftCode'] ?? ''),
            'bookingPayoutDigitalProvider' => (string) ($payout['digitalProvider'] ?? ''),
            'bookingPayoutDigitalAccount' => (string) ($payout['digitalAccount'] ?? ''),
        ]);
    }

    public static function set_booking_enabled(WP_REST_Request $request)
    {
        $post = self::owned_listing_for_booking($request);
        if (is_wp_error($post)) {
            return $post;
        }

        $post_id = $post->ID;

        $enabled = filter_var($request->get_param('enabled'), FILTER_VALIDATE_BOOLEAN);
        $booking_type = self::sanitize_booking_type($request->get_param('bookingType'));
        $price_cents = max(0, min(10000000, (int) $request->get_param('bookingPriceCents')));
        // Privacy is available only while this profile is actually using a
        // paid Connect767 booking flow. A free/disabled booking cannot hide
        // every direct way for visitors to reach the listing owner.
        $hide_contact_info = $enabled
            && $price_cents > 0
            && filter_var($request->get_param('hideContactInfo'), FILTER_VALIDATE_BOOLEAN);
        $duration = max(15, min(480, (int) ($request->get_param('bookingDurationMinutes') ?: 30)));
        $meeting_url_raw = trim((string) $request->get_param('bookingMeetingUrl'));
        $meeting_url = $meeting_url_raw === '' ? '' : esc_url_raw($meeting_url_raw, ['https']);
        if ($meeting_url_raw !== '' && $meeting_url === '') {
            return new WP_Error('c767_bad_meeting_url', 'Meeting link must be a valid HTTPS URL.', ['status' => 400]);
        }
        $payout = self::sanitize_payout_details($request, $enabled && $price_cents > 0);
        if (is_wp_error($payout)) {
            return $payout;
        }
        $encrypted_payout = self::encrypt_payout_details($payout['details']);
        if (is_wp_error($encrypted_payout)) {
            return $encrypted_payout;
        }

        update_post_meta($post_id, 'booking_enabled', $enabled ? '1' : '0');
        update_post_meta($post_id, 'hide_contact_info', $hide_contact_info ? '1' : '0');
        update_post_meta($post_id, 'booking_type', $booking_type);
        update_post_meta($post_id, 'booking_price_cents', $price_cents);
        update_post_meta($post_id, 'booking_duration_minutes', $duration);
        update_post_meta($post_id, 'booking_meeting_url', $meeting_url);
        update_post_meta($post_id, '_booking_payout_method', $payout['method']);
        update_post_meta($post_id, '_booking_payout_details', $encrypted_payout);

        return rest_ensure_response([
            'id' => $post_id,
            'bookingEnabled' => $enabled,
            'hideContactInfo' => $hide_contact_info,
            'bookingType' => $booking_type,
            'bookingPriceCents' => $price_cents,
            'bookingDurationMinutes' => $duration,
            'bookingMeetingUrl' => $meeting_url,
            'bookingPayoutMethod' => $payout['method'],
            'bookingPayoutConfigured' => $payout['method'] !== '',
        ]);
    }

    /**
     * Powers the account dashboard (src/pages/DashboardPage.jsx) — every
     * listing the current authenticated user has ever submitted, whatever
     * its status (pending/publish/draft), so they can see submissions
     * still awaiting review as well as live ones. Deliberately not the
     * public wp/v2/listing endpoint, which only returns published posts
     * and has no concept of "owned by me".
     */
    public static function mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $posts = get_posts([
            'post_type' => 'listing',
            'post_status' => ['publish', 'pending', 'draft'],
            'author' => $user->ID,
            'numberposts' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);

        $results = array_map(function ($post) {
            $terms = get_the_terms($post->ID, 'listing_category');
            $category_names = $terms && !is_wp_error($terms)
                ? implode(', ', wp_list_pluck($terms, 'name'))
                : '';

            return [
                'id' => $post->ID,
                'slug' => $post->post_name,
                'title' => $post->post_title,
                'status' => $post->post_status,
                'category' => $category_names,
                'tier' => get_post_meta($post->ID, 'tier', true) ?: 'Free',
                'paymentStatus' => get_post_meta($post->ID, 'payment_status', true) ?: 'n/a',
                'location' => get_post_meta($post->ID, 'location_display', true) ?: '',
                'rating' => get_post_meta($post->ID, 'rating', true) ?: '0',
                'reviewCount' => get_post_meta($post->ID, 'review_count', true) ?: '0',
                'bookingEnabled' => get_post_meta($post->ID, 'booking_enabled', true) === '1',
                'bookingType' => self::sanitize_booking_type(get_post_meta($post->ID, 'booking_type', true)),
                'bookingPriceCents' => (int) get_post_meta($post->ID, 'booking_price_cents', true),
                'bookingDurationMinutes' => (int) (get_post_meta($post->ID, 'booking_duration_minutes', true) ?: 30),
                'submittedAt' => $post->post_date,
                'viewUrl' => $post->post_status === 'publish' ? get_permalink($post->ID) : null,
            ];
        }, $posts);

        return rest_ensure_response($results);
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
    }

    /**
     * The logo/cover crop anchor is a closed set — the full 3x3 grid
     * PositionPicker in AddListingPage.jsx offers (top/bottom crossed with
     * left/right, plus the pure center/top/bottom/left/right edges).
     * Whitelisted rather than sanitize_text_field so a bad/missing value
     * always falls back to a sane default instead of saving something the
     * frontend's cssObjectPosition() won't recognize.
     */
    /**
     * Crop anchor for a logo or cover photo.
     *
     * Accepts a free-form "37% 62%" pair from the drag-to-reposition editor,
     * as well as the nine keyword anchors that editor replaced — listings
     * saved before the change keep working untouched, so there's no migration
     * and nothing already published shifts position.
     *
     * Percentages are clamped to 0-100 rather than merely pattern-matched, so
     * a hand-crafted API call can't push an image entirely out of its frame.
     */
    private static function sanitize_position($value)
    {
        $raw = trim((string) $value);

        if (preg_match('/^(-?\d{1,3}(?:\.\d+)?)%\s+(-?\d{1,3}(?:\.\d+)?)%$/', $raw, $m)) {
            $x = max(0, min(100, (float) $m[1]));
            $y = max(0, min(100, (float) $m[2]));
            return sprintf('%d%% %d%%', round($x), round($y));
        }

        $keyword = sanitize_key($raw);
        $allowed = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
        return in_array($keyword, $allowed, true) ? $keyword : 'center';
    }

    /** Clamped to ZOOM_MIN/ZOOM_MAX in src/lib/imagePosition.js — mirrored here so a direct API call can't save an unreasonable value. */
    private static function sanitize_zoom($value)
    {
        $zoom = (float) $value;
        if ($zoom < 1) {
            $zoom = 1;
        } elseif ($zoom > 2.5) {
            $zoom = 2.5;
        }
        return (string) $zoom;
    }

    /** Cover photos always fill the public card/profile frame. */
    private static function sanitize_cover_fit($value)
    {
        return 'cover';
    }

    /**
     * Reject a cover upload before creating/updating the listing when PHP or
     * WordPress cannot accept it. Previously an oversized file arrived with
     * an empty tmp_name, handle_uploads() skipped it, and the API still
     * reported a successful listing — leaving the owner with no cover photo.
     */
    private static function validate_cover_upload()
    {
        if (!isset($_FILES['coverPhoto'])) {
            return true;
        }

        $file = $_FILES['coverPhoto'];
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) {
            return true;
        }
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            return new WP_Error(
                'c767_cover_too_large',
                'The cover photo is too large. The maximum upload size is 2 MB. Compress or resize the image, then try again.',
                ['status' => 413]
            );
        }
        if ($error !== UPLOAD_ERR_OK) {
            return new WP_Error(
                'c767_cover_upload_failed',
                'The cover photo could not be uploaded. Check the image and try a different JPG, PNG, WebP, or GIF file.',
                ['status' => 400]
            );
        }

        $max_size = (int) wp_max_upload_size();
        if ($max_size > 0 && (int) ($file['size'] ?? 0) > $max_size) {
            return new WP_Error(
                'c767_cover_too_large',
                sprintf(
                    'The cover photo is too large. The maximum upload size is %s. Compress or resize the image, then try again.',
                    size_format($max_size)
                ),
                ['status' => 413]
            );
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        $checked = wp_check_filetype_and_ext(
            (string) ($file['tmp_name'] ?? ''),
            sanitize_file_name((string) ($file['name'] ?? ''))
        );
        $allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (empty($checked['type']) || !in_array($checked['type'], $allowed_types, true)) {
            return new WP_Error(
                'c767_cover_invalid_type',
                'This cover photo cannot be displayed. Choose a valid JPG, PNG, WebP, or GIF image.',
                ['status' => 400]
            );
        }

        return true;
    }

    /**
     * Per-listing (not per-account) — a Classified owner running several
     * businesses can show different credentials on each one. Used to live
     * on the owner's user account (set at signup) instead; moved here so
     * it's editable per listing in AddListingPage.jsx's wizard. Fixed
     * dropdown, not free text — same list the wizard's Education <Select>
     * renders. Whitelisted server-side the same way sanitize_position()
     * whitelists the crop grid — never trust whatever string the client sent.
     */
    private static function sanitize_education($value)
    {
        $choices = [
            'High School Diploma',
            'Associate Degree',
            "Bachelor's Degree",
            "Master's Degree",
            'Engineering Management',
            'PhD',
            'Post Graduate',
            'Professional Certificate',
            'Other',
        ];
        $value = (string) $value;
        return in_array($value, $choices, true) ? $value : '';
    }

    /** Same whitelist idea as sanitize_education() — a closed set of year ranges. */
    private static function sanitize_experience_level($value)
    {
        $choices = ['0-5 years', '5-10 years', '10-15 years', '15-20 years', '20+ years'];
        $value = (string) $value;
        return in_array($value, $choices, true) ? $value : '';
    }

    /**
     * Exact years of experience, as a plain integer.
     *
     * Sits alongside experience_level (a coarse range used by the directory's
     * filters) rather than replacing it: the profile shows the precise figure
     * — "12 years experience" — while the filter still buckets people into
     * 5-year bands. Clamped at 80 so a typo can't render a 500-year career;
     * empty string rather than 0 when unset, so "no answer" and "fresh out of
     * school" stay distinguishable.
     */
    private static function sanitize_years_experience($value)
    {
        if ($value === null || $value === '') {
            return '';
        }
        $years = (int) $value;
        if ($years < 0) {
            $years = 0;
        }
        if ($years > 80) {
            $years = 80;
        }
        return (string) $years;
    }

    /** Validate every field marked required in AddListingPage. */
    private static function required_listing_values(WP_REST_Request $request)
    {
        $raw_years_experience = trim((string) $request->get_param('yearsExperience'));
        $values = [
            'business_name' => trim(sanitize_text_field((string) $request->get_param('businessName'))),
            'category' => sanitize_key((string) $request->get_param('category')),
            'price_tier' => sanitize_text_field((string) $request->get_param('priceTier')),
            'description' => trim(sanitize_textarea_field((string) $request->get_param('description'))),
            'years_experience' => self::sanitize_years_experience($request->get_param('yearsExperience')),
            'location' => trim(sanitize_text_field((string) $request->get_param('location'))),
            'email' => sanitize_email((string) $request->get_param('email')),
        ];
        $labels = [
            'business_name' => 'Listing name',
            'category' => 'Industry',
            'price_tier' => 'Price tier',
            'description' => 'Description',
            'years_experience' => 'Years of experience',
            'location' => 'Location',
            'email' => 'Email',
        ];
        foreach ($labels as $key => $label) {
            if ($values[$key] === '') {
                return new WP_Error('c767_missing_required_field', $label . ' is required.', ['status' => 400]);
            }
        }
        if (!preg_match('/^\d+$/', $raw_years_experience) || (int) $raw_years_experience > 80) {
            return new WP_Error('c767_invalid_years_experience', 'Years of experience must be a whole number from 0 to 80.', ['status' => 400]);
        }
        if (!in_array($values['price_tier'], ['$', '$$', '$$$'], true)) {
            return new WP_Error('c767_invalid_price_tier', 'Choose a valid price tier.', ['status' => 400]);
        }
        if (!is_email($values['email'])) {
            return new WP_Error('c767_invalid_email', 'Enter a valid email address.', ['status' => 400]);
        }
        if (!self::resolve_category_term($values['category'])) {
            return new WP_Error('c767_invalid_category', 'Choose a valid industry from the listing form.', ['status' => 400]);
        }
        return $values;
    }

    public static function submit(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $cover_validation = self::validate_cover_upload();
        if (is_wp_error($cover_validation)) {
            return $cover_validation;
        }

        $required = self::required_listing_values($request);
        if (is_wp_error($required)) {
            return $required;
        }
        $business_name = $required['business_name'];
        $category = $required['category'];
        $location = $required['location'];
        $years_experience = $required['years_experience'];

        $post_id = wp_insert_post([
            'post_type' => 'listing',
            'post_status' => 'pending',
            'post_title' => $business_name,
            'post_content' => $required['description'],
            'post_author' => $user->ID,
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('c767_submit_failed', $post_id->get_error_message(), ['status' => 400]);
        }

        $category_result = self::assign_category($post_id, $category);
        if (is_wp_error($category_result)) {
            wp_delete_post($post_id, true);
            return $category_result;
        }

        $tier = $request->get_param('tier') === 'classified' ? 'Classified' : 'Free';
        $meta = [
            'tier' => $tier,
            // Classified used to be recorded as a fully-formed paid tier
            // the instant the wizard submitted it, with nothing ever
            // checking whether a charge actually happened —
            // C767_Stripe_Listing_Checkout::confirm_payment() is the only
            // place this ever flips to 'paid'. Review Listings surfaces
            // this so an admin can see an unpaid Classified submission
            // before approving it. 'n/a' for Free listings, which were
            // never meant to be billed.
            'payment_status' => $tier === 'Classified' ? 'unpaid' : 'n/a',
            'price_tier' => $required['price_tier'],
            'description' => $required['description'],
            'location_display' => $location,
            'phone' => sanitize_text_field((string) $request->get_param('phone')),
            'email' => $required['email'],
            'website' => esc_url_raw((string) $request->get_param('website')),
            'instagram' => esc_url_raw((string) $request->get_param('instagram')),
            'facebook' => esc_url_raw((string) $request->get_param('facebook')),
            'youtube' => esc_url_raw((string) $request->get_param('youtube')),
            'twitter' => esc_url_raw((string) $request->get_param('twitter')),
            // Not a URL — src/components/ListingProfile.jsx builds the wa.me
            // link itself from a plain phone number, same as the `phone`
            // field, so this is sanitized the same way `phone` is rather
            // than with esc_url_raw().
            'whatsapp' => sanitize_text_field((string) $request->get_param('whatsapp')),
            'logo_position' => self::sanitize_position($request->get_param('logoPosition')),
            'logo_zoom' => self::sanitize_zoom($request->get_param('logoZoom') ?: 1),
            'cover_position' => self::sanitize_position($request->get_param('coverPosition')),
            'cover_zoom' => self::sanitize_zoom($request->get_param('coverZoom') ?: 1),
            'cover_fit' => self::sanitize_cover_fit($request->get_param('coverFit')),
            'education' => self::sanitize_education($request->get_param('education')),
            'degree_type' => sanitize_text_field((string) $request->get_param('degreeType')),
            'experience_level' => self::sanitize_experience_level($request->get_param('experienceLevel')),
            'years_experience' => $years_experience,
            'years_experience_as_of_year' => $years_experience === '' ? '' : (int) gmdate('Y'),
            'verified' => '0',
            'featured' => '0',
            'rating' => '0',
            'review_count' => '0',
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($post_id, $key, $value);
        }

        $tags = array_filter(array_map('trim', explode(',', (string) $request->get_param('tags'))));
        if ($tags) {
            update_post_meta($post_id, 'tags', wp_json_encode(array_values($tags)));
        }

        $amenities = array_filter(array_map('trim', explode(',', (string) $request->get_param('amenities'))));
        update_post_meta($post_id, 'amenities', wp_json_encode(array_values($amenities)));

        $upload_result = self::handle_uploads($post_id, $request);
        if (is_wp_error($upload_result)) {
            return $upload_result;
        }

        do_action('c767_listing_submitted', $post_id, $user->ID, $tier);

        return rest_ensure_response([
            'id' => $post_id,
            'status' => 'pending',
            'message' => 'Your listing was submitted and is awaiting review.',
        ]);
    }

    /**
     * Edit an existing listing — same fields as submit() above, minus tier
     * (upgrading/downgrading a plan goes through the paid Classified flow,
     * not a plain edit, so `tier`/`payment_status` are deliberately never
     * touched here) and minus post status (an edit doesn't send an already-
     * live listing back through moderation).
     */
    public static function update(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $cover_validation = self::validate_cover_upload();
        if (is_wp_error($cover_validation)) {
            return $cover_validation;
        }

        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user->ID) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
        }

        $required = self::required_listing_values($request);
        if (is_wp_error($required)) {
            return $required;
        }
        $business_name = $required['business_name'];
        $category = $required['category'];
        $location = $required['location'];
        $years_experience = $required['years_experience'];

        wp_update_post([
            'ID' => $post_id,
            'post_title' => $business_name,
            'post_content' => $required['description'],
        ]);

        $category_result = self::assign_category($post_id, $category);
        if (is_wp_error($category_result)) {
            return $category_result;
        }
        $meta = [
            'price_tier' => $required['price_tier'],
            'description' => $required['description'],
            'location_display' => $location,
            'phone' => sanitize_text_field((string) $request->get_param('phone')),
            'email' => $required['email'],
            'website' => esc_url_raw((string) $request->get_param('website')),
            'instagram' => esc_url_raw((string) $request->get_param('instagram')),
            'facebook' => esc_url_raw((string) $request->get_param('facebook')),
            'youtube' => esc_url_raw((string) $request->get_param('youtube')),
            'twitter' => esc_url_raw((string) $request->get_param('twitter')),
            'whatsapp' => sanitize_text_field((string) $request->get_param('whatsapp')),
            'logo_position' => self::sanitize_position($request->get_param('logoPosition')),
            'logo_zoom' => self::sanitize_zoom($request->get_param('logoZoom') ?: 1),
            'cover_position' => self::sanitize_position($request->get_param('coverPosition')),
            'cover_zoom' => self::sanitize_zoom($request->get_param('coverZoom') ?: 1),
            'cover_fit' => self::sanitize_cover_fit($request->get_param('coverFit')),
            'education' => self::sanitize_education($request->get_param('education')),
            'degree_type' => sanitize_text_field((string) $request->get_param('degreeType')),
            'experience_level' => self::sanitize_experience_level($request->get_param('experienceLevel')),
            'years_experience' => $years_experience,
            'years_experience_as_of_year' => $years_experience === '' ? '' : (int) gmdate('Y'),
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($post_id, $key, $value);
        }

        $tags = array_filter(array_map('trim', explode(',', (string) $request->get_param('tags'))));
        update_post_meta($post_id, 'tags', wp_json_encode(array_values($tags)));

        $amenities = array_filter(array_map('trim', explode(',', (string) $request->get_param('amenities'))));
        update_post_meta($post_id, 'amenities', wp_json_encode(array_values($amenities)));

        $upload_result = self::handle_uploads($post_id, $request);
        if (is_wp_error($upload_result)) {
            return $upload_result;
        }

        return rest_ensure_response([
            'id' => $post_id,
            'status' => $post->post_status,
            'message' => 'Your listing was updated.',
        ]);
    }

    /**
     * Real file uploads into the WordPress Media Library — not just a URL
     * string. `logo` and `coverPhoto` are single files; `gallery` accepts
     * multiple (the frontend appends each one under the same `gallery[]`
     * field name, which PHP collects into a normal multi-file $_FILES
     * array). The cover photo also becomes the post's featured image, so
     * it's picked up automatically by the same `featuredImage(wp)` logic
     * the frontend's mappers.js already uses for every other listing.
     *
     * `existingGallery` (used by update() when editing) is a JSON array of
     * `{url, alt}` objects for gallery photos the owner already had and
     * didn't remove — merged ahead of any newly-uploaded files so editing a
     * listing can't silently wipe out gallery photos the owner never
     * touched, and so removing one in the UI actually removes it here too.
     */
    private static function handle_uploads($post_id, WP_REST_Request $request)
    {
        $existing_gallery_raw = $request->get_param('existingGallery');
        $existing_gallery = null;
        if ($existing_gallery_raw !== null && $existing_gallery_raw !== '') {
            $decoded = json_decode((string) $existing_gallery_raw, true);
            $existing_gallery = is_array($decoded) ? array_map(function ($item) {
                return [
                    'url' => esc_url_raw((string) ($item['url'] ?? '')),
                    'alt' => sanitize_text_field((string) ($item['alt'] ?? '')),
                ];
            }, $decoded) : [];
        }

        if (empty($_FILES)) {
            if ($existing_gallery !== null) {
                update_post_meta($post_id, 'gallery', wp_json_encode($existing_gallery));
            }
            return true;
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        if (!empty($_FILES['logo']['tmp_name'])) {
            $logo_id = media_handle_upload('logo', $post_id);
            if (!is_wp_error($logo_id)) {
                update_post_meta($post_id, 'logo', wp_get_attachment_url($logo_id));
            }
        }

        if (!empty($_FILES['coverPhoto']['tmp_name'])) {
            $cover_id = media_handle_upload('coverPhoto', $post_id);
            if (is_wp_error($cover_id)) {
                return new WP_Error(
                    'c767_cover_processing_failed',
                    'WordPress could not process this cover photo: ' . $cover_id->get_error_message() . ' Please resize it or choose a different image.',
                    ['status' => 400]
                );
            }
            set_post_thumbnail($post_id, $cover_id);
        }

        $gallery = $existing_gallery ?? [];
        if (!empty($_FILES['gallery']) && is_array($_FILES['gallery']['name'])) {
            $count = count($_FILES['gallery']['name']);
            for ($i = 0; $i < $count; $i++) {
                if ($_FILES['gallery']['error'][$i] !== UPLOAD_ERR_OK) {
                    continue;
                }
                $single_file = [
                    'name' => $_FILES['gallery']['name'][$i],
                    'type' => $_FILES['gallery']['type'][$i],
                    'tmp_name' => $_FILES['gallery']['tmp_name'][$i],
                    'error' => $_FILES['gallery']['error'][$i],
                    'size' => $_FILES['gallery']['size'][$i],
                ];
                $attachment_id = media_handle_sideload($single_file, $post_id);
                if (!is_wp_error($attachment_id)) {
                    $gallery[] = [
                        'url' => wp_get_attachment_url($attachment_id),
                        'alt' => sanitize_text_field(pathinfo($single_file['name'], PATHINFO_FILENAME)),
                    ];
                }
            }
        }
        if ($gallery) {
            update_post_meta($post_id, 'gallery', wp_json_encode($gallery));
        }
        return true;
    }
}
