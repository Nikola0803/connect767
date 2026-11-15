<?php
/** Business community feed endpoints tied to published directory listings. */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Community
{
    const NAMESPACE_ = 'connect767/v1';
    const MAX_IMAGE_BYTES = 5242880;
    const EMOTIONS = ['excited', 'grateful', 'celebrating', 'inspired', 'proud', 'focused'];

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
        $comments = get_comments([
            'post_id' => $post->ID,
            'status' => 'approve',
            'number' => 20,
            'order' => 'ASC',
        ]);
        $location = $listing_id ? (string) get_post_meta($listing_id, 'location', true) : '';
        $industry = $listing_id ? (string) get_post_meta($listing_id, 'category_slug', true) : '';
        $logo = $listing_id ? (string) get_post_meta($listing_id, 'logo', true) : '';

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
            'text' => wp_strip_all_tags($post->post_content),
            'mediaUrl' => esc_url_raw((string) get_post_meta($post->ID, '_community_media_url', true)),
            'createdAt' => mysql_to_rfc3339($post->post_date_gmt),
            'reactionCount' => count($reaction_ids),
            'reacted' => in_array(get_current_user_id(), $reaction_ids, true),
            'comments' => array_map([__CLASS__, 'serialize_comment'], $comments),
        ];
    }

    public static function get_posts(WP_REST_Request $request)
    {
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

        $image_check = self::validate_image_upload();
        if (is_wp_error($image_check)) {
            return $image_check;
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
        update_post_meta($post_id, '_community_reaction_user_ids', []);

        return new WP_REST_Response(self::serialize_post(get_post($post_id)), 201);
    }

    private static function validate_image_upload()
    {
        if (!isset($_FILES['image'])) {
            return true;
        }

        $file = $_FILES['image'];
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) {
            return true;
        }
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            || (int) ($file['size'] ?? 0) > self::MAX_IMAGE_BYTES) {
            return new WP_Error(
                'c767_community_image_too_large',
                'Community images must be 5 MB or smaller.',
                ['status' => 413]
            );
        }
        if ($error !== UPLOAD_ERR_OK) {
            return new WP_Error(
                'c767_community_image_failed',
                'The image could not be uploaded. Please try again.',
                ['status' => 400]
            );
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        $checked = wp_check_filetype_and_ext(
            (string) ($file['tmp_name'] ?? ''),
            sanitize_file_name((string) ($file['name'] ?? ''))
        );
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (empty($checked['type']) || !in_array($checked['type'], $allowed, true)) {
            return new WP_Error(
                'c767_community_image_type',
                'Choose a valid JPG, PNG, WebP, or GIF image.',
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
        $ids = get_post_meta($post->ID, '_community_reaction_user_ids', true);
        $ids = is_array($ids) ? array_values(array_unique(array_map('intval', $ids))) : [];
        if (in_array($user_id, $ids, true)) {
            $ids = array_values(array_diff($ids, [$user_id]));
        } else {
            $ids[] = $user_id;
        }
        update_post_meta($post->ID, '_community_reaction_user_ids', $ids);
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
