<?php
/**
 * First-party, privacy-minimized marketing analytics for Connect767.
 *
 * This module intentionally records only opaque visitor/session hashes and
 * allow-listed funnel events. It never stores IP addresses, raw visitor IDs,
 * email addresses, or invented analytics. All reporting is administrator-only.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Marketing_Growth
{
    const DB_VERSION = '1.0.0';
    const DB_OPTION = 'c767_marketing_db_version';
    const RETENTION_DAYS = 395;
    const CRON_HOOK = 'c767_marketing_cleanup';
    const ALLOWED_EVENTS = [
        'page_view',
        'registration_started',
        'registration_completed',
        'listing_started',
        'listing_submitted',
        'listing_published',
    ];

    public static function init()
    {
        self::maybe_install();
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('admin_menu', [__CLASS__, 'add_menu'], 20);
        add_action('admin_post_c767_marketing_export', [__CLASS__, 'export_csv']);
        add_action('c767_user_registered', [__CLASS__, 'track_registration'], 10, 2);
        add_action('c767_listing_submitted', [__CLASS__, 'track_listing_submission'], 10, 3);
        add_action('transition_post_status', [__CLASS__, 'track_listing_publication'], 10, 3);
        add_action(self::CRON_HOOK, [__CLASS__, 'cleanup']);

        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', self::CRON_HOOK);
        }
    }

    public static function table()
    {
        global $wpdb;
        return $wpdb->prefix . 'c767_marketing_events';
    }

    public static function maybe_install()
    {
        if ((string) get_option(self::DB_OPTION, '') !== self::DB_VERSION) {
            self::install();
        }
    }

    public static function install()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();
        $table = self::table();

        dbDelta("CREATE TABLE $table (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            event_name VARCHAR(48) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            visitor_hash CHAR(64) NOT NULL DEFAULT '',
            session_hash CHAR(64) NOT NULL DEFAULT '',
            object_type VARCHAR(32) NOT NULL DEFAULT '',
            object_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            source VARCHAR(120) NOT NULL DEFAULT 'direct',
            medium VARCHAR(80) NOT NULL DEFAULT '',
            campaign VARCHAR(160) NOT NULL DEFAULT '',
            landing_path VARCHAR(255) NOT NULL DEFAULT '',
            metadata LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY event_created (event_name, created_at),
            KEY visitor_created (visitor_hash, created_at),
            KEY session_created (session_hash, created_at),
            KEY object_created (object_type, object_id, created_at),
            KEY campaign_created (campaign, created_at)
        ) $charset;");

        update_option(self::DB_OPTION, self::DB_VERSION, false);
    }

    public static function register_routes()
    {
        register_rest_route('connect767/v1', '/marketing/events', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [__CLASS__, 'capture_event'],
            'permission_callback' => '__return_true',
        ]);
    }

    private static function client_ip()
    {
        return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
    }

    private static function hash_identifier($value, $purpose)
    {
        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }
        return hash_hmac('sha256', substr($value, 0, 128), wp_salt($purpose));
    }

    private static function rate_limited()
    {
        $key = 'c767_mkt_' . substr(self::hash_identifier(self::client_ip(), 'nonce'), 0, 32);
        $count = (int) get_transient($key);
        if ($count >= 120) {
            return true;
        }
        set_transient($key, $count + 1, MINUTE_IN_SECONDS);
        return false;
    }

    public static function capture_event(WP_REST_Request $request)
    {
        if (self::rate_limited()) {
            return new WP_Error('c767_marketing_rate_limited', 'Too many analytics events.', ['status' => 429]);
        }

        $event = sanitize_key((string) $request->get_param('event'));
        if (!in_array($event, self::ALLOWED_EVENTS, true) || in_array($event, ['registration_completed', 'listing_submitted', 'listing_published'], true)) {
            return new WP_Error('c767_marketing_invalid_event', 'This analytics event is not accepted.', ['status' => 400]);
        }

        $path = self::sanitize_path($request->get_param('path'));
        $object = self::resolve_object($path);
        self::record([
            'event_name' => $event,
            'user_id' => get_current_user_id(),
            'visitor_hash' => self::hash_identifier($request->get_param('visitorId'), 'auth'),
            'session_hash' => self::hash_identifier($request->get_param('sessionId'), 'nonce'),
            'object_type' => $object['type'],
            'object_id' => $object['id'],
            'source' => self::sanitize_source($request->get_param('source')),
            'medium' => sanitize_key((string) $request->get_param('medium')),
            'campaign' => sanitize_text_field((string) $request->get_param('campaign')),
            'landing_path' => $path,
            'metadata' => [],
        ]);

        return rest_ensure_response(['recorded' => true]);
    }

    private static function sanitize_path($value)
    {
        $value = '/' . ltrim((string) $value, '/');
        $parts = wp_parse_url($value);
        $path = isset($parts['path']) ? $parts['path'] : '/';
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        return substr(sanitize_text_field($path . $query), 0, 255);
    }

    private static function sanitize_source($value)
    {
        $source = strtolower(trim((string) $value));
        $source = preg_replace('/[^a-z0-9.\-_]/', '', $source);
        return substr($source ?: 'direct', 0, 120);
    }

    private static function resolve_object($path)
    {
        $parsed = wp_parse_url($path);
        $route = trim((string) ($parsed['path'] ?? ''), '/');
        if (preg_match('#^listings/([^/]+)$#', $route, $matches)) {
            $post = get_page_by_path(sanitize_title($matches[1]), OBJECT, 'listing');
            if ($post) {
                return ['type' => 'listing', 'id' => (int) $post->ID];
            }
        }
        return ['type' => '', 'id' => 0];
    }

    private static function record($data)
    {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'event_name' => sanitize_key($data['event_name'] ?? ''),
            'user_id' => absint($data['user_id'] ?? 0),
            'visitor_hash' => sanitize_text_field($data['visitor_hash'] ?? ''),
            'session_hash' => sanitize_text_field($data['session_hash'] ?? ''),
            'object_type' => sanitize_key($data['object_type'] ?? ''),
            'object_id' => absint($data['object_id'] ?? 0),
            'source' => self::sanitize_source($data['source'] ?? 'direct'),
            'medium' => sanitize_key($data['medium'] ?? ''),
            'campaign' => substr(sanitize_text_field($data['campaign'] ?? ''), 0, 160),
            'landing_path' => self::sanitize_path($data['landing_path'] ?? '/'),
            'metadata' => wp_json_encode($data['metadata'] ?? []),
            'created_at' => current_time('mysql', true),
        ], ['%s', '%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s']);
    }

    public static function track_registration($user_id, $account_type)
    {
        self::record([
            'event_name' => 'registration_completed',
            'user_id' => $user_id,
            'landing_path' => '/auth/register',
            'metadata' => ['account_type' => sanitize_key($account_type)],
        ]);
    }

    public static function track_listing_submission($post_id, $user_id, $tier)
    {
        self::record([
            'event_name' => 'listing_submitted',
            'user_id' => $user_id,
            'object_type' => 'listing',
            'object_id' => $post_id,
            'landing_path' => '/listings/submit',
            'metadata' => ['tier' => sanitize_key($tier)],
        ]);
    }

    public static function track_listing_publication($new_status, $old_status, $post)
    {
        if (!$post || $post->post_type !== 'listing' || $new_status !== 'publish' || $old_status === 'publish') {
            return;
        }
        self::record([
            'event_name' => 'listing_published',
            'user_id' => (int) $post->post_author,
            'object_type' => 'listing',
            'object_id' => (int) $post->ID,
            'landing_path' => '/listings/' . $post->post_name,
        ]);
    }

    public static function add_menu()
    {
        add_submenu_page(
            'connect767-cms',
            'Connect767 Marketing & Growth',
            'Marketing & Growth',
            'manage_options',
            'connect767-marketing-growth',
            [__CLASS__, 'render']
        );
    }

    private static function range()
    {
        $days = isset($_GET['days']) ? absint(wp_unslash($_GET['days'])) : 30;
        if (!in_array($days, [7, 30, 90], true)) {
            $days = 30;
        }
        $end = current_time('timestamp', true);
        return [
            'days' => $days,
            'start' => gmdate('Y-m-d H:i:s', $end - ($days * DAY_IN_SECONDS)),
            'end' => gmdate('Y-m-d H:i:s', $end),
        ];
    }

    private static function internal_metrics($range)
    {
        global $wpdb;
        $table = self::table();
        $start = $range['start'];
        $end = $range['end'];

        $page_views = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE event_name = 'page_view' AND created_at BETWEEN %s AND %s", $start, $end));
        $visitors = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor_hash) FROM $table WHERE event_name = 'page_view' AND visitor_hash <> '' AND created_at BETWEEN %s AND %s", $start, $end));
        $sessions = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT session_hash) FROM $table WHERE event_name = 'page_view' AND session_hash <> '' AND created_at BETWEEN %s AND %s", $start, $end));
        $returning = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM (SELECT visitor_hash FROM $table WHERE event_name = 'page_view' AND visitor_hash <> '' GROUP BY visitor_hash HAVING MIN(created_at) < %s AND MAX(created_at) >= %s) returning_visitors",
            $start,
            $start
        ));

        $new_users = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->users} WHERE user_registered BETWEEN %s AND %s", $start, $end));
        $new_businesses = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT u.ID) FROM {$wpdb->users} u INNER JOIN {$wpdb->usermeta} m ON m.user_id = u.ID AND m.meta_key = 'c767_account_type' AND m.meta_value = 'business' WHERE u.user_registered BETWEEN %s AND %s",
            $start,
            $end
        ));
        $new_listings = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'listing' AND post_status IN ('publish','pending','draft') AND post_date_gmt BETWEEN %s AND %s", $start, $end));

        $business_total = (int) $wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$wpdb->usermeta} WHERE meta_key = 'c767_account_type' AND meta_value = 'business'");
        $listing_owners = (int) $wpdb->get_var("SELECT COUNT(DISTINCT post_author) FROM {$wpdb->posts} WHERE post_type = 'listing' AND post_status IN ('publish','pending','draft')");
        $conversion = $business_total > 0 ? round(($listing_owners / $business_total) * 100, 1) : 0;

        $profile = self::profile_completion();
        $engagement = self::community_engagement($start, $end);

        return compact('page_views', 'visitors', 'sessions', 'returning', 'new_users', 'new_businesses', 'new_listings', 'business_total', 'listing_owners', 'conversion', 'profile', 'engagement');
    }

    private static function profile_completion()
    {
        $ids = get_posts(['post_type' => 'listing', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']);
        $completed = 0;
        foreach ($ids as $id) {
            $checks = [
                get_the_title($id),
                get_post_field('post_content', $id),
                get_the_terms($id, 'listing_category'),
                get_post_meta($id, 'location_display', true),
                get_post_meta($id, 'email', true),
                get_post_meta($id, 'phone', true) ?: get_post_meta($id, 'website', true),
                get_post_meta($id, 'logo', true),
                get_post_thumbnail_id($id),
            ];
            $score = count(array_filter($checks, function ($value) { return !empty($value) && !is_wp_error($value); }));
            if ($score >= 7) {
                $completed++;
            }
        }
        $total = count($ids);
        return ['completed' => $completed, 'total' => $total, 'rate' => $total ? round(($completed / $total) * 100, 1) : 0];
    }

    private static function community_engagement($start, $end)
    {
        global $wpdb;
        $reactions = C767_Social_Database::table('reactions');
        $reposts = C767_Social_Database::table('reposts');
        $reaction_count = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $reactions WHERE created_at BETWEEN %s AND %s", $start, $end));
        $repost_count = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $reposts WHERE created_at BETWEEN %s AND %s", $start, $end));
        $comment_count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->comments} c INNER JOIN {$wpdb->posts} p ON p.ID = c.comment_post_ID WHERE p.post_type = 'community_update' AND c.comment_approved = '1' AND c.comment_date_gmt BETWEEN %s AND %s",
            $start,
            $end
        ));
        return ['total' => $reaction_count + $repost_count + $comment_count, 'reactions' => $reaction_count, 'comments' => $comment_count, 'reposts' => $repost_count];
    }

    private static function table_rows($range)
    {
        global $wpdb;
        $events = self::table();
        $start = $range['start'];
        $end = $range['end'];

        $sources = $wpdb->get_results($wpdb->prepare(
            "SELECT source AS label, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM $events WHERE event_name = 'page_view' AND created_at BETWEEN %s AND %s GROUP BY source ORDER BY views DESC LIMIT 8",
            $start,
            $end
        ), ARRAY_A);
        $listings = $wpdb->get_results($wpdb->prepare(
            "SELECT p.post_title AS label, COUNT(*) AS views, COUNT(DISTINCT e.visitor_hash) AS visitors FROM $events e INNER JOIN {$wpdb->posts} p ON p.ID = e.object_id WHERE e.event_name = 'page_view' AND e.object_type = 'listing' AND e.created_at BETWEEN %s AND %s GROUP BY e.object_id, p.post_title ORDER BY views DESC LIMIT 8",
            $start,
            $end
        ), ARRAY_A);
        $categories = $wpdb->get_results($wpdb->prepare(
            "SELECT t.name AS label, COUNT(*) AS views, COUNT(DISTINCT e.visitor_hash) AS visitors FROM $events e INNER JOIN {$wpdb->term_relationships} r ON r.object_id = e.object_id INNER JOIN {$wpdb->term_taxonomy} tx ON tx.term_taxonomy_id = r.term_taxonomy_id AND tx.taxonomy = 'listing_category' INNER JOIN {$wpdb->terms} t ON t.term_id = tx.term_id WHERE e.event_name = 'page_view' AND e.object_type = 'listing' AND e.created_at BETWEEN %s AND %s GROUP BY t.term_id, t.name ORDER BY views DESC LIMIT 8",
            $start,
            $end
        ), ARRAY_A);
        $campaigns = $wpdb->get_results($wpdb->prepare(
            "SELECT campaign AS label, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM $events WHERE event_name = 'page_view' AND campaign <> '' AND created_at BETWEEN %s AND %s GROUP BY campaign ORDER BY views DESC LIMIT 8",
            $start,
            $end
        ), ARRAY_A);
        $funnel_counts = $wpdb->get_results($wpdb->prepare(
            "SELECT event_name, COUNT(*) AS total FROM $events WHERE event_name IN ('registration_started','registration_completed','listing_started','listing_submitted') AND created_at BETWEEN %s AND %s GROUP BY event_name",
            $start,
            $end
        ), OBJECT_K);
        $funnel = [];
        foreach (['registration_started', 'registration_completed', 'listing_started', 'listing_submitted'] as $event_name) {
            $funnel[$event_name] = isset($funnel_counts[$event_name]) ? (int) $funnel_counts[$event_name]->total : 0;
        }
        $daily_views = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(created_at) AS day, COUNT(*) AS total FROM $events WHERE event_name = 'page_view' AND created_at BETWEEN %s AND %s GROUP BY DATE(created_at) ORDER BY day ASC",
            $start,
            $end
        ), OBJECT_K);
        $daily_users = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(user_registered) AS day, COUNT(*) AS total FROM {$wpdb->users} WHERE user_registered BETWEEN %s AND %s GROUP BY DATE(user_registered) ORDER BY day ASC",
            $start,
            $end
        ), OBJECT_K);
        $daily_listings = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(post_date_gmt) AS day, COUNT(*) AS total FROM {$wpdb->posts} WHERE post_type = 'listing' AND post_status IN ('publish','pending','draft') AND post_date_gmt BETWEEN %s AND %s GROUP BY DATE(post_date_gmt) ORDER BY day ASC",
            $start,
            $end
        ), OBJECT_K);
        $trends = [];
        $trend_days = min($range['days'], 30);
        for ($offset = $trend_days - 1; $offset >= 0; $offset--) {
            $day = gmdate('Y-m-d', strtotime($end . ' UTC') - ($offset * DAY_IN_SECONDS));
            $trends[] = [
                'day' => $day,
                'views' => isset($daily_views[$day]) ? (int) $daily_views[$day]->total : 0,
                'users' => isset($daily_users[$day]) ? (int) $daily_users[$day]->total : 0,
                'listings' => isset($daily_listings[$day]) ? (int) $daily_listings[$day]->total : 0,
            ];
        }
        return compact('sources', 'listings', 'categories', 'campaigns', 'funnel', 'trends');
    }

    private static function metric_card($label, $value, $note)
    {
        echo '<div class="c767-growth-card"><span class="c767-growth-label">' . esc_html($label) . '</span><strong>' . esc_html($value) . '</strong><small>' . esc_html($note) . '</small></div>';
    }

    private static function render_table($title, $rows, $empty)
    {
        echo '<section class="c767-growth-panel"><h2>' . esc_html($title) . '</h2>';
        if (!$rows) {
            echo '<p class="description">' . esc_html($empty) . '</p></section>';
            return;
        }
        echo '<table class="widefat striped"><thead><tr><th>Name</th><th>Views</th><th>Visitors</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            echo '<tr><td>' . esc_html($row['label'] ?: 'Direct') . '</td><td>' . esc_html((int) $row['views']) . '</td><td>' . esc_html((int) $row['visitors']) . '</td></tr>';
        }
        echo '</tbody></table></section>';
    }

    private static function render_funnel($funnel)
    {
        $registration_rate = $funnel['registration_started'] > 0
            ? round(($funnel['registration_completed'] / $funnel['registration_started']) * 100, 1)
            : 0;
        $listing_rate = $funnel['listing_started'] > 0
            ? round(($funnel['listing_submitted'] / $funnel['listing_started']) * 100, 1)
            : 0;
        ?>
        <section class="c767-growth-panel c767-growth-funnel">
            <h2>Registration funnel</h2>
            <div><span>Registration started</span><strong><?php echo esc_html($funnel['registration_started']); ?></strong></div>
            <div><span>Registration completed</span><strong><?php echo esc_html($funnel['registration_completed']); ?></strong></div>
            <p><strong><?php echo esc_html($registration_rate); ?>%</strong> observed completion rate</p>
            <hr>
            <div><span>Listing started</span><strong><?php echo esc_html($funnel['listing_started']); ?></strong></div>
            <div><span>Listing submitted</span><strong><?php echo esc_html($funnel['listing_submitted']); ?></strong></div>
            <p><strong><?php echo esc_html($listing_rate); ?>%</strong> observed submission rate</p>
            <small class="description">Rates use actual captured starts and completions in this period. They are not forecasts.</small>
        </section>
        <?php
    }

    private static function render_trends($trends)
    {
        $max = 1;
        foreach ($trends as $row) {
            $max = max($max, $row['views'], $row['users'], $row['listings']);
        }
        ?>
        <section class="c767-growth-panel c767-growth-trends">
            <h2>Growth trends <small>(last <?php echo esc_html(count($trends)); ?> days)</small></h2>
            <div class="c767-trend-legend"><span class="views">Page views</span><span class="users">Registrations</span><span class="listings">Listings</span></div>
            <div class="c767-trend-chart" role="img" aria-label="Daily page views, registrations, and listings">
                <?php foreach ($trends as $row) : ?>
                    <div class="c767-trend-day" title="<?php echo esc_attr($row['day'] . ': ' . $row['views'] . ' views, ' . $row['users'] . ' registrations, ' . $row['listings'] . ' listings'); ?>">
                        <i class="views" style="height:<?php echo esc_attr(max(2, round(($row['views'] / $max) * 100))); ?>%"></i>
                        <i class="users" style="height:<?php echo esc_attr(max(2, round(($row['users'] / $max) * 100))); ?>%"></i>
                        <i class="listings" style="height:<?php echo esc_attr(max(2, round(($row['listings'] / $max) * 100))); ?>%"></i>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php
    }

    public static function render()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to view marketing analytics.', 'connect767-cms'));
        }
        $range = self::range();
        $metrics = self::internal_metrics($range);
        $rows = self::table_rows($range);
        $export_url = wp_nonce_url(admin_url('admin-post.php?action=c767_marketing_export&days=' . $range['days']), 'c767_marketing_export');
        ?>
        <div class="wrap c767-growth">
            <div class="c767-growth-heading">
                <div><h1>Connect767 Marketing &amp; Growth</h1><p class="description">Actual first-party visitor, registration, listing, and Community Feed performance. No estimates or seeded analytics.</p></div>
                <a class="button" href="<?php echo esc_url($export_url); ?>">Export summary CSV</a>
            </div>
            <nav class="nav-tab-wrapper">
                <?php foreach ([7, 30, 90] as $days) : ?><a class="nav-tab <?php echo $range['days'] === $days ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url(admin_url('admin.php?page=connect767-marketing-growth&days=' . $days)); ?>"><?php echo esc_html($days); ?> days</a><?php endforeach; ?>
            </nav>
            <div class="notice notice-info inline"><p><strong>Data collection starts when this plugin version is activated.</strong> Historical traffic is not backfilled. WordPress registration and listing totals remain authoritative.</p></div>
            <div class="c767-growth-grid">
                <?php
                self::metric_card('Website visitors', number_format_i18n($metrics['visitors']), 'Unique opaque visitor IDs');
                self::metric_card('Page views', number_format_i18n($metrics['page_views']), number_format_i18n($metrics['sessions']) . ' sessions');
                self::metric_card('Returning visitors', number_format_i18n($metrics['returning']), 'Visited before this period');
                self::metric_card('New users', number_format_i18n($metrics['new_users']), 'WordPress registrations');
                self::metric_card('New business accounts', number_format_i18n($metrics['new_businesses']), 'Business account registrations');
                self::metric_card('New listings', number_format_i18n($metrics['new_listings']), 'Draft, pending, and published');
                self::metric_card('Completed profiles', number_format_i18n($metrics['profile']['completed']), $metrics['profile']['rate'] . '% of published profiles');
                self::metric_card('Listing conversion', $metrics['conversion'] . '%', $metrics['listing_owners'] . ' of ' . $metrics['business_total'] . ' business accounts');
                self::metric_card('Community engagement', number_format_i18n($metrics['engagement']['total']), $metrics['engagement']['reactions'] . ' reactions · ' . $metrics['engagement']['comments'] . ' comments · ' . $metrics['engagement']['reposts'] . ' reposts');
                ?>
            </div>
            <div class="c767-growth-integrations">
                <div><strong>First-party analytics</strong><span class="c767-status is-live">Active</span><p>Privacy-minimized page, source, registration, and listing funnel events.</p></div>
                <div><strong>Google Analytics 4</strong><span class="c767-status">Not connected</span><p>External analytics remain blank until an administrator authorizes GA4.</p></div>
                <div><strong>Google Search Console</strong><span class="c767-status">Not connected</span><p>Search metrics remain blank until an administrator authorizes Search Console.</p></div>
            </div>
            <div class="c767-growth-tables">
                <?php self::render_funnel($rows['funnel']); ?>
                <?php self::render_trends($rows['trends']); ?>
                <?php self::render_table('Traffic sources', $rows['sources'], 'No page views have been recorded in this period.'); ?>
                <?php self::render_table('Most visited listings', $rows['listings'], 'No listing profile views have been recorded in this period.'); ?>
                <?php self::render_table('Most visited categories', $rows['categories'], 'Category performance appears after listing profile views are recorded.'); ?>
                <?php self::render_table('Campaign performance', $rows['campaigns'], 'No UTM-tagged campaign visits have been recorded in this period.'); ?>
            </div>
            <p class="description">Completed profile definition: published listing with at least 7 of 8 core elements (name, description, category, location, email, phone/website, logo, cover). Listing conversion: business accounts owning at least one listing divided by all business accounts.</p>
        </div>
        <style>
            .c767-growth{max-width:1400px}.c767-growth-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:18px 0}.c767-growth-heading h1{margin:0 0 6px}.c767-growth .notice.inline{display:block;margin:18px 0}.c767-growth-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:18px 0}.c767-growth-card{display:flex;min-height:112px;flex-direction:column;gap:6px;padding:18px;background:#fff;border:1px solid #dcdcde;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.03)}.c767-growth-card strong{font-size:27px;line-height:1.1;color:#0c5d37}.c767-growth-card small,.c767-growth-label{color:#646970}.c767-growth-label{font-weight:600}.c767-growth-integrations{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:22px 0}.c767-growth-integrations>div{position:relative;padding:18px;background:#f6f7f7;border:1px solid #dcdcde;border-radius:10px}.c767-growth-integrations p{margin:10px 0 0;color:#646970}.c767-status{float:right;padding:3px 8px;border-radius:999px;background:#f0f0f1;color:#50575e;font-size:11px;font-weight:700}.c767-status.is-live{background:#dff6e8;color:#075c31}.c767-growth-tables{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}.c767-growth-panel{padding:18px;background:#fff;border:1px solid #dcdcde;border-radius:10px}.c767-growth-panel h2{margin:0 0 14px}.c767-growth-panel h2 small{font-size:12px;color:#646970}.c767-growth-funnel>div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f1}.c767-growth-funnel p{margin:10px 0}.c767-growth-funnel hr{border:0;border-top:1px solid #dcdcde;margin:14px 0}.c767-trend-legend{display:flex;gap:16px;margin-bottom:12px;font-size:12px}.c767-trend-legend span:before{content:'';display:inline-block;width:8px;height:8px;margin-right:5px;border-radius:50%;background:#0c5d37}.c767-trend-legend .users:before{background:#d95537}.c767-trend-legend .listings:before{background:#2271b1}.c767-trend-chart{height:180px;display:flex;align-items:flex-end;gap:3px;padding-top:10px;border-bottom:1px solid #dcdcde}.c767-trend-day{height:100%;flex:1;display:flex;align-items:flex-end;gap:1px}.c767-trend-day i{display:block;flex:1;min-height:2px;background:#0c5d37;border-radius:2px 2px 0 0}.c767-trend-day .users{background:#d95537}.c767-trend-day .listings{background:#2271b1}@media(max-width:782px){.c767-growth-heading{display:block}.c767-growth-heading .button{margin-top:12px}.c767-growth-tables{grid-template-columns:1fr}}
        </style>
        <?php
    }

    public static function export_csv()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to export marketing analytics.', 'connect767-cms'));
        }
        check_admin_referer('c767_marketing_export');
        $range = self::range();
        $metrics = self::internal_metrics($range);

        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=connect767-marketing-' . gmdate('Y-m-d') . '.csv');
        $output = fopen('php://output', 'w');
        fputcsv($output, ['Metric', 'Value', 'Period days']);
        fputcsv($output, ['Website visitors', $metrics['visitors'], $range['days']]);
        fputcsv($output, ['Page views', $metrics['page_views'], $range['days']]);
        fputcsv($output, ['Returning visitors', $metrics['returning'], $range['days']]);
        fputcsv($output, ['New users', $metrics['new_users'], $range['days']]);
        fputcsv($output, ['New business accounts', $metrics['new_businesses'], $range['days']]);
        fputcsv($output, ['New listings', $metrics['new_listings'], $range['days']]);
        fputcsv($output, ['Completed profiles', $metrics['profile']['completed'], $range['days']]);
        fputcsv($output, ['Listing conversion percent', $metrics['conversion'], $range['days']]);
        fputcsv($output, ['Community engagement', $metrics['engagement']['total'], $range['days']]);
        fclose($output);
        exit;
    }

    public static function cleanup()
    {
        global $wpdb;
        $cutoff = gmdate('Y-m-d H:i:s', time() - (self::RETENTION_DAYS * DAY_IN_SECONDS));
        $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table() . ' WHERE created_at < %s', $cutoff));
    }

    public static function deactivate()
    {
        $timestamp = wp_next_scheduled(self::CRON_HOOK);
        if ($timestamp) {
            wp_unschedule_event($timestamp, self::CRON_HOOK);
        }
    }
}
