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
        $existing = get_term_by('slug', $slug, 'listing_category');
        if ($existing && !is_wp_error($existing)) {
            return (int) $existing->term_id;
        }

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
            return;
        }
        $term_ids = [$term_id];
        $term = get_term($term_id, 'listing_category');
        if ($term && !is_wp_error($term) && $term->parent) {
            $term_ids[] = (int) $term->parent;
        }
        wp_set_object_terms($post_id, $term_ids, 'listing_category');
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
    }

    /**
     * Owner-only on/off switch for a listing's public "Request a booking"
     * form — DashboardPage.jsx's per-listing toggle. Anyone can flip their
     * own listing's switch regardless of tier; there's no plan requirement
     * on this, unlike Classified's paid Stripe gate.
     */
    public static function set_booking_enabled(WP_REST_Request $request)
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

        $enabled = filter_var($request->get_param('enabled'), FILTER_VALIDATE_BOOLEAN);
        update_post_meta($post_id, 'booking_enabled', $enabled ? '1' : '0');

        return rest_ensure_response(['id' => $post_id, 'bookingEnabled' => $enabled]);
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
    private static function sanitize_position($value)
    {
        $value = sanitize_key((string) $value);
        $allowed = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
        return in_array($value, $allowed, true) ? $value : 'center';
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

    public static function submit(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $business_name = sanitize_text_field((string) $request->get_param('businessName'));
        if (!$business_name) {
            return new WP_Error('c767_missing_name', 'Business name is required.', ['status' => 400]);
        }

        $post_id = wp_insert_post([
            'post_type' => 'listing',
            'post_status' => 'pending',
            'post_title' => $business_name,
            'post_content' => sanitize_textarea_field((string) $request->get_param('description')),
            'post_author' => $user->ID,
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('c767_submit_failed', $post_id->get_error_message(), ['status' => 400]);
        }

        $category = sanitize_key((string) $request->get_param('category'));
        if ($category) {
            self::assign_category($post_id, $category);
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
            'price_tier' => sanitize_text_field((string) $request->get_param('priceTier')),
            'location_display' => sanitize_text_field((string) $request->get_param('location')),
            'phone' => sanitize_text_field((string) $request->get_param('phone')),
            'email' => sanitize_email((string) $request->get_param('email')),
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
            'education' => self::sanitize_education($request->get_param('education')),
            'experience_level' => self::sanitize_experience_level($request->get_param('experienceLevel')),
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

        self::handle_uploads($post_id, $request);

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

        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user->ID) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
        }

        $business_name = sanitize_text_field((string) $request->get_param('businessName'));
        if (!$business_name) {
            return new WP_Error('c767_missing_name', 'Business name is required.', ['status' => 400]);
        }

        wp_update_post([
            'ID' => $post_id,
            'post_title' => $business_name,
            'post_content' => sanitize_textarea_field((string) $request->get_param('description')),
        ]);

        $category = sanitize_key((string) $request->get_param('category'));
        if ($category) {
            self::assign_category($post_id, $category);
        }

        $meta = [
            'price_tier' => sanitize_text_field((string) $request->get_param('priceTier')),
            'location_display' => sanitize_text_field((string) $request->get_param('location')),
            'phone' => sanitize_text_field((string) $request->get_param('phone')),
            'email' => sanitize_email((string) $request->get_param('email')),
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
            'education' => self::sanitize_education($request->get_param('education')),
            'experience_level' => self::sanitize_experience_level($request->get_param('experienceLevel')),
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($post_id, $key, $value);
        }

        $tags = array_filter(array_map('trim', explode(',', (string) $request->get_param('tags'))));
        update_post_meta($post_id, 'tags', wp_json_encode(array_values($tags)));

        self::handle_uploads($post_id, $request);

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
            return;
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
            if (!is_wp_error($cover_id)) {
                set_post_thumbnail($post_id, $cover_id);
            }
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
    }
}
