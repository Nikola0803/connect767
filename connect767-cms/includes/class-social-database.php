<?php
/** Persistent relationship storage for the Connect767 social feed. */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Social_Database
{
    const VERSION = '1.0.0';
    const OPTION = 'c767_social_database_version';

    public static function init()
    {
        self::maybe_install();
    }

    public static function table($name)
    {
        global $wpdb;
        return $wpdb->prefix . 'c767_social_' . sanitize_key($name);
    }

    public static function maybe_install()
    {
        if ((string) get_option(self::OPTION, '') !== self::VERSION) {
            self::install();
        }
    }

    public static function install()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();

        dbDelta('CREATE TABLE ' . self::table('reactions') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            object_type VARCHAR(20) NOT NULL,
            object_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            reaction VARCHAR(32) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY object_user (object_type, object_id, user_id),
            KEY object_reaction (object_type, object_id, reaction),
            KEY user_id (user_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('follows') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            follower_user_id BIGINT UNSIGNED NOT NULL,
            subject_type VARCHAR(20) NOT NULL,
            subject_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY follower_subject (follower_user_id, subject_type, subject_id),
            KEY subject (subject_type, subject_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('reposts') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            post_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            listing_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            quote_text TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY post_user_listing (post_id, user_id, listing_id),
            KEY post_id (post_id),
            KEY user_id (user_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('bookmarks') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            post_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY post_user (post_id, user_id),
            KEY user_id (user_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('notifications') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            actor_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            notification_type VARCHAR(40) NOT NULL,
            object_type VARCHAR(20) NOT NULL,
            object_id BIGINT UNSIGNED NOT NULL,
            payload LONGTEXT NULL,
            read_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY user_read_created (user_id, read_at, created_at),
            KEY object (object_type, object_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('reports') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            object_type VARCHAR(20) NOT NULL,
            object_id BIGINT UNSIGNED NOT NULL,
            reporter_user_id BIGINT UNSIGNED NOT NULL,
            reason VARCHAR(40) NOT NULL,
            details TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY object_reporter (object_type, object_id, reporter_user_id),
            KEY status_created (status, created_at)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('poll_votes') . " (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            poll_id BIGINT UNSIGNED NOT NULL,
            option_key VARCHAR(64) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY poll_user (poll_id, user_id),
            KEY poll_option (poll_id, option_key)
        ) $charset;");

        update_option(self::OPTION, self::VERSION, false);
    }

    public static function reaction_summary($object_type, $object_id, $viewer_user_id = 0)
    {
        global $wpdb;
        $table = self::table('reactions');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT reaction, COUNT(*) AS total FROM $table WHERE object_type = %s AND object_id = %d GROUP BY reaction",
            sanitize_key($object_type),
            (int) $object_id
        ), ARRAY_A);
        $counts = [];
        $total = 0;
        foreach ((array) $rows as $row) {
            $counts[sanitize_key($row['reaction'])] = (int) $row['total'];
            $total += (int) $row['total'];
        }
        $viewer_reaction = '';
        if ($viewer_user_id) {
            $viewer_reaction = (string) $wpdb->get_var($wpdb->prepare(
                "SELECT reaction FROM $table WHERE object_type = %s AND object_id = %d AND user_id = %d",
                sanitize_key($object_type),
                (int) $object_id,
                (int) $viewer_user_id
            ));
        }
        return ['counts' => $counts, 'total' => $total, 'viewerReaction' => sanitize_key($viewer_reaction)];
    }

    public static function toggle_reaction($object_type, $object_id, $user_id, $reaction)
    {
        global $wpdb;
        $table = self::table('reactions');
        $object_type = sanitize_key($object_type);
        $reaction = sanitize_key($reaction);
        $current = (string) $wpdb->get_var($wpdb->prepare(
            "SELECT reaction FROM $table WHERE object_type = %s AND object_id = %d AND user_id = %d",
            $object_type,
            (int) $object_id,
            (int) $user_id
        ));
        if ($current === $reaction) {
            $wpdb->delete($table, ['object_type' => $object_type, 'object_id' => (int) $object_id, 'user_id' => (int) $user_id], ['%s', '%d', '%d']);
        } else {
            $now = current_time('mysql', true);
            $wpdb->replace($table, [
                'object_type' => $object_type,
                'object_id' => (int) $object_id,
                'user_id' => (int) $user_id,
                'reaction' => $reaction,
                'created_at' => $now,
                'updated_at' => $now,
            ], ['%s', '%d', '%d', '%s', '%s', '%s']);
        }
        return self::reaction_summary($object_type, $object_id, $user_id);
    }

    public static function toggle_bookmark($post_id, $user_id)
    {
        global $wpdb;
        $table = self::table('bookmarks');
        $exists = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE post_id = %d AND user_id = %d", (int) $post_id, (int) $user_id));
        if ($exists) {
            $wpdb->delete($table, ['id' => $exists], ['%d']);
            return false;
        }
        $wpdb->insert($table, ['post_id' => (int) $post_id, 'user_id' => (int) $user_id, 'created_at' => current_time('mysql', true)], ['%d', '%d', '%s']);
        return true;
    }

    public static function is_bookmarked($post_id, $user_id)
    {
        global $wpdb;
        return $user_id > 0 && (bool) $wpdb->get_var($wpdb->prepare("SELECT id FROM " . self::table('bookmarks') . " WHERE post_id = %d AND user_id = %d", (int) $post_id, (int) $user_id));
    }

    public static function toggle_follow($follower_user_id, $subject_type, $subject_id)
    {
        global $wpdb;
        $table = self::table('follows');
        $subject_type = sanitize_key($subject_type);
        $exists = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE follower_user_id = %d AND subject_type = %s AND subject_id = %d", (int) $follower_user_id, $subject_type, (int) $subject_id));
        if ($exists) {
            $wpdb->delete($table, ['id' => $exists], ['%d']);
            return false;
        }
        $wpdb->insert($table, ['follower_user_id' => (int) $follower_user_id, 'subject_type' => $subject_type, 'subject_id' => (int) $subject_id, 'created_at' => current_time('mysql', true)], ['%d', '%s', '%d', '%s']);
        return true;
    }

    public static function is_following($follower_user_id, $subject_type, $subject_id)
    {
        global $wpdb;
        return $follower_user_id > 0 && (bool) $wpdb->get_var($wpdb->prepare("SELECT id FROM " . self::table('follows') . " WHERE follower_user_id = %d AND subject_type = %s AND subject_id = %d", (int) $follower_user_id, sanitize_key($subject_type), (int) $subject_id));
    }

    public static function followed_subject_ids($follower_user_id, $subject_type)
    {
        global $wpdb;
        return array_map('intval', (array) $wpdb->get_col($wpdb->prepare("SELECT subject_id FROM " . self::table('follows') . " WHERE follower_user_id = %d AND subject_type = %s", (int) $follower_user_id, sanitize_key($subject_type))));
    }

    public static function toggle_repost($post_id, $user_id, $listing_id = 0, $quote_text = '')
    {
        global $wpdb;
        $table = self::table('reposts');
        $where = ['post_id' => (int) $post_id, 'user_id' => (int) $user_id, 'listing_id' => (int) $listing_id];
        $exists = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE post_id = %d AND user_id = %d AND listing_id = %d", (int) $post_id, (int) $user_id, (int) $listing_id));
        if ($exists) {
            $wpdb->delete($table, ['id' => $exists], ['%d']);
            return false;
        }
        $wpdb->insert($table, array_merge($where, ['quote_text' => sanitize_textarea_field($quote_text), 'created_at' => current_time('mysql', true)]), ['%d', '%d', '%d', '%s', '%s']);
        return true;
    }

    public static function repost_summary($post_id, $user_id = 0)
    {
        global $wpdb;
        $table = self::table('reposts');
        $count = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE post_id = %d", (int) $post_id));
        $viewer = $user_id > 0 && (bool) $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE post_id = %d AND user_id = %d", (int) $post_id, (int) $user_id));
        return ['count' => $count, 'viewerReposted' => $viewer];
    }

    public static function notify($user_id, $actor_user_id, $type, $object_type, $object_id, $payload = [])
    {
        global $wpdb;
        if ((int) $user_id <= 0 || (int) $user_id === (int) $actor_user_id) {
            return;
        }
        $wpdb->insert(self::table('notifications'), [
            'user_id' => (int) $user_id,
            'actor_user_id' => (int) $actor_user_id,
            'notification_type' => sanitize_key($type),
            'object_type' => sanitize_key($object_type),
            'object_id' => (int) $object_id,
            'payload' => wp_json_encode($payload),
            'read_at' => null,
            'created_at' => current_time('mysql', true),
        ], ['%d', '%d', '%s', '%s', '%d', '%s', '%s', '%s']);
    }
}
