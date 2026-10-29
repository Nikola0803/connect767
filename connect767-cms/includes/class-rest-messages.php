<?php
/** Private, authenticated messaging tied to directory listings and bookings. */
if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Messages
{
    const NAMESPACE_ = 'connect767/v1';
    const MAX_MESSAGE_LENGTH = 4000;

    public static function init()
    {
        add_action('init', [__CLASS__, 'register_post_types']);
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_post_types()
    {
        register_post_type('c767_thread', [
            'label' => 'Message Threads',
            'labels' => ['name' => 'Message Threads', 'singular_name' => 'Message Thread', 'menu_name' => 'Messages'],
            'public' => false,
            'show_ui' => true,
            'show_in_menu' => 'edit.php?post_type=listing',
            'show_in_rest' => false,
            'supports' => ['title'],
        ]);
        register_post_type('c767_message', [
            'label' => 'Messages',
            'public' => false,
            'show_ui' => false,
            'show_in_rest' => false,
            'supports' => ['editor', 'author'],
        ]);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/messages/threads', [
            ['methods' => 'GET', 'callback' => [__CLASS__, 'threads'], 'permission_callback' => [__CLASS__, 'check_auth']],
            ['methods' => 'POST', 'callback' => [__CLASS__, 'start_thread'], 'permission_callback' => [__CLASS__, 'check_auth']],
        ]);
        register_rest_route(self::NAMESPACE_, '/messages/threads/(?P<id>\d+)', [
            ['methods' => 'GET', 'callback' => [__CLASS__, 'thread'], 'permission_callback' => [__CLASS__, 'check_auth']],
            ['methods' => 'POST', 'callback' => [__CLASS__, 'reply'], 'permission_callback' => [__CLASS__, 'check_auth']],
        ]);
        register_rest_route(self::NAMESPACE_, '/messages/threads/(?P<id>\d+)/read', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'mark_read'], 'permission_callback' => [__CLASS__, 'check_auth'],
        ]);
        register_rest_route(self::NAMESPACE_, '/messages/unread-count', [
            'methods' => 'GET', 'callback' => [__CLASS__, 'unread_count'], 'permission_callback' => [__CLASS__, 'check_auth'],
        ]);
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
    }

    private static function user(WP_REST_Request $request)
    {
        return C767_REST_Auth::user_from_request($request);
    }

    private static function participant_ids($thread_id)
    {
        return [(int) get_post_meta($thread_id, 'customer_user_id', true), (int) get_post_meta($thread_id, 'owner_user_id', true)];
    }

    private static function participant_thread($thread_id, $user_id)
    {
        $thread = get_post((int) $thread_id);
        if (!$thread || $thread->post_type !== 'c767_thread') {
            return new WP_Error('c767_thread_not_found', 'Conversation not found.', ['status' => 404]);
        }
        if (!in_array((int) $user_id, self::participant_ids($thread->ID), true)) {
            return new WP_Error('c767_thread_forbidden', 'You are not a participant in this conversation.', ['status' => 403]);
        }
        return $thread;
    }

    private static function clean_message($value)
    {
        $message = trim(sanitize_textarea_field((string) $value));
        if ($message === '') {
            return new WP_Error('c767_message_empty', 'Write a message before sending.', ['status' => 400]);
        }
        $length = function_exists('mb_strlen') ? mb_strlen($message) : strlen($message);
        if ($length > self::MAX_MESSAGE_LENGTH) {
            return new WP_Error('c767_message_long', 'Messages are limited to 4,000 characters.', ['status' => 400]);
        }
        return $message;
    }

    private static function rate_limit($user_id)
    {
        $key = 'c767_message_rate_' . (int) $user_id;
        $count = (int) get_transient($key);
        if ($count >= 20) {
            return new WP_Error('c767_message_rate_limit', 'Too many messages. Please wait a minute and try again.', ['status' => 429]);
        }
        set_transient($key, $count + 1, MINUTE_IN_SECONDS);
        return true;
    }

    private static function message_posts($thread_id)
    {
        return get_posts([
            'post_type' => 'c767_message', 'post_status' => 'publish', 'post_parent' => (int) $thread_id,
            'numberposts' => 200, 'orderby' => 'date', 'order' => 'ASC',
        ]);
    }

    private static function last_message($thread_id)
    {
        $posts = get_posts([
            'post_type' => 'c767_message', 'post_status' => 'publish', 'post_parent' => (int) $thread_id,
            'numberposts' => 1, 'orderby' => 'date', 'order' => 'DESC',
        ]);
        return $posts ? $posts[0] : null;
    }

    private static function format_message($post, $viewer_id)
    {
        $sender = get_userdata($post->post_author);
        return [
            'id' => (int) $post->ID,
            'body' => (string) $post->post_content,
            'senderId' => (int) $post->post_author,
            'senderName' => $sender ? ($sender->display_name ?: $sender->user_login) : 'Connect767 member',
            'mine' => (int) $post->post_author === (int) $viewer_id,
            'createdAt' => mysql_to_rfc3339($post->post_date_gmt ?: $post->post_date),
        ];
    }

    private static function is_unread($thread_id, $user_id)
    {
        $last = self::last_message($thread_id);
        if (!$last || (int) $last->post_author === (int) $user_id) {
            return false;
        }
        $read_at = (int) get_post_meta($thread_id, 'read_at_' . (int) $user_id, true);
        return strtotime($last->post_date_gmt ?: $last->post_date) > $read_at;
    }

    private static function format_thread($thread, $viewer_id, $with_messages = false)
    {
        $listing_id = (int) get_post_meta($thread->ID, 'listing_id', true);
        $listing = get_post($listing_id);
        [$customer_id, $owner_id] = self::participant_ids($thread->ID);
        $other = get_userdata((int) $viewer_id === $owner_id ? $customer_id : $owner_id);
        $last = self::last_message($thread->ID);
        $result = [
            'id' => (int) $thread->ID,
            'listingId' => $listing_id,
            'listingTitle' => $listing ? $listing->post_title : 'Listing',
            'listingSlug' => $listing ? $listing->post_name : '',
            'bookingId' => (int) get_post_meta($thread->ID, 'booking_id', true),
            'otherParticipant' => $other ? ($other->display_name ?: $other->user_login) : 'Connect767 member',
            'lastMessage' => $last ? wp_trim_words($last->post_content, 18, '…') : '',
            'lastMessageAt' => $last ? mysql_to_rfc3339($last->post_date_gmt ?: $last->post_date) : '',
            'unread' => self::is_unread($thread->ID, $viewer_id),
        ];
        if ($with_messages) {
            $result['messages'] = array_map(function ($post) use ($viewer_id) {
                return self::format_message($post, $viewer_id);
            }, self::message_posts($thread->ID));
        }
        return $result;
    }

    private static function insert_message($thread_id, $sender_id, $body)
    {
        $limited = self::rate_limit($sender_id);
        if (is_wp_error($limited)) {
            return $limited;
        }
        $message_id = wp_insert_post([
            'post_type' => 'c767_message', 'post_status' => 'publish', 'post_parent' => (int) $thread_id,
            'post_author' => (int) $sender_id, 'post_content' => $body,
            'post_title' => 'Message in conversation ' . (int) $thread_id,
        ], true);
        if (is_wp_error($message_id)) {
            return new WP_Error('c767_message_failed', $message_id->get_error_message(), ['status' => 400]);
        }
        update_post_meta($thread_id, 'last_message_at', time());
        update_post_meta($thread_id, 'last_sender_id', (int) $sender_id);
        update_post_meta($thread_id, 'read_at_' . (int) $sender_id, time());
        self::notify_recipient($thread_id, $sender_id, $body);
        return get_post($message_id);
    }

    private static function notify_recipient($thread_id, $sender_id, $body)
    {
        $participants = self::participant_ids($thread_id);
        $recipient_id = $participants[0] === (int) $sender_id ? $participants[1] : $participants[0];
        $recipient = get_userdata($recipient_id);
        $sender = get_userdata($sender_id);
        $listing = get_post((int) get_post_meta($thread_id, 'listing_id', true));
        if (!$recipient || !is_email($recipient->user_email)) {
            return;
        }
        $url = add_query_arg('thread', (int) $thread_id, c767_frontend_url('/messages'));
        $subject = sprintf('New Connect767 message about %s', $listing ? $listing->post_title : 'a listing');
        $mail_body = sprintf(
            "Hi %s,\n\n%s sent you a new message about %s:\n\n%s\n\nReply securely on Connect767:\n%s",
            $recipient->display_name ?: $recipient->user_login,
            $sender ? ($sender->display_name ?: $sender->user_login) : 'A Connect767 member',
            $listing ? $listing->post_title : 'a listing',
            wp_trim_words($body, 35, '…'),
            $url
        );
        if (!wp_mail($recipient->user_email, $subject, $mail_body)) {
            error_log('Connect767 message notification could not be sent for thread ' . (int) $thread_id . '.');
        }
    }

    public static function threads(WP_REST_Request $request)
    {
        $user = self::user($request);
        if (is_wp_error($user)) return $user;
        $threads = get_posts([
            'post_type' => 'c767_thread', 'post_status' => 'publish', 'numberposts' => -1,
            'meta_query' => ['relation' => 'OR',
                ['key' => 'customer_user_id', 'value' => (int) $user->ID, 'compare' => '='],
                ['key' => 'owner_user_id', 'value' => (int) $user->ID, 'compare' => '='],
            ],
        ]);
        usort($threads, function ($a, $b) {
            return (int) get_post_meta($b->ID, 'last_message_at', true) <=> (int) get_post_meta($a->ID, 'last_message_at', true);
        });
        return rest_ensure_response(array_map(function ($thread) use ($user) {
            return self::format_thread($thread, $user->ID);
        }, $threads));
    }

    public static function start_thread(WP_REST_Request $request)
    {
        $user = self::user($request);
        if (is_wp_error($user)) return $user;
        $message = self::clean_message($request->get_param('message'));
        if (is_wp_error($message)) return $message;
        $slug = sanitize_title((string) $request->get_param('listingSlug'));
        $listings = get_posts(['post_type' => 'listing', 'post_status' => 'publish', 'name' => $slug, 'numberposts' => 1]);
        if (!$listings) return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        $listing = $listings[0];
        $owner_id = (int) $listing->post_author;
        if ($owner_id === (int) $user->ID) {
            return new WP_Error('c767_message_self', 'This is your listing. Open your inbox to reply to customer conversations.', ['status' => 400]);
        }
        $booking_id = max(0, (int) $request->get_param('bookingId'));
        $existing = get_posts([
            'post_type' => 'c767_thread', 'post_status' => 'publish', 'numberposts' => 1,
            'meta_query' => [
                ['key' => 'listing_id', 'value' => (int) $listing->ID, 'compare' => '='],
                ['key' => 'customer_user_id', 'value' => (int) $user->ID, 'compare' => '='],
                ['key' => 'owner_user_id', 'value' => $owner_id, 'compare' => '='],
                ['key' => 'booking_id', 'value' => $booking_id, 'compare' => '='],
            ],
        ]);
        if ($existing) {
            $thread = $existing[0];
        } else {
            $thread_id = wp_insert_post([
                'post_type' => 'c767_thread', 'post_status' => 'publish', 'post_author' => (int) $user->ID,
                'post_title' => sprintf('%s — %s', $listing->post_title, $user->display_name ?: $user->user_login),
            ], true);
            if (is_wp_error($thread_id)) return new WP_Error('c767_thread_failed', $thread_id->get_error_message(), ['status' => 400]);
            update_post_meta($thread_id, 'listing_id', (int) $listing->ID);
            update_post_meta($thread_id, 'booking_id', $booking_id);
            update_post_meta($thread_id, 'customer_user_id', (int) $user->ID);
            update_post_meta($thread_id, 'owner_user_id', $owner_id);
            $thread = get_post($thread_id);
        }
        $created = self::insert_message($thread->ID, $user->ID, $message);
        if (is_wp_error($created)) return $created;
        return rest_ensure_response(self::format_thread($thread, $user->ID, true));
    }

    public static function thread(WP_REST_Request $request)
    {
        $user = self::user($request);
        if (is_wp_error($user)) return $user;
        $thread = self::participant_thread($request->get_param('id'), $user->ID);
        if (is_wp_error($thread)) return $thread;
        update_post_meta($thread->ID, 'read_at_' . (int) $user->ID, time());
        return rest_ensure_response(self::format_thread($thread, $user->ID, true));
    }

    public static function reply(WP_REST_Request $request)
    {
        $user = self::user($request);
        if (is_wp_error($user)) return $user;
        $thread = self::participant_thread($request->get_param('id'), $user->ID);
        if (is_wp_error($thread)) return $thread;
        $message = self::clean_message($request->get_param('message'));
        if (is_wp_error($message)) return $message;
        $created = self::insert_message($thread->ID, $user->ID, $message);
        if (is_wp_error($created)) return $created;
        return rest_ensure_response(self::format_message($created, $user->ID));
    }

    public static function mark_read(WP_REST_Request $request)
    {
        $user = self::user($request);
        if (is_wp_error($user)) return $user;
        $thread = self::participant_thread($request->get_param('id'), $user->ID);
        if (is_wp_error($thread)) return $thread;
        update_post_meta($thread->ID, 'read_at_' . (int) $user->ID, time());
        return rest_ensure_response(['id' => (int) $thread->ID, 'unread' => false]);
    }

    public static function unread_count(WP_REST_Request $request)
    {
        $response = self::threads($request);
        if (is_wp_error($response)) return $response;
        $count = 0;
        foreach ($response->get_data() as $thread) {
            if (!empty($thread['unread'])) $count++;
        }
        return rest_ensure_response(['count' => $count]);
    }
}
