<?php
/** Business community feed endpoints tied to published directory listings. */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Community
{
    const NAMESPACE_ = 'connect767/v1';
    const MAX_IMAGE_BYTES = 5242880;
    const MAX_VIDEO_BYTES = 26214400;
    const EMOTIONS = [
        'happy', 'loved', 'excited', 'grateful', 'celebrating', 'inspired', 'proud', 'focused',
        'optimistic', 'supportive', 'curious', 'motivated', 'surprised', 'thoughtful',
        'confident', 'energized',
        'amused', 'relieved', 'hopeful', 'determined', 'calm', 'creative',
        'accomplished', 'thankful', 'blessed', 'friendly', 'impressed', 'interested',
        'encouraged', 'connected', 'generous', 'professional', 'busy', 'productive',
        'concerned', 'disappointed', 'sad', 'frustrated', 'tired', 'confused',
    ];
    const ACTIVITIES = [
        'working', 'hiring', 'networking', 'learning', 'traveling', 'shopping',
        'eating', 'attending', 'hosting', 'launching', 'selling', 'volunteering',
        'exercising', 'creating', 'planning', 'collaborating', 'meeting', 'delivering',
        'exploring', 'celebrating-activity',
    ];

    public static function init()
    {
        add_action('init', [__CLASS__, 'register_post_type']);
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_post_type()
    {
        register_post_type('community_update', [
            'labels' => [
                'name' => 'Community Updates',
                'singular_name' => 'Community Update',
                'menu_name' => 'Community Feed',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => false,
            'supports' => ['title', 'editor', 'author', 'comments'],
            'menu_icon' => 'dashicons-format-status',
        ]);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/community/posts', [
            [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [__CLASS__, 'get_posts'],
                'permission_callback' => '__return_true',
            ],
            [
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => [__CLASS__, 'create_post'],
                'permission_callback' => [__CLASS__, 'is_authenticated'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/posts/(?P<id>\d+)', [
            [
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => [__CLASS__, 'update_post'],
                'permission_callback' => [__CLASS__, 'is_authenticated'],
            ],
            [
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => [__CLASS__, 'delete_post'],
                'permission_callback' => [__CLASS__, 'is_authenticated'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/posts/(?P<id>\d+)/reports', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'report_post'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/posts/(?P<id>\d+)/reactions', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'toggle_reaction'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/posts/(?P<id>\d+)/comments', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'create_comment'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);
    }

    public static function is_authenticated(WP_REST_Request $request)
    {
        // The public frontend authenticates with the plugin's Bearer token,
        // not a WordPress login cookie. Resolve that token here and establish
        // the current user before create_post(), toggle_reaction(), or
        // create_comment() reads get_current_user_id(). Returning the
        // WP_Error also preserves the precise expired/invalid-token response.
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        wp_set_current_user($user->ID);
        return true;
    }

    private static function owned_listing($listing_id, $user_id)
    {
        $listing = get_post((int) $listing_id);
        return $listing && $listing->post_type === 'listing' && (int) $listing->post_author === (int) $user_id
            ? $listing
            : null;
    }

    private static function serialize_comment($comment)
    {
        return [
            'id' => (int) $comment->comment_ID,
            'name' => sanitize_text_field($comment->comment_author),
            'text' => wp_strip_all_tags($comment->comment_content),
            'createdAt' => mysql_to_rfc3339($comment->comment_date_gmt),
        ];
    }

    private static function serialize_post($post)
    {
        $listing_id = (int) get_post_meta($post->ID, '_community_listing_id', true);
        $listing = get_post($listing_id);
        $reaction_ids = get_post_meta($post->ID, '_community_reaction_user_ids', true);
        $reaction_ids = is_array($reaction_ids) ? array_map('intval', $reaction_ids) : [];
        $thumb_ids = get_post_meta($post->ID, '_community_thumb_user_ids', true);
        $thumb_ids = is_array($thumb_ids) ? array_map('intval', $thumb_ids) : [];
        $comments = get_comments([
            'post_id' => $post->ID,
            'status' => 'approve',
            'number' => 20,
            'order' => 'ASC',
        ]);
        $location = $listing_id ? (string) get_post_meta($listing_id, 'location', true) : '';
        $industry = $listing_id ? (string) get_post_meta($listing_id, 'category_slug', true) : '';
        $logo = $listing_id ? (string) get_post_meta($listing_id, 'logo', true) : '';
        if ($logo === '' && $listing_id) {
            $logo = (string) get_the_post_thumbnail_url($listing_id, 'thumbnail');
        }
        $mentions = get_post_meta($post->ID, '_community_mentions', true);
        $mentions = is_array($mentions) ? $mentions : [];

        return [
            'id' => (int) $post->ID,
            'listingId' => $listing_id,
            'listingSlug' => $listing ? $listing->post_name : '',
            'listingTitle' => $listing ? get_the_title($listing) : get_the_title($post),
            'listingLogo' => esc_url_raw($logo),
            'location' => sanitize_text_field($location),
            'industry' => sanitize_text_field($industry),
            'verified' => $listing_id ? (bool) get_post_meta($listing_id, 'verified', true) : false,
            'type' => sanitize_key((string) get_post_meta($post->ID, '_community_update_type', true)) ?: 'status',
            'emotion' => sanitize_key((string) get_post_meta($post->ID, '_community_emotion', true)),
            'activity' => sanitize_key((string) get_post_meta($post->ID, '_community_activity', true)),
            'postLocation' => sanitize_text_field((string) get_post_meta($post->ID, '_community_post_location', true)),
            'latitude' => get_post_meta($post->ID, '_community_latitude', true) !== '' ? (float) get_post_meta($post->ID, '_community_latitude', true) : null,
            'longitude' => get_post_meta($post->ID, '_community_longitude', true) !== '' ? (float) get_post_meta($post->ID, '_community_longitude', true) : null,
            'mentions' => array_values($mentions),
            'text' => wp_strip_all_tags($post->post_content),
            'mediaUrl' => esc_url_raw((string) get_post_meta($post->ID, '_community_media_url', true)),
            'videoUrl' => esc_url_raw((string) get_post_meta($post->ID, '_community_video_url', true)),
            'linkUrl' => esc_url_raw((string) get_post_meta($post->ID, '_community_link_url', true)),
            'createdAt' => mysql_to_rfc3339($post->post_date_gmt),
            'reactionCount' => count($reaction_ids),
            'reacted' => in_array(get_current_user_id(), $reaction_ids, true),
            'thumbCount' => count($thumb_ids),
            'thumbed' => in_array(get_current_user_id(), $thumb_ids, true),
            'canManage' => get_current_user_id() > 0 && ((int) $post->post_author === (int) get_current_user_id() || current_user_can('delete_post', $post->ID)),
            'comments' => array_map([__CLASS__, 'serialize_comment'], $comments),
        ];
    }

    public static function get_posts(WP_REST_Request $request)
    {
        if ($request->get_header('authorization')) {
            $user = C767_REST_Auth::user_from_request($request);
            if (is_wp_error($user)) {
                return $user;
            }
            wp_set_current_user($user->ID);
        }

        $page = max(1, (int) $request->get_param('page'));
        $query = new WP_Query([
            'post_type' => 'community_update',
            'post_status' => 'publish',
            'posts_per_page' => 20,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
        ]);

        return rest_ensure_response([
            'posts' => array_map([__CLASS__, 'serialize_post'], $query->posts),
            'page' => $page,
            'totalPages' => (int) $query->max_num_pages,
        ]);
    }

    public static function create_post(WP_REST_Request $request)
    {
        $user_id = get_current_user_id();
        $listing = self::owned_listing((int) $request->get_param('listingId'), $user_id);
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_invalid_community_listing', 'Choose one of your published listings.', ['status' => 403]);
        }

        $text = trim(sanitize_textarea_field((string) $request->get_param('text')));
        if ($text === '' || strlen($text) > 1200) {
            return new WP_Error('c767_invalid_community_text', 'Updates must contain between 1 and 1,200 characters.', ['status' => 400]);
        }
        $type = sanitize_key((string) $request->get_param('type'));
        if (!in_array($type, ['status', 'offer', 'event', 'opportunity'], true)) {
            $type = 'status';
        }
        $emotion = sanitize_key((string) $request->get_param('emotion'));
        if (!in_array($emotion, self::EMOTIONS, true)) {
            $emotion = '';
        }
        $activity = sanitize_key((string) $request->get_param('activity'));
        if (!in_array($activity, self::ACTIVITIES, true)) {
            $activity = '';
        }
        if ($emotion !== '' && $activity !== '') {
            $activity = '';
        }
        $post_location = sanitize_text_field((string) $request->get_param('postLocation'));
        if (strlen($post_location) > 120) {
            return new WP_Error('c767_community_location_too_long', 'Locations must be 120 characters or fewer.', ['status' => 400]);
        }
        $latitude_param = $request->get_param('latitude');
        $longitude_param = $request->get_param('longitude');
        $has_latitude = $latitude_param !== null && $latitude_param !== '';
        $has_longitude = $longitude_param !== null && $longitude_param !== '';
        if ($has_latitude !== $has_longitude) {
            return new WP_Error('c767_community_location_incomplete', 'Live location coordinates are incomplete.', ['status' => 400]);
        }
        $latitude = null;
        $longitude = null;
        if ($has_latitude && $has_longitude) {
            if (!is_numeric($latitude_param) || !is_numeric($longitude_param)) {
                return new WP_Error('c767_community_location_invalid', 'Live location coordinates are invalid.', ['status' => 400]);
            }
            $latitude = (float) $latitude_param;
            $longitude = (float) $longitude_param;
            if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
                return new WP_Error('c767_community_location_invalid', 'Live location coordinates are outside the valid range.', ['status' => 400]);
            }
            if ($post_location === '') {
                $post_location = 'Current location';
            }
        }

        $mentions_param = $request->get_param('mentions');
        if (is_string($mentions_param) && $mentions_param !== '') {
            $mentions_param = json_decode($mentions_param, true);
        }
        if ($mentions_param !== null && $mentions_param !== '' && !is_array($mentions_param)) {
            return new WP_Error('c767_community_mentions_invalid', 'Business mentions are invalid.', ['status' => 400]);
        }
        $mentions = [];
        foreach (array_slice((array) $mentions_param, 0, 10) as $mention) {
            $mentioned_listing = get_post((int) ($mention['id'] ?? 0));
            if (!$mentioned_listing || $mentioned_listing->post_type !== 'listing' || $mentioned_listing->post_status !== 'publish') {
                continue;
            }
            $mentions[] = [
                'id' => (int) $mentioned_listing->ID,
                'slug' => sanitize_title($mentioned_listing->post_name),
                'title' => sanitize_text_field(get_the_title($mentioned_listing)),
            ];
        }

        $attachment_check = self::validate_attachment();
        if (is_wp_error($attachment_check)) {
            return $attachment_check;
        }

        $link_url = trim((string) $request->get_param('linkUrl'));
        if ($link_url !== '') {
            $has_file = !empty($_FILES['image']['tmp_name']) || !empty($_FILES['video']['tmp_name']);
            if ($has_file) {
                return new WP_Error('c767_community_attachment_limit', 'Attach one photo, video, or link per update.', ['status' => 400]);
            }
            $link_url = esc_url_raw($link_url, ['http', 'https']);
            if (!$link_url || !wp_http_validate_url($link_url)) {
                return new WP_Error('c767_community_link_invalid', 'Enter a valid public website link.', ['status' => 400]);
            }
        }

        $post_id = wp_insert_post([
            'post_type' => 'community_update',
            'post_status' => 'publish',
            'post_author' => $user_id,
            'post_title' => wp_trim_words($text, 10, '…'),
            'post_content' => $text,
            'comment_status' => 'open',
        ], true);
        if (is_wp_error($post_id)) {
            return $post_id;
        }

        update_post_meta($post_id, '_community_listing_id', (int) $listing->ID);
        update_post_meta($post_id, '_community_update_type', $type);
        update_post_meta($post_id, '_community_emotion', $emotion);
        update_post_meta($post_id, '_community_activity', $activity);
        update_post_meta($post_id, '_community_post_location', $post_location);
        update_post_meta($post_id, '_community_latitude', $latitude === null ? '' : $latitude);
        update_post_meta($post_id, '_community_longitude', $longitude === null ? '' : $longitude);
        update_post_meta($post_id, '_community_mentions', $mentions);

        $media_url = esc_url_raw((string) $request->get_param('mediaUrl'));
        if (!empty($_FILES['image']['tmp_name'])) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            $attachment_id = media_handle_upload('image', $post_id);
            if (is_wp_error($attachment_id)) {
                wp_delete_post($post_id, true);
                return new WP_Error(
                    'c767_community_image_failed',
                    'The image could not be uploaded. Try a different JPG, PNG, WebP, or GIF file.',
                    ['status' => 400]
                );
            }
            $media_url = wp_get_attachment_url($attachment_id);
        }
        update_post_meta($post_id, '_community_media_url', $media_url);
        $video_url = '';
        if (!empty($_FILES['video']['tmp_name'])) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            $attachment_id = media_handle_upload('video', $post_id);
            if (is_wp_error($attachment_id)) {
                wp_delete_post($post_id, true);
                return new WP_Error(
                    'c767_community_video_failed',
                    'The video could not be uploaded. Try a different MP4, WebM, or MOV file.',
                    ['status' => 400]
                );
            }
            $video_url = wp_get_attachment_url($attachment_id);
        }
        update_post_meta($post_id, '_community_video_url', $video_url);
        update_post_meta($post_id, '_community_link_url', $link_url);
        update_post_meta($post_id, '_community_reaction_user_ids', []);
        update_post_meta($post_id, '_community_thumb_user_ids', []);

        return new WP_REST_Response(self::serialize_post(get_post($post_id)), 201);
    }

    public static function delete_post(WP_REST_Request $request)
    {
        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'community_update') {
            return new WP_Error('c767_community_post_not_found', 'Community post not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) get_current_user_id() && !current_user_can('delete_post', $post_id)) {
            return new WP_Error('c767_community_post_forbidden', 'You can only delete your own community posts.', ['status' => 403]);
        }
        if (!wp_delete_post($post_id, true)) {
            return new WP_Error('c767_community_post_delete_failed', 'The community post could not be deleted.', ['status' => 500]);
        }
        return rest_ensure_response(['deleted' => true, 'id' => $post_id]);
    }

    public static function update_post(WP_REST_Request $request)
    {
        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'community_update') {
            return new WP_Error('c767_community_post_not_found', 'Community post not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) get_current_user_id() && !current_user_can('edit_post', $post_id)) {
            return new WP_Error('c767_community_post_forbidden', 'You can only edit your own community posts.', ['status' => 403]);
        }
        $text = trim(sanitize_textarea_field((string) $request->get_param('text')));
        if ($text === '' || strlen($text) > 1200) {
            return new WP_Error('c767_invalid_community_text', 'Updates must contain between 1 and 1,200 characters.', ['status' => 400]);
        }
        $updated = wp_update_post([
            'ID' => $post_id,
            'post_title' => wp_trim_words($text, 10, '…'),
            'post_content' => $text,
        ], true);
        if (is_wp_error($updated)) {
            return $updated;
        }
        return rest_ensure_response(self::serialize_post(get_post($post_id)));
    }

    public static function report_post(WP_REST_Request $request)
    {
        $post_id = (int) $request->get_param('id');
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'community_update' || $post->post_status !== 'publish') {
            return new WP_Error('c767_community_post_not_found', 'Community post not found.', ['status' => 404]);
        }

        $reason = sanitize_key((string) $request->get_param('reason'));
        $allowed_reasons = ['spam', 'misleading', 'harassment', 'inappropriate', 'other'];
        if (!in_array($reason, $allowed_reasons, true)) {
            return new WP_Error('c767_community_report_reason_invalid', 'Choose a valid reason for the report.', ['status' => 400]);
        }

        $user_id = get_current_user_id();
        $reports = get_post_meta($post_id, '_community_reports', true);
        $reports = is_array($reports) ? $reports : [];
        foreach ($reports as $report) {
            if ((int) ($report['user_id'] ?? 0) === (int) $user_id) {
                return rest_ensure_response(['reported' => true, 'duplicate' => true, 'id' => $post_id]);
            }
        }
        $reports[] = [
            'user_id' => $user_id,
            'reason' => $reason,
            'created_at' => current_time('mysql', true),
        ];
        update_post_meta($post_id, '_community_reports', $reports);
        return rest_ensure_response(['reported' => true, 'duplicate' => false, 'id' => $post_id]);
    }

    private static function validate_attachment()
    {
        $has_image = isset($_FILES['image']) && (int) ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        $has_video = isset($_FILES['video']) && (int) ($_FILES['video']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        if ($has_image && $has_video) {
            return new WP_Error('c767_community_attachment_limit', 'Attach one photo, video, or link per update.', ['status' => 400]);
        }

        if ($has_video) {
            return self::validate_upload('video', self::MAX_VIDEO_BYTES, ['video/mp4', 'video/webm', 'video/quicktime']);
        }
        if ($has_image) {
            return self::validate_upload('image', self::MAX_IMAGE_BYTES, ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        }
        return true;
    }

    private static function validate_upload($field, $max_bytes, $allowed_types)
    {
        $file = $_FILES[$field];
        $label = $field === 'video' ? 'video' : 'image';

        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) {
            return true;
        }
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            || (int) ($file['size'] ?? 0) > $max_bytes) {
            return new WP_Error(
                'c767_community_' . $label . '_too_large',
                $label === 'video' ? 'Community videos must be 25 MB or smaller.' : 'Community images must be 5 MB or smaller.',
                ['status' => 413]
            );
        }
        if ($error !== UPLOAD_ERR_OK) {
            return new WP_Error(
                'c767_community_' . $label . '_failed',
                'The ' . $label . ' could not be uploaded. Please try again.',
                ['status' => 400]
            );
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        $checked = wp_check_filetype_and_ext(
            (string) ($file['tmp_name'] ?? ''),
            sanitize_file_name((string) ($file['name'] ?? ''))
        );
        if (empty($checked['type']) || !in_array($checked['type'], $allowed_types, true)) {
            return new WP_Error(
                'c767_community_' . $label . '_type',
                $label === 'video' ? 'Choose a valid MP4, WebM, or MOV video.' : 'Choose a valid JPG, PNG, WebP, or GIF image.',
                ['status' => 400]
            );
        }

        return true;
    }

    public static function toggle_reaction(WP_REST_Request $request)
    {
        $post = get_post((int) $request['id']);
        if (!$post || $post->post_type !== 'community_update' || $post->post_status !== 'publish') {
            return new WP_Error('c767_community_post_not_found', 'Community update not found.', ['status' => 404]);
        }
        $user_id = get_current_user_id();
        $reaction_type = sanitize_key((string) $request->get_param('type')) === 'thumb' ? 'thumb' : 'appreciate';
        $meta_key = $reaction_type === 'thumb' ? '_community_thumb_user_ids' : '_community_reaction_user_ids';
        $ids = get_post_meta($post->ID, $meta_key, true);
        $ids = is_array($ids) ? array_values(array_unique(array_map('intval', $ids))) : [];
        if (in_array($user_id, $ids, true)) {
            $ids = array_values(array_diff($ids, [$user_id]));
        } else {
            $ids[] = $user_id;
        }
        update_post_meta($post->ID, $meta_key, $ids);
        return rest_ensure_response(['count' => count($ids), 'reacted' => in_array($user_id, $ids, true)]);
    }

    public static function create_comment(WP_REST_Request $request)
    {
        $post = get_post((int) $request['id']);
        $text = trim(sanitize_textarea_field((string) $request->get_param('text')));
        if (!$post || $post->post_type !== 'community_update' || $post->post_status !== 'publish') {
            return new WP_Error('c767_community_post_not_found', 'Community update not found.', ['status' => 404]);
        }
        if ($text === '' || strlen($text) > 600) {
            return new WP_Error('c767_invalid_community_comment', 'Comments must contain between 1 and 600 characters.', ['status' => 400]);
        }
        $user = wp_get_current_user();
        $comment_id = wp_insert_comment([
            'comment_post_ID' => $post->ID,
            'comment_content' => $text,
            'comment_type' => 'comment',
            'comment_parent' => 0,
            'user_id' => $user->ID,
            'comment_author' => $user->display_name ?: $user->user_login,
            'comment_author_email' => $user->user_email,
            'comment_approved' => 1,
        ]);
        return new WP_REST_Response(self::serialize_comment(get_comment($comment_id)), 201);
    }
}
