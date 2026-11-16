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
    const MAX_FILE_BYTES = 10485760;
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

        register_rest_route(self::NAMESPACE_, '/community/comments/(?P<comment_id>\d+)', [
            [
                'methods' => WP_REST_Server::EDITABLE,
                'callback' => [__CLASS__, 'update_comment'],
                'permission_callback' => [__CLASS__, 'is_authenticated'],
            ],
            [
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => [__CLASS__, 'delete_comment'],
                'permission_callback' => [__CLASS__, 'is_authenticated'],
            ],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/comments/(?P<comment_id>\d+)/reactions', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'toggle_comment_reaction'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/posts/(?P<id>\d+)/bookmark', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'toggle_bookmark'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/posts/(?P<id>\d+)/repost', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'toggle_repost'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/listings/(?P<listing_id>\d+)/follow', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'toggle_follow'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/notifications', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [__CLASS__, 'get_notifications'],
            'permission_callback' => [__CLASS__, 'is_authenticated'],
        ]);

        register_rest_route(self::NAMESPACE_, '/community/notifications/read', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'mark_notifications_read'],
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
        $reaction = C767_Social_Database::reaction_summary('comment', $comment->comment_ID, get_current_user_id());
        return [
            'id' => (int) $comment->comment_ID,
            'parentId' => (int) $comment->comment_parent,
            'userId' => (int) $comment->user_id,
            'name' => sanitize_text_field($comment->comment_author),
            'text' => wp_strip_all_tags($comment->comment_content),
            'createdAt' => mysql_to_rfc3339($comment->comment_date_gmt),
            'reactions' => $reaction['counts'],
            'viewerReaction' => $reaction['viewerReaction'],
            'totalReactions' => $reaction['total'],
            'canManage' => get_current_user_id() > 0 && ((int) $comment->user_id === (int) get_current_user_id() || current_user_can('edit_comment', $comment->comment_ID)),
        ];
    }

    private static function migrate_legacy_reactions($post_id)
    {
        if (get_post_meta($post_id, '_c767_social_reactions_migrated', true)) {
            return;
        }
        global $wpdb;
        $table = C767_Social_Database::table('reactions');
        $now = current_time('mysql', true);
        foreach (self::reaction_meta_keys() as $type => $meta_key) {
            $ids = get_post_meta($post_id, $meta_key, true);
            foreach (array_unique(array_map('intval', is_array($ids) ? $ids : [])) as $user_id) {
                if ($user_id <= 0) {
                    continue;
                }
                $wpdb->query($wpdb->prepare(
                    "INSERT IGNORE INTO $table (object_type, object_id, user_id, reaction, created_at, updated_at) VALUES ('post', %d, %d, %s, %s, %s)",
                    (int) $post_id,
                    $user_id,
                    $type,
                    $now,
                    $now
                ));
            }
        }
        update_post_meta($post_id, '_c767_social_reactions_migrated', 1);
    }

    private static function serialize_post($post)
    {
        $listing_id = (int) get_post_meta($post->ID, '_community_listing_id', true);
        $listing = get_post($listing_id);
        self::migrate_legacy_reactions($post->ID);
        $reaction = C767_Social_Database::reaction_summary('post', $post->ID, get_current_user_id());
        $repost = C767_Social_Database::repost_summary($post->ID, get_current_user_id());
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
            'details' => (array) get_post_meta($post->ID, '_community_details', true),
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
            'fileUrl' => esc_url_raw((string) get_post_meta($post->ID, '_community_file_url', true)),
            'fileName' => sanitize_file_name((string) get_post_meta($post->ID, '_community_file_name', true)),
            'fileType' => sanitize_text_field((string) get_post_meta($post->ID, '_community_file_type', true)),
            'fileSize' => (int) get_post_meta($post->ID, '_community_file_size', true),
            'createdAt' => mysql_to_rfc3339($post->post_date_gmt),
            'reactions' => $reaction['counts'],
            'viewerReaction' => $reaction['viewerReaction'],
            'totalReactions' => $reaction['total'],
            'bookmarked' => C767_Social_Database::is_bookmarked($post->ID, get_current_user_id()),
            'following' => C767_Social_Database::is_following(get_current_user_id(), 'listing', $listing_id),
            'repostCount' => $repost['count'],
            'viewerReposted' => $repost['viewerReposted'],
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
        $tab = sanitize_key((string) $request->get_param('tab')) ?: 'for-you';
        $allowed_tabs = ['for-you', 'following', 'latest', 'trending', 'businesses', 'community'];
        $allowed_types = ['status', 'offer', 'opportunity', 'event', 'announcement', 'request'];
        if (!in_array($tab, $allowed_tabs, true)) {
            $tab = 'for-you';
        }
        $type_filter = sanitize_key((string) $request->get_param('type'));
        if (!in_array($type_filter, $allowed_types, true)) {
            $type_filter = '';
        }
        $args = [
            'post_type' => 'community_update',
            'post_status' => 'publish',
            'posts_per_page' => 20,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
        ];
        $cursor = sanitize_text_field((string) $request->get_param('cursor'));
        if ($cursor && strtotime($cursor)) {
            $args['date_query'] = [['before' => gmdate('Y-m-d H:i:s', strtotime($cursor)), 'inclusive' => false]];
        }
        if ($tab === 'following') {
            $followed = C767_Social_Database::followed_subject_ids(get_current_user_id(), 'listing');
            if (!$followed) {
                return rest_ensure_response(['posts' => [], 'page' => 1, 'totalPages' => 0, 'nextCursor' => null, 'tab' => $tab]);
            }
            $args['meta_query'] = [[
                'key' => '_community_listing_id',
                'value' => $followed,
                'compare' => 'IN',
                'type' => 'NUMERIC',
            ]];
        } elseif ($tab === 'community' && $type_filter === '') {
            $args['meta_query'] = [['key' => '_community_update_type', 'value' => 'status']];
        } elseif ($tab === 'businesses' && $type_filter === '') {
            $args['meta_query'] = [['key' => '_community_update_type', 'value' => ['offer', 'opportunity', 'event', 'announcement', 'request'], 'compare' => 'IN']];
        } elseif ($tab === 'trending') {
            $args['orderby'] = ['comment_count' => 'DESC', 'date' => 'DESC'];
        }
        if ($type_filter !== '') {
            $type_query = ['key' => '_community_update_type', 'value' => $type_filter];
            if (empty($args['meta_query'])) {
                $args['meta_query'] = [$type_query];
            } else {
                $args['meta_query'] = array_merge(['relation' => 'AND'], $args['meta_query'], [$type_query]);
            }
        }
        $query = new WP_Query($args);
        $last_post = $query->posts ? end($query->posts) : null;

        return rest_ensure_response([
            'posts' => array_map([__CLASS__, 'serialize_post'], $query->posts),
            'page' => $page,
            'totalPages' => (int) $query->max_num_pages,
            'nextCursor' => $last_post ? mysql_to_rfc3339($last_post->post_date_gmt) : null,
            'tab' => $tab,
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
        if (!in_array($type, ['status', 'offer', 'opportunity', 'event', 'announcement', 'request'], true)) {
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
            if (sanitize_key((string) ($mention['slug'] ?? '')) === 'everyone') {
                $mentions[] = [
                    'id' => 0,
                    'slug' => 'everyone',
                    'title' => 'Everyone in the directory',
                    'audience' => 'directory',
                ];
                continue;
            }
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

        $details_param = $request->get_param('details');
        if (is_string($details_param) && $details_param !== '') {
            $details_param = json_decode($details_param, true);
        }
        $details_param = is_array($details_param) ? $details_param : [];
        $details = [];
        if ($type === 'offer') {
            $details = [
                'price' => substr(sanitize_text_field((string) ($details_param['price'] ?? '')), 0, 40),
                'discount' => substr(sanitize_text_field((string) ($details_param['discount'] ?? '')), 0, 80),
                'expiryDate' => self::sanitize_date((string) ($details_param['expiryDate'] ?? '')),
                'ctaLabel' => in_array((string) ($details_param['ctaLabel'] ?? ''), ['View Offer', 'Claim Offer', 'Learn More'], true) ? (string) $details_param['ctaLabel'] : 'View Offer',
            ];
        } elseif ($type === 'opportunity') {
            $details = [
                'opportunityType' => substr(sanitize_text_field((string) ($details_param['opportunityType'] ?? '')), 0, 80),
                'opportunityLocation' => substr(sanitize_text_field((string) ($details_param['opportunityLocation'] ?? '')), 0, 120),
                'deadline' => self::sanitize_date((string) ($details_param['deadline'] ?? '')),
                'ctaLabel' => in_array((string) ($details_param['ctaLabel'] ?? ''), ['Apply Now', 'View Opportunity', 'Learn More'], true) ? (string) $details_param['ctaLabel'] : 'Apply Now',
            ];
        }
        $details = array_filter($details, static function ($value) { return $value !== ''; });

        $attachment_check = self::validate_attachment();
        if (is_wp_error($attachment_check)) {
            return $attachment_check;
        }

        $link_url = trim((string) $request->get_param('linkUrl'));
        if ($link_url !== '') {
            $has_file = !empty($_FILES['image']['tmp_name']) || !empty($_FILES['video']['tmp_name']) || !empty($_FILES['file']['tmp_name']);
            if ($has_file) {
                return new WP_Error('c767_community_attachment_limit', 'Attach one photo, video, file, or link per update.', ['status' => 400]);
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
        update_post_meta($post_id, '_community_details', $details);

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
        $file_url = '';
        $file_name = '';
        $file_type = '';
        $file_size = 0;
        if (!empty($_FILES['file']['tmp_name'])) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            $file_name = sanitize_file_name((string) ($_FILES['file']['name'] ?? 'attachment'));
            $attachment_id = media_handle_upload('file', $post_id);
            if (is_wp_error($attachment_id)) {
                wp_delete_post($post_id, true);
                return new WP_Error('c767_community_file_failed', 'The file could not be uploaded. Try a PDF, Word, Excel, PowerPoint, CSV, or text file.', ['status' => 400]);
            }
            $file_url = wp_get_attachment_url($attachment_id);
            $file_type = (string) get_post_mime_type($attachment_id);
            $stored_file = get_attached_file($attachment_id);
            $file_size = $stored_file && file_exists($stored_file) ? (int) filesize($stored_file) : (int) ($_FILES['file']['size'] ?? 0);
            update_post_meta($attachment_id, '_c767_original_name', $file_name);
        }
        update_post_meta($post_id, '_community_file_url', $file_url);
        update_post_meta($post_id, '_community_file_name', $file_name);
        update_post_meta($post_id, '_community_file_type', $file_type);
        update_post_meta($post_id, '_community_file_size', $file_size);
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
        global $wpdb;
        $table = C767_Social_Database::table('reports');
        $duplicate = (bool) $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE object_type = 'post' AND object_id = %d AND reporter_user_id = %d", $post_id, $user_id));
        if (!$duplicate) {
            $now = current_time('mysql', true);
            $wpdb->insert($table, [
                'object_type' => 'post',
                'object_id' => $post_id,
                'reporter_user_id' => $user_id,
                'reason' => $reason,
                'details' => '',
                'status' => 'open',
                'created_at' => $now,
                'updated_at' => $now,
            ], ['%s', '%d', '%d', '%s', '%s', '%s', '%s', '%s']);
        }
        return rest_ensure_response(['reported' => true, 'duplicate' => $duplicate, 'id' => $post_id]);
    }

    private static function validate_attachment()
    {
        $has_image = isset($_FILES['image']) && (int) ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        $has_video = isset($_FILES['video']) && (int) ($_FILES['video']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        $has_file = isset($_FILES['file']) && (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        if (count(array_filter([$has_image, $has_video, $has_file])) > 1) {
            return new WP_Error('c767_community_attachment_limit', 'Attach one photo, video, file, or link per update.', ['status' => 400]);
        }

        if ($has_file) {
            return self::validate_upload('file', self::MAX_FILE_BYTES, [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/csv',
                'text/plain',
            ]);
        }
        if ($has_video) {
            return self::validate_upload('video', self::MAX_VIDEO_BYTES, ['video/mp4', 'video/webm', 'video/quicktime']);
        }
        if ($has_image) {
            return self::validate_upload('image', self::MAX_IMAGE_BYTES, ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        }
        return true;
    }

    private static function sanitize_date($value)
    {
        $value = sanitize_text_field($value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
    }

    private static function validate_upload($field, $max_bytes, $allowed_types)
    {
        $file = $_FILES[$field];
        $label = in_array($field, ['video', 'file'], true) ? $field : 'image';

        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) {
            return true;
        }
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            || (int) ($file['size'] ?? 0) > $max_bytes) {
            return new WP_Error(
                'c767_community_' . $label . '_too_large',
                $label === 'video' ? 'Community videos must be 25 MB or smaller.' : ($label === 'file' ? 'Community files must be 10 MB or smaller.' : 'Community images must be 5 MB or smaller.'),
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
                $label === 'video' ? 'Choose a valid MP4, WebM, or MOV video.' : ($label === 'file' ? 'Choose a PDF, Word, Excel, PowerPoint, CSV, or text file.' : 'Choose a valid JPG, PNG, WebP, or GIF image.'),
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
        $reaction_meta = self::reaction_meta_keys();
        $requested_type = sanitize_key((string) $request->get_param('type'));
        $legacy_types = ['thumb' => 'like', 'appreciate' => 'love'];
        $reaction_type = $legacy_types[$requested_type] ?? $requested_type;
        if (!isset($reaction_meta[$reaction_type])) {
            return new WP_Error('c767_invalid_community_reaction', 'Choose a valid reaction.', ['status' => 400]);
        }

        self::migrate_legacy_reactions($post->ID);
        $summary = C767_Social_Database::toggle_reaction('post', $post->ID, $user_id, $reaction_type);
        if ($summary['viewerReaction']) {
            C767_Social_Database::notify($post->post_author, $user_id, 'reaction', 'post', $post->ID, ['reaction' => $summary['viewerReaction']]);
        }

        return rest_ensure_response([
            'reactions' => $summary['counts'],
            'viewerReaction' => $summary['viewerReaction'],
            'total' => $summary['total'],
        ]);
    }

    private static function reaction_meta_keys()
    {
        return [
            'like' => '_community_thumb_user_ids',
            'dislike' => '_community_reaction_dislike_user_ids',
            'love' => '_community_reaction_user_ids',
            'care' => '_community_reaction_care_user_ids',
            'celebrate' => '_community_reaction_celebrate_user_ids',
            'support' => '_community_reaction_support_user_ids',
            'insightful' => '_community_reaction_insightful_user_ids',
            'curious' => '_community_reaction_curious_user_ids',
            'funny' => '_community_reaction_funny_user_ids',
            'wow' => '_community_reaction_wow_user_ids',
            'sad' => '_community_reaction_sad_user_ids',
            'angry' => '_community_reaction_angry_user_ids',
            'fire' => '_community_reaction_fire_user_ids',
            'applause' => '_community_reaction_applause_user_ids',
            'thanks' => '_community_reaction_thanks_user_ids',
            'hundred' => '_community_reaction_hundred_user_ids',
            'eyes' => '_community_reaction_eyes_user_ids',
            'rocket' => '_community_reaction_rocket_user_ids',
            'star' => '_community_reaction_star_user_ids',
        ];
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
        $parent_id = max(0, (int) $request->get_param('parentId'));
        if ($parent_id) {
            $parent = get_comment($parent_id);
            if (!$parent || (int) $parent->comment_post_ID !== (int) $post->ID) {
                return new WP_Error('c767_invalid_comment_parent', 'The reply target is invalid.', ['status' => 400]);
            }
        }
        $user = wp_get_current_user();
        $comment_id = wp_insert_comment([
            'comment_post_ID' => $post->ID,
            'comment_content' => $text,
            'comment_type' => 'comment',
            'comment_parent' => $parent_id,
            'user_id' => $user->ID,
            'comment_author' => $user->display_name ?: $user->user_login,
            'comment_author_email' => $user->user_email,
            'comment_approved' => 1,
        ]);
        if ($comment_id) {
            $recipient = $parent_id ? (int) get_comment($parent_id)->user_id : (int) $post->post_author;
            C767_Social_Database::notify($recipient, $user->ID, $parent_id ? 'reply' : 'comment', 'post', $post->ID, ['commentId' => (int) $comment_id]);
        }
        return new WP_REST_Response(self::serialize_comment(get_comment($comment_id)), 201);
    }

    public static function update_comment(WP_REST_Request $request)
    {
        $comment = get_comment((int) $request['comment_id']);
        if (!$comment) {
            return new WP_Error('c767_comment_not_found', 'Comment not found.', ['status' => 404]);
        }
        if ((int) $comment->user_id !== (int) get_current_user_id() && !current_user_can('edit_comment', $comment->comment_ID)) {
            return new WP_Error('c767_comment_forbidden', 'You can only edit your own comments.', ['status' => 403]);
        }
        $text = trim(sanitize_textarea_field((string) $request->get_param('text')));
        if ($text === '' || strlen($text) > 600) {
            return new WP_Error('c767_invalid_community_comment', 'Comments must contain between 1 and 600 characters.', ['status' => 400]);
        }
        $result = wp_update_comment(['comment_ID' => $comment->comment_ID, 'comment_content' => $text], true);
        if (is_wp_error($result)) {
            return $result;
        }
        return rest_ensure_response(self::serialize_comment(get_comment($comment->comment_ID)));
    }

    public static function delete_comment(WP_REST_Request $request)
    {
        $comment = get_comment((int) $request['comment_id']);
        if (!$comment) {
            return new WP_Error('c767_comment_not_found', 'Comment not found.', ['status' => 404]);
        }
        if ((int) $comment->user_id !== (int) get_current_user_id() && !current_user_can('delete_comment', $comment->comment_ID)) {
            return new WP_Error('c767_comment_forbidden', 'You can only delete your own comments.', ['status' => 403]);
        }
        if (!wp_delete_comment($comment->comment_ID, true)) {
            return new WP_Error('c767_comment_delete_failed', 'The comment could not be deleted.', ['status' => 500]);
        }
        return rest_ensure_response(['deleted' => true, 'id' => (int) $comment->comment_ID]);
    }

    public static function toggle_comment_reaction(WP_REST_Request $request)
    {
        $comment = get_comment((int) $request['comment_id']);
        if (!$comment) {
            return new WP_Error('c767_comment_not_found', 'Comment not found.', ['status' => 404]);
        }
        $reaction = sanitize_key((string) $request->get_param('type'));
        if (!isset(self::reaction_meta_keys()[$reaction])) {
            return new WP_Error('c767_invalid_community_reaction', 'Choose a valid reaction.', ['status' => 400]);
        }
        $summary = C767_Social_Database::toggle_reaction('comment', $comment->comment_ID, get_current_user_id(), $reaction);
        if ($summary['viewerReaction']) {
            C767_Social_Database::notify($comment->user_id, get_current_user_id(), 'comment_reaction', 'comment', $comment->comment_ID, ['reaction' => $summary['viewerReaction']]);
        }
        return rest_ensure_response(['reactions' => $summary['counts'], 'viewerReaction' => $summary['viewerReaction'], 'total' => $summary['total']]);
    }

    public static function toggle_bookmark(WP_REST_Request $request)
    {
        $post = get_post((int) $request['id']);
        if (!$post || $post->post_type !== 'community_update' || $post->post_status !== 'publish') {
            return new WP_Error('c767_community_post_not_found', 'Community update not found.', ['status' => 404]);
        }
        return rest_ensure_response(['bookmarked' => C767_Social_Database::toggle_bookmark($post->ID, get_current_user_id())]);
    }

    public static function toggle_repost(WP_REST_Request $request)
    {
        $post = get_post((int) $request['id']);
        if (!$post || $post->post_type !== 'community_update' || $post->post_status !== 'publish') {
            return new WP_Error('c767_community_post_not_found', 'Community update not found.', ['status' => 404]);
        }
        $listing_id = max(0, (int) $request->get_param('listingId'));
        if ($listing_id && !self::owned_listing($listing_id, get_current_user_id())) {
            return new WP_Error('c767_repost_listing_forbidden', 'You cannot repost as that business.', ['status' => 403]);
        }
        $reposted = C767_Social_Database::toggle_repost($post->ID, get_current_user_id(), $listing_id, (string) $request->get_param('quoteText'));
        if ($reposted) {
            C767_Social_Database::notify($post->post_author, get_current_user_id(), 'repost', 'post', $post->ID, ['listingId' => $listing_id]);
        }
        $summary = C767_Social_Database::repost_summary($post->ID, get_current_user_id());
        return rest_ensure_response(['reposted' => $reposted, 'count' => $summary['count']]);
    }

    public static function toggle_follow(WP_REST_Request $request)
    {
        $listing = get_post((int) $request['listing_id']);
        if (!$listing || $listing->post_type !== 'listing' || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        $following = C767_Social_Database::toggle_follow(get_current_user_id(), 'listing', $listing->ID);
        if ($following) {
            C767_Social_Database::notify($listing->post_author, get_current_user_id(), 'follow', 'listing', $listing->ID);
        }
        return rest_ensure_response(['following' => $following, 'listingId' => (int) $listing->ID]);
    }

    public static function get_notifications(WP_REST_Request $request)
    {
        global $wpdb;
        $table = C767_Social_Database::table('notifications');
        $limit = min(50, max(1, (int) $request->get_param('limit') ?: 20));
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE user_id = %d ORDER BY created_at DESC LIMIT %d", get_current_user_id(), $limit), ARRAY_A);
        $items = array_map(function ($row) {
            $actor = get_userdata((int) $row['actor_user_id']);
            return [
                'id' => (int) $row['id'],
                'type' => sanitize_key($row['notification_type']),
                'objectType' => sanitize_key($row['object_type']),
                'objectId' => (int) $row['object_id'],
                'actor' => $actor ? sanitize_text_field($actor->display_name ?: $actor->user_login) : 'Connect767 member',
                'payload' => json_decode((string) $row['payload'], true) ?: new stdClass(),
                'read' => !empty($row['read_at']),
                'createdAt' => mysql_to_rfc3339($row['created_at']),
            ];
        }, (array) $rows);
        $unread = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE user_id = %d AND read_at IS NULL", get_current_user_id()));
        return rest_ensure_response(['notifications' => $items, 'unread' => $unread]);
    }

    public static function mark_notifications_read(WP_REST_Request $request)
    {
        global $wpdb;
        $table = C767_Social_Database::table('notifications');
        $ids = array_values(array_filter(array_map('intval', (array) $request->get_param('ids'))));
        if (!$ids) {
            $wpdb->update($table, ['read_at' => current_time('mysql', true)], ['user_id' => get_current_user_id(), 'read_at' => null], ['%s'], ['%d', '%s']);
        } else {
            $placeholders = implode(',', array_fill(0, count($ids), '%d'));
            $params = array_merge([current_time('mysql', true), get_current_user_id()], $ids);
            $wpdb->query($wpdb->prepare("UPDATE $table SET read_at = %s WHERE user_id = %d AND id IN ($placeholders)", $params));
        }
        return rest_ensure_response(['read' => true]);
    }
}
