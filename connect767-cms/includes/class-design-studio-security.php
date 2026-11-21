<?php
/**
 * Security authority for the Connect767 Design Studio.
 *
 * AI credits, project ownership, private source files, paid entitlements and
 * download auditing live here rather than in browser storage. The Vercel AI
 * gateway talks to the service-only endpoints with a shared secret; customer
 * identity continues to use the plugin's signed JWTs.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Design_Studio_Security
{
    const NAMESPACE_ = 'connect767/v1';
    const OPTION_KEY = 'c767_design_security_settings';
    const DB_VERSION = '1.0.0';
    const TOKEN_TTL = 2592000; // 30 days.

    public static function init()
    {
        if (get_option('c767_design_security_db_version') !== self::DB_VERSION) self::install();
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        add_action('admin_menu', [__CLASS__, 'admin_menu']);
        add_action('admin_post_c767_save_design_security', [__CLASS__, 'save_settings']);
        add_action('woocommerce_payment_complete', [__CLASS__, 'grant_for_order']);
        add_action('woocommerce_order_status_processing', [__CLASS__, 'grant_for_order']);
        add_action('woocommerce_order_status_completed', [__CLASS__, 'grant_for_order']);
        add_action('woocommerce_order_status_refunded', [__CLASS__, 'revoke_for_order']);
        add_action('woocommerce_order_status_cancelled', [__CLASS__, 'revoke_for_order']);
        add_action('woocommerce_order_status_failed', [__CLASS__, 'revoke_for_order']);
    }

    public static function install()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();

        dbDelta('CREATE TABLE ' . self::table('ai_sessions') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            session_key varchar(64) NOT NULL,
            ip_hash varchar(64) NOT NULL DEFAULT '',
            user_agent_hash varchar(64) NOT NULL DEFAULT '',
            blocked tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            last_seen_at datetime NOT NULL,
            expires_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY session_key (session_key),
            KEY expires_at (expires_at)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('design_projects') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            public_id varchar(64) NOT NULL,
            owner_user_id bigint(20) unsigned NOT NULL DEFAULT 0,
            guest_session_key varchar(64) NOT NULL DEFAULT '',
            sport varchar(40) NOT NULL DEFAULT '',
            title varchar(190) NOT NULL DEFAULT '',
            status varchar(30) NOT NULL DEFAULT 'draft',
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY public_id (public_id),
            KEY owner_user_id (owner_user_id),
            KEY guest_session_key (guest_session_key)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('ai_usage') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            request_id varchar(80) NOT NULL,
            subject_type varchar(20) NOT NULL,
            subject_key varchar(80) NOT NULL,
            user_id bigint(20) unsigned NOT NULL DEFAULT 0,
            session_key varchar(64) NOT NULL DEFAULT '',
            project_id bigint(20) unsigned NOT NULL DEFAULT 0,
            operation varchar(40) NOT NULL,
            credit_cost int unsigned NOT NULL DEFAULT 1,
            status varchar(20) NOT NULL DEFAULT 'reserved',
            provider_reference varchar(190) NOT NULL DEFAULT '',
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY request_id (request_id),
            KEY subject_window (subject_type,subject_key,created_at),
            KEY project_id (project_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('design_files') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            project_id bigint(20) unsigned NOT NULL,
            request_id varchar(80) NOT NULL DEFAULT '',
            file_type varchar(30) NOT NULL,
            storage_name varchar(190) NOT NULL,
            original_name varchar(190) NOT NULL DEFAULT '',
            mime_type varchar(100) NOT NULL,
            byte_size bigint(20) unsigned NOT NULL DEFAULT 0,
            sha256 varchar(64) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id),
            KEY request_id (request_id)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('design_entitlements') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            project_id bigint(20) unsigned NOT NULL,
            user_id bigint(20) unsigned NOT NULL,
            order_id bigint(20) unsigned NOT NULL,
            file_types text NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'active',
            granted_at datetime NOT NULL,
            revoked_at datetime NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY project_order (project_id,order_id),
            KEY user_project (user_id,project_id),
            KEY status (status)
        ) $charset;");

        dbDelta('CREATE TABLE ' . self::table('design_downloads') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            file_id bigint(20) unsigned NOT NULL,
            project_id bigint(20) unsigned NOT NULL,
            user_id bigint(20) unsigned NOT NULL,
            ip_hash varchar(64) NOT NULL DEFAULT '',
            downloaded_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY user_file (user_id,file_id,downloaded_at)
        ) $charset;");

        if (!get_option(self::OPTION_KEY)) {
            add_option(self::OPTION_KEY, self::defaults(), '', false);
        }
        update_option('c767_design_security_db_version', self::DB_VERSION, false);
        self::ensure_private_directory();
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/design-security/session', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'session'], 'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE_, '/design-security/status', [
            'methods' => 'GET', 'callback' => [__CLASS__, 'status'], 'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE_, '/design-security/projects', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'create_project'], 'permission_callback' => '__return_true',
        ]);
        foreach ([
            '/design-security/ai/reserve' => 'reserve_ai',
            '/design-security/ai/settle' => 'settle_ai',
            '/design-security/files/store' => 'store_file',
        ] as $route => $callback) {
            register_rest_route(self::NAMESPACE_, $route, [
                'methods' => 'POST', 'callback' => [__CLASS__, $callback],
                'permission_callback' => [__CLASS__, 'service_permission'],
            ]);
        }
        register_rest_route(self::NAMESPACE_, '/design-security/download-token', [
            'methods' => 'POST', 'callback' => [__CLASS__, 'download_token'], 'permission_callback' => '__return_true',
        ]);
        register_rest_route(self::NAMESPACE_, '/design-security/download', [
            'methods' => 'GET', 'callback' => [__CLASS__, 'download'], 'permission_callback' => '__return_true',
        ]);
    }

    public static function service_permission(WP_REST_Request $request)
    {
        $expected = self::service_secret();
        $provided = (string) $request->get_header('x-c767-service-key');
        return $expected !== '' && $provided !== '' && hash_equals($expected, $provided);
    }

    public static function session(WP_REST_Request $request)
    {
        $identity = self::identity($request, true);
        if (is_wp_error($identity)) return $identity;
        return rest_ensure_response(self::quota_payload($identity));
    }

    public static function status(WP_REST_Request $request)
    {
        $identity = self::identity($request, false);
        if (is_wp_error($identity)) return $identity;
        $payload = self::quota_payload($identity);
        $project_id = sanitize_text_field((string) $request->get_param('projectId'));
        if ($project_id !== '') {
            $project = self::owned_project($project_id, $identity);
            if (is_wp_error($project)) return $project;
            $payload = array_merge($payload, self::project_download_state($identity, $project));
            $payload['projectId'] = $project['public_id'];
        }
        return rest_ensure_response($payload);
    }

    public static function create_project(WP_REST_Request $request)
    {
        global $wpdb;
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return new WP_Error('c767_account_required', 'Sign in before creating a design project.', ['status' => 401]);
        }
        $identity = ['type' => 'user', 'user_id' => (int) $user->ID, 'session_key' => '', 'token' => ''];
        $public_id = wp_generate_uuid4();
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert(self::table('design_projects'), [
            'public_id' => $public_id,
            'owner_user_id' => $identity['user_id'],
            'guest_session_key' => '',
            'sport' => sanitize_key((string) $request->get_param('sport')),
            'title' => sanitize_text_field((string) $request->get_param('title')),
            'status' => 'draft', 'created_at' => $now, 'updated_at' => $now,
        ], ['%s','%d','%s','%s','%s','%s','%s','%s']);
        if (!$wpdb->insert_id) return new WP_Error('c767_project_failed', 'Could not create the design project.', ['status' => 500]);
        $payload = self::quota_payload($identity);
        $payload['projectId'] = $public_id;
        return rest_ensure_response($payload);
    }

    public static function reserve_ai(WP_REST_Request $request)
    {
        global $wpdb;
        $identity = self::service_identity($request);
        if (is_wp_error($identity)) return $identity;
        $request_id = sanitize_text_field((string) $request->get_param('requestId'));
        $operation = sanitize_key((string) $request->get_param('operation')) ?: 'generation';
        if (!$request_id || strlen($request_id) > 80) {
            return new WP_Error('c767_ai_request_id', 'A valid AI request ID is required.', ['status' => 400]);
        }
        $project = self::owned_project((string) $request->get_param('projectId'), $identity);
        if (is_wp_error($project)) return $project;
        $costs = self::settings()['operation_costs'];
        $cost = max(1, absint($costs[$operation] ?? 1));
        $subject_key = $identity['user_id'] ? (string) $identity['user_id'] : $identity['session_key'];
        $lock_name = 'c767_ai_' . substr(hash('sha256', $identity['type'] . '|' . $subject_key), 0, 40);
        $locked = (int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 8)', $lock_name));
        if ($locked !== 1) return new WP_Error('c767_ai_busy', 'Another design request is being processed. Try again.', ['status' => 409]);

        try {
            $existing = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('ai_usage') . ' WHERE request_id=%s', $request_id), ARRAY_A);
            if ($existing) {
                if (!in_array($existing['status'], ['reserved','completed'], true)) {
                    return new WP_Error('c767_ai_request_finished', 'This AI request has already finished. Start a new request.', ['status' => 409]);
                }
                $payload = self::quota_payload($identity);
                $payload['requestId'] = $request_id;
                $payload['duplicate'] = true;
                $payload['allowed'] = true;
                return rest_ensure_response($payload);
            }
            $quota = self::quota($identity);
            $burst_count = (int) $wpdb->get_var($wpdb->prepare(
                'SELECT COUNT(*) FROM ' . self::table('ai_usage') . ' WHERE subject_type=%s AND subject_key=%s AND created_at >= %s',
                $identity['type'], $subject_key, gmdate('Y-m-d H:i:s', time() - 10 * MINUTE_IN_SECONDS)
            ));
            if ($burst_count >= (int) self::settings()['burst_limit']) {
                return new WP_Error('c767_ai_rate_limited', 'Too many design requests were submitted at once. Please wait a few minutes and try again.', ['status' => 429]);
            }
            if ($quota['remaining'] < $cost) {
                return new WP_Error('c767_ai_limit_reached', $identity['user_id']
                    ? 'Your daily AI design allowance has been used. Please return after the UTC reset or add more credits.'
                    : 'Your free AI design previews have been used. Create a free Connect767 account to continue designing.',
                    ['status' => 429, 'remaining' => 0, 'limit' => $quota['limit'], 'requiresAccount' => !$identity['user_id']]);
            }
            $now = gmdate('Y-m-d H:i:s');
            $ok = $wpdb->insert(self::table('ai_usage'), [
                'request_id' => $request_id, 'subject_type' => $identity['type'], 'subject_key' => $subject_key,
                'user_id' => $identity['user_id'], 'session_key' => $identity['session_key'],
                'project_id' => (int) $project['id'], 'operation' => $operation, 'credit_cost' => $cost,
                'status' => 'reserved', 'provider_reference' => '', 'created_at' => $now, 'updated_at' => $now,
            ], ['%s','%s','%s','%d','%s','%d','%s','%d','%s','%s','%s','%s']);
            if (!$ok) return new WP_Error('c767_ai_reservation_failed', 'Could not reserve an AI credit.', ['status' => 500]);
            $payload = self::quota_payload($identity);
            $payload['allowed'] = true;
            $payload['requestId'] = $request_id;
            $payload['projectId'] = $project['public_id'];
            return rest_ensure_response($payload);
        } finally {
            $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock_name));
        }
    }

    public static function settle_ai(WP_REST_Request $request)
    {
        global $wpdb;
        $request_id = sanitize_text_field((string) $request->get_param('requestId'));
        $successful = rest_sanitize_boolean($request->get_param('successful'));
        $existing = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('ai_usage') . ' WHERE request_id=%s', $request_id), ARRAY_A);
        if (!$existing) return new WP_Error('c767_ai_request_unknown', 'The AI request is not authorized.', ['status' => 404]);
        if ($existing['status'] === 'completed') {
            return rest_ensure_response(['requestId' => $request_id, 'status' => 'completed', 'duplicate' => true]);
        }
        if ($existing['status'] !== 'reserved') {
            return rest_ensure_response(['requestId' => $request_id, 'status' => $existing['status'], 'duplicate' => true]);
        }
        $status = $successful ? 'completed' : 'failed';
        $wpdb->update(self::table('ai_usage'), [
            'status' => $status,
            'credit_cost' => $successful ? max(1, (int) $existing['credit_cost']) : 0,
            'provider_reference' => sanitize_text_field((string) $request->get_param('providerReference')),
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['request_id' => $request_id], ['%s','%d','%s','%s'], ['%s']);
        return rest_ensure_response(['requestId' => $request_id, 'status' => $status]);
    }

    public static function store_file(WP_REST_Request $request)
    {
        global $wpdb;
        $request_id = sanitize_text_field((string) $request->get_param('requestId'));
        $usage = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('ai_usage') . ' WHERE request_id=%s', $request_id), ARRAY_A);
        if (!$usage) return new WP_Error('c767_ai_request_unknown', 'The AI request is not authorized.', ['status' => 403]);
        $encoded = (string) $request->get_param('b64');
        if ($encoded === '' || strlen($encoded) > 30000000) return new WP_Error('c767_file_invalid', 'The generated file is invalid.', ['status' => 400]);
        $bytes = base64_decode($encoded, true);
        if ($bytes === false || strlen($bytes) > 20 * 1024 * 1024) return new WP_Error('c767_file_invalid', 'The generated file is invalid.', ['status' => 400]);
        $info = @getimagesizefromstring($bytes);
        if (!$info || !in_array($info['mime'], ['image/png','image/jpeg','image/webp'], true)) {
            return new WP_Error('c767_file_type', 'Only generated PNG, JPEG or WebP files are accepted.', ['status' => 400]);
        }
        $dir = self::ensure_private_directory();
        if (is_wp_error($dir)) return $dir;
        $extension = $info['mime'] === 'image/jpeg' ? 'jpg' : ($info['mime'] === 'image/webp' ? 'webp' : 'png');
        $storage_name = wp_generate_password(40, false, false) . '.' . $extension;
        if (file_put_contents(trailingslashit($dir) . $storage_name, $bytes, LOCK_EX) === false) {
            return new WP_Error('c767_file_store', 'The generated file could not be secured.', ['status' => 500]);
        }
        $wpdb->insert(self::table('design_files'), [
            'project_id' => (int) $usage['project_id'], 'request_id' => $request_id,
            'file_type' => sanitize_key((string) $request->get_param('fileType')) ?: 'png',
            'storage_name' => $storage_name, 'original_name' => sanitize_file_name((string) $request->get_param('originalName')),
            'mime_type' => $info['mime'], 'byte_size' => strlen($bytes), 'sha256' => hash('sha256', $bytes),
            'created_at' => gmdate('Y-m-d H:i:s'),
        ], ['%d','%s','%s','%s','%s','%s','%d','%s','%s']);
        $preview = self::watermarked_preview($bytes, $info['mime']);
        if (is_wp_error($preview)) return $preview;
        return rest_ensure_response([
            'fileId' => (int) $wpdb->insert_id,
            'b64' => base64_encode($preview['bytes']), 'mimeType' => $preview['mimeType'],
            'watermarked' => true, 'previewOnly' => true,
        ]);
    }

    public static function download_token(WP_REST_Request $request)
    {
        global $wpdb;
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) return $user;
        $file_id = absint($request->get_param('fileId'));
        $file = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('design_files') . ' WHERE id=%d', $file_id), ARRAY_A);
        if (!$file || !self::has_entitlement($user->ID, (int) $file['project_id'], $file['file_type'])) {
            return new WP_Error('c767_download_locked', 'Complete your order to unlock high-resolution downloads and production-ready design files.', ['status' => 403]);
        }
        $settings = self::settings();
        $attempts = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . self::table('design_downloads') . ' WHERE user_id=%d AND file_id=%d', $user->ID, $file_id
        ));
        if ($attempts >= $settings['maximum_download_attempts']) {
            return new WP_Error('c767_download_limit', 'The download limit for this file has been reached.', ['status' => 429]);
        }
        $payload = ['fid' => $file_id, 'uid' => $user->ID, 'exp' => time() + 300, 'nonce' => wp_generate_password(16, false, false)];
        $token = self::sign_payload($payload);
        return rest_ensure_response(['url' => rest_url(self::NAMESPACE_ . '/design-security/download?token=' . rawurlencode($token)), 'expiresIn' => 300]);
    }

    public static function download(WP_REST_Request $request)
    {
        global $wpdb;
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) return $user;
        $payload = self::verify_payload((string) $request->get_param('token'));
        if (is_wp_error($payload) || (int) ($payload['uid'] ?? 0) !== (int) $user->ID) {
            return new WP_Error('c767_download_token', 'This download link is invalid or expired.', ['status' => 403]);
        }
        $file = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('design_files') . ' WHERE id=%d', absint($payload['fid'] ?? 0)), ARRAY_A);
        if (!$file || !self::has_entitlement($user->ID, (int) $file['project_id'], $file['file_type'])) {
            return new WP_Error('c767_download_locked', 'This design file is not available for your account.', ['status' => 403]);
        }
        $path = trailingslashit(self::private_directory()) . basename($file['storage_name']);
        $real_dir = realpath(self::private_directory());
        $real_path = realpath($path);
        if (!$real_dir || !$real_path || strpos($real_path, $real_dir . DIRECTORY_SEPARATOR) !== 0 || !is_file($real_path)) {
            return new WP_Error('c767_download_missing', 'The design file is unavailable.', ['status' => 404]);
        }
        $wpdb->insert(self::table('design_downloads'), [
            'file_id' => (int) $file['id'], 'project_id' => (int) $file['project_id'], 'user_id' => $user->ID,
            'ip_hash' => self::request_hash('ip'), 'downloaded_at' => gmdate('Y-m-d H:i:s'),
        ], ['%d','%d','%d','%s','%s']);
        nocache_headers();
        header('X-Robots-Tag: noindex, nofollow, noarchive', true);
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Disposition: attachment; filename="' . sanitize_file_name($file['original_name'] ?: 'connect767-design.' . pathinfo($real_path, PATHINFO_EXTENSION)) . '"');
        header('Content-Length: ' . filesize($real_path));
        readfile($real_path);
        exit;
    }

    public static function attach_order_project(WC_Order $order, WP_REST_Request $request, array $payload)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) return new WP_Error('c767_account_required', 'Create an account or sign in before completing a protected design order.', ['status' => 401]);
        $identity = ['type' => 'user', 'user_id' => (int) $user->ID, 'session_key' => ''];
        $designs = !empty($payload['designs']) && is_array($payload['designs']) ? array_values($payload['designs']) : [$payload];
        $projects = [];
        foreach ($designs as $design) {
            $design = (array) $design;
            $project_id = sanitize_text_field((string) ($design['projectId'] ?? ''));
            if (!$project_id) return new WP_Error('c767_project_required', 'Save every design project before checkout.', ['status' => 400]);
            $project = self::owned_project($project_id, $identity);
            if (is_wp_error($project)) return $project;
            $projects[(int) $project['id']] = $project['public_id'];
        }
        $order->set_customer_id($user->ID);
        $project_ids = array_keys($projects);
        $public_ids = array_values($projects);
        $order->update_meta_data('_c767_design_project_ids', $project_ids);
        $order->update_meta_data('_c767_design_project_public_ids', $public_ids);
        // Preserve the original single-design metadata for existing admin tools.
        $order->update_meta_data('_c767_design_project_id', (int) $project_ids[0]);
        $order->update_meta_data('_c767_design_project_public_id', $public_ids[0]);
        return true;
    }

    public static function grant_for_order($order_id)
    {
        global $wpdb;
        $order = wc_get_order($order_id);
        if (!$order || !$order->is_paid() || !$order->get_meta('_c767_uniform_order')) return;
        $user_id = absint($order->get_customer_id());
        $project_ids = array_values(array_filter(array_map('absint', (array) $order->get_meta('_c767_design_project_ids'))));
        if (empty($project_ids)) $project_ids = [absint($order->get_meta('_c767_design_project_id'))];
        if (!$user_id) return;
        $now = gmdate('Y-m-d H:i:s');
        foreach (array_unique($project_ids) as $project_id) {
            if (!$project_id) continue;
            $existing = $wpdb->get_var($wpdb->prepare('SELECT id FROM ' . self::table('design_entitlements') . ' WHERE project_id=%d AND order_id=%d', $project_id, $order->get_id()));
            $data = ['user_id' => $user_id, 'file_types' => wp_json_encode(self::settings()['supported_export_types']), 'status' => 'active', 'granted_at' => $now, 'revoked_at' => null];
            if ($existing) $wpdb->update(self::table('design_entitlements'), $data, ['id' => $existing]);
            else $wpdb->insert(self::table('design_entitlements'), array_merge(['project_id' => $project_id, 'order_id' => $order->get_id()], $data));
        }
    }

    public static function revoke_for_order($order_id)
    {
        global $wpdb;
        $wpdb->update(self::table('design_entitlements'), ['status' => 'revoked', 'revoked_at' => gmdate('Y-m-d H:i:s')], ['order_id' => absint($order_id)]);
    }

    public static function admin_menu()
    {
        add_submenu_page('connect767', 'Design Studio Security', 'Design Studio Security', 'manage_options', 'connect767-design-security', [__CLASS__, 'render_settings']);
    }

    public static function save_settings()
    {
        if (!current_user_can('manage_options') || !check_admin_referer('c767_save_design_security')) wp_die('Unauthorized.');
        $current = self::settings();
        $secret = sanitize_text_field((string) ($_POST['service_secret'] ?? ''));
        $costs = [];
        foreach (['generation','refinement','variation','artwork'] as $operation) $costs[$operation] = max(1, absint($_POST['cost_' . $operation] ?? 1));
        update_option(self::OPTION_KEY, [
            'guest_limit' => max(1, absint($_POST['guest_limit'] ?? 3)),
            'registered_daily_limit' => max(1, absint($_POST['registered_daily_limit'] ?? 10)),
            'daily_reset_hour_utc' => max(0, min(23, absint($_POST['daily_reset_hour_utc'] ?? 0))),
            'burst_limit' => max(1, min(100, absint($_POST['burst_limit'] ?? 6))),
            'reservation_timeout_minutes' => max(5, min(120, absint($_POST['reservation_timeout_minutes'] ?? 15))),
            'preview_max_width' => max(480, min(2048, absint($_POST['preview_max_width'] ?? 1200))),
            'watermark_text' => sanitize_text_field((string) ($_POST['watermark_text'] ?? 'Connect767 Design Preview')),
            'watermark_opacity' => max(5, min(60, absint($_POST['watermark_opacity'] ?? 18))),
            'maximum_download_attempts' => max(1, min(100, absint($_POST['maximum_download_attempts'] ?? 10))),
            'supported_export_types' => array_values(array_intersect(['png','svg','pdf','production'], (array) ($_POST['supported_export_types'] ?? []))),
            'operation_costs' => $costs,
            'service_secret' => $secret !== '' ? $secret : $current['service_secret'],
        ], false);
        wp_safe_redirect(add_query_arg(['page' => 'connect767-design-security', 'updated' => '1'], admin_url('admin.php')));
        exit;
    }

    public static function render_settings()
    {
        if (!current_user_can('manage_options')) return;
        $s = self::settings();
        ?>
        <div class="wrap"><h1>Connect767 Design Studio Security</h1>
        <?php if (isset($_GET['updated'])) : ?><div class="notice notice-success"><p>Security settings saved.</p></div><?php endif; ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <input type="hidden" name="action" value="c767_save_design_security"><?php wp_nonce_field('c767_save_design_security'); ?>
        <table class="form-table"><tbody>
        <tr><th>Guest AI requests</th><td><input type="number" min="1" name="guest_limit" value="<?php echo esc_attr($s['guest_limit']); ?>"></td></tr>
        <tr><th>Registered requests per UTC day</th><td><input type="number" min="1" name="registered_daily_limit" value="<?php echo esc_attr($s['registered_daily_limit']); ?>"></td></tr>
        <tr><th>Daily reset hour (UTC)</th><td><input type="number" min="0" max="23" name="daily_reset_hour_utc" value="<?php echo esc_attr($s['daily_reset_hour_utc']); ?>">:00 UTC</td></tr>
        <tr><th>Abuse threshold</th><td><input type="number" min="1" max="100" name="burst_limit" value="<?php echo esc_attr($s['burst_limit']); ?>"> requests per 10 minutes</td></tr>
        <tr><th>Reservation timeout</th><td><input type="number" min="5" max="120" name="reservation_timeout_minutes" value="<?php echo esc_attr($s['reservation_timeout_minutes']); ?>"> minutes</td></tr>
        <tr><th>Preview maximum width</th><td><input type="number" min="480" max="2048" name="preview_max_width" value="<?php echo esc_attr($s['preview_max_width']); ?>"> px</td></tr>
        <tr><th>Watermark</th><td><input class="regular-text" name="watermark_text" value="<?php echo esc_attr($s['watermark_text']); ?>"> Opacity <input type="number" min="5" max="60" name="watermark_opacity" value="<?php echo esc_attr($s['watermark_opacity']); ?>">%</td></tr>
        <tr><th>Maximum downloads per file</th><td><input type="number" min="1" max="100" name="maximum_download_attempts" value="<?php echo esc_attr($s['maximum_download_attempts']); ?>"></td></tr>
        <tr><th>Unlocked file types</th><td><?php foreach (['png','svg','pdf','production'] as $type) : ?><label style="margin-right:16px"><input type="checkbox" name="supported_export_types[]" value="<?php echo esc_attr($type); ?>" <?php checked(in_array($type, $s['supported_export_types'], true)); ?>> <?php echo esc_html(strtoupper($type)); ?></label><?php endforeach; ?></td></tr>
        <tr><th>Credit cost by operation</th><td><?php foreach (['generation','refinement','variation','artwork'] as $op) : ?><label style="margin-right:12px"><?php echo esc_html(ucfirst($op)); ?> <input style="width:60px" type="number" min="1" name="cost_<?php echo esc_attr($op); ?>" value="<?php echo esc_attr($s['operation_costs'][$op]); ?>"></label><?php endforeach; ?></td></tr>
        <tr><th>AI gateway shared secret</th><td><input type="password" autocomplete="new-password" class="regular-text" name="service_secret" placeholder="Leave blank to keep the current secret"><p class="description">Set the same value as C767_AI_SERVICE_SECRET in the frontend/serverless environment.</p></td></tr>
        </tbody></table><?php submit_button(); ?></form></div>
        <?php
    }

    private static function defaults()
    {
        return [
            'guest_limit' => 3, 'registered_daily_limit' => 10, 'daily_reset_hour_utc' => 0,
            'burst_limit' => 6, 'reservation_timeout_minutes' => 15, 'preview_max_width' => 1200,
            'watermark_text' => 'Connect767 Design Preview', 'watermark_opacity' => 18,
            'maximum_download_attempts' => 10, 'supported_export_types' => ['png','pdf','production'],
            'operation_costs' => ['generation' => 1, 'refinement' => 1, 'variation' => 1, 'artwork' => 1],
            'service_secret' => wp_generate_password(48, true, true),
        ];
    }

    private static function settings()
    {
        $saved = get_option(self::OPTION_KEY, []);
        $defaults = self::defaults();
        if (!is_array($saved) || empty($saved)) {
            update_option(self::OPTION_KEY, $defaults, false);
            $saved = $defaults;
        }
        $settings = wp_parse_args(is_array($saved) ? $saved : [], $defaults);
        $settings['operation_costs'] = wp_parse_args((array) $settings['operation_costs'], $defaults['operation_costs']);
        return $settings;
    }

    private static function service_secret()
    {
        if (defined('C767_AI_SERVICE_SECRET') && C767_AI_SERVICE_SECRET) return (string) C767_AI_SERVICE_SECRET;
        return (string) self::settings()['service_secret'];
    }

    private static function identity(WP_REST_Request $request, $create_guest)
    {
        $token = C767_JWT::bearer_token_from_request($request);
        if ($token) {
            $user = C767_REST_Auth::user_from_request($request);
            if (!is_wp_error($user)) return ['type' => 'user', 'user_id' => (int) $user->ID, 'session_key' => '', 'token' => ''];
            return $user;
        }
        $guest_token = (string) ($request->get_header('x-c767-guest-token') ?: $request->get_param('guestToken'));
        $payload = $guest_token ? self::verify_payload($guest_token) : null;
        if (!is_wp_error($payload) && !empty($payload['sid'])) {
            if (!self::touch_session($payload['sid'])) {
                return new WP_Error('c767_guest_session_expired', 'This design session has expired. Start a new design session.', ['status' => 401]);
            }
            return ['type' => 'guest', 'user_id' => 0, 'session_key' => $payload['sid'], 'token' => $guest_token];
        }
        if (!$create_guest) return new WP_Error('c767_guest_session', 'Start a design session first.', ['status' => 401]);
        return self::create_guest_identity();
    }

    private static function service_identity(WP_REST_Request $request)
    {
        $auth = (string) $request->get_header('x-c767-user-authorization');
        if ($auth) {
            $proxy = new WP_REST_Request();
            $proxy->set_header('authorization', $auth);
            $user = C767_REST_Auth::user_from_request($proxy);
            if (!is_wp_error($user)) return ['type' => 'user', 'user_id' => (int) $user->ID, 'session_key' => '', 'token' => ''];
            return $user;
        }
        $proxy = new WP_REST_Request();
        $proxy->set_header('x-c767-guest-token', (string) $request->get_header('x-c767-guest-token'));
        return self::identity($proxy, false);
    }

    private static function create_guest_identity()
    {
        global $wpdb;
        $sid = bin2hex(random_bytes(24));
        $now = gmdate('Y-m-d H:i:s');
        $expires = gmdate('Y-m-d H:i:s', time() + self::TOKEN_TTL);
        $wpdb->insert(self::table('ai_sessions'), [
            'session_key' => $sid, 'ip_hash' => self::request_hash('ip'), 'user_agent_hash' => self::request_hash('ua'),
            'blocked' => 0, 'created_at' => $now, 'last_seen_at' => $now, 'expires_at' => $expires,
        ]);
        return ['type' => 'guest', 'user_id' => 0, 'session_key' => $sid, 'token' => self::sign_payload(['sid' => $sid, 'exp' => time() + self::TOKEN_TTL])];
    }

    private static function touch_session($sid)
    {
        global $wpdb;
        $session = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('ai_sessions') . ' WHERE session_key=%s', $sid), ARRAY_A);
        if (!$session || $session['blocked'] || strtotime($session['expires_at']) < time()) return false;
        $wpdb->update(self::table('ai_sessions'), ['last_seen_at' => gmdate('Y-m-d H:i:s')], ['session_key' => $sid]);
        return true;
    }

    private static function quota($identity)
    {
        global $wpdb;
        $settings = self::settings();
        $limit = $identity['user_id'] ? (int) $settings['registered_daily_limit'] : (int) $settings['guest_limit'];
        $subject_key = $identity['user_id'] ? (string) $identity['user_id'] : $identity['session_key'];
        $window = self::registered_reset_window($settings);
        $since = $identity['user_id'] ? $window['since'] : '1970-01-01 00:00:00';
        $reservation_cutoff = gmdate('Y-m-d H:i:s', time() - (int) $settings['reservation_timeout_minutes'] * MINUTE_IN_SECONDS);
        $used = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COALESCE(SUM(credit_cost),0) FROM ' . self::table('ai_usage') . ' WHERE subject_type=%s AND subject_key=%s AND created_at >= %s AND (status=\'completed\' OR (status=\'reserved\' AND updated_at >= %s))',
            $identity['type'], $subject_key, $since, $reservation_cutoff
        ));
        return ['limit' => $limit, 'used' => $used, 'remaining' => max(0, $limit - $used)];
    }

    private static function quota_payload($identity)
    {
        $quota = self::quota($identity);
        return array_merge($quota, [
            'authenticated' => (bool) $identity['user_id'], 'guestToken' => $identity['token'],
            'resetAt' => $identity['user_id'] ? self::registered_reset_window(self::settings())['resetAt'] : null,
        ]);
    }

    private static function registered_reset_window($settings)
    {
        $hour = max(0, min(23, (int) ($settings['daily_reset_hour_utc'] ?? 0)));
        $today_reset = gmmktime($hour, 0, 0, (int) gmdate('n'), (int) gmdate('j'), (int) gmdate('Y'));
        $since = time() >= $today_reset ? $today_reset : $today_reset - DAY_IN_SECONDS;
        return [
            'since' => gmdate('Y-m-d H:i:s', $since),
            'resetAt' => gmdate('c', $since + DAY_IN_SECONDS),
        ];
    }

    private static function owned_project($public_id, $identity)
    {
        global $wpdb;
        $project = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table('design_projects') . ' WHERE public_id=%s', sanitize_text_field($public_id)), ARRAY_A);
        if (!$project) return new WP_Error('c767_project_not_found', 'Design project not found.', ['status' => 404]);
        $owned = $identity['user_id'] ? (int) $project['owner_user_id'] === (int) $identity['user_id'] : hash_equals((string) $project['guest_session_key'], (string) $identity['session_key']);
        if (!$owned) return new WP_Error('c767_project_forbidden', 'This design project belongs to another customer.', ['status' => 403]);
        return $project;
    }

    private static function reserved_cost($request_id)
    {
        global $wpdb;
        return max(0, (int) $wpdb->get_var($wpdb->prepare('SELECT credit_cost FROM ' . self::table('ai_usage') . ' WHERE request_id=%s', $request_id)));
    }

    private static function has_entitlement($user_id, $project_id, $file_type)
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare('SELECT file_types FROM ' . self::table('design_entitlements') . ' WHERE user_id=%d AND project_id=%d AND status=\'active\'', $user_id, $project_id), ARRAY_A);
        foreach ($rows as $row) if (in_array($file_type, (array) json_decode($row['file_types'], true), true)) return true;
        return false;
    }

    private static function project_download_state($identity, $project)
    {
        global $wpdb;
        $unlocked = false;
        if (!empty($identity['user_id'])) {
            $unlocked = (bool) $wpdb->get_var($wpdb->prepare(
                'SELECT COUNT(*) FROM ' . self::table('design_entitlements') . ' WHERE user_id=%d AND project_id=%d AND status=\'active\'',
                (int) $identity['user_id'], (int) $project['id']
            ));
        }
        $files = $wpdb->get_results($wpdb->prepare(
            'SELECT id, file_type, original_name, mime_type, byte_size, created_at FROM ' . self::table('design_files') . ' WHERE project_id=%d ORDER BY id DESC',
            (int) $project['id']
        ), ARRAY_A);
        return ['downloadUnlocked' => $unlocked, 'projectFiles' => $files ?: []];
    }

    private static function private_directory()
    {
        return defined('C767_PRIVATE_DESIGN_DIR') && C767_PRIVATE_DESIGN_DIR
            ? rtrim((string) C767_PRIVATE_DESIGN_DIR, '/\\')
            : dirname(ABSPATH) . DIRECTORY_SEPARATOR . 'connect767-private-designs';
    }

    private static function ensure_private_directory()
    {
        $dir = self::private_directory();
        if (!is_dir($dir) && !wp_mkdir_p($dir)) return new WP_Error('c767_private_storage', 'Private design storage is not writable.', ['status' => 500]);
        @file_put_contents(trailingslashit($dir) . 'index.php', "<?php\nhttp_response_code(404);\nexit;\n", LOCK_EX);
        @file_put_contents(trailingslashit($dir) . '.htaccess', "Deny from all\n", LOCK_EX);
        @file_put_contents(trailingslashit($dir) . 'web.config', '<?xml version="1.0"?><configuration><system.webServer><authorization><deny users="*" /></authorization></system.webServer></configuration>', LOCK_EX);
        return $dir;
    }

    private static function watermarked_preview($bytes, $mime)
    {
        if (!function_exists('imagecreatefromstring')) return new WP_Error('c767_preview_engine', 'The server image library is unavailable.', ['status' => 500]);
        $source = @imagecreatefromstring($bytes);
        if (!$source) return new WP_Error('c767_preview_invalid', 'The preview could not be prepared.', ['status' => 500]);
        $max = (int) self::settings()['preview_max_width'];
        $width = imagesx($source); $height = imagesy($source);
        $scale = min(1, $max / max(1, $width));
        $target = imagecreatetruecolor(max(1, (int) round($width * $scale)), max(1, (int) round($height * $scale)));
        imagealphablending($target, false); imagesavealpha($target, true);
        $transparent = imagecolorallocatealpha($target, 255, 255, 255, 127); imagefill($target, 0, 0, $transparent);
        imagecopyresampled($target, $source, 0, 0, 0, 0, imagesx($target), imagesy($target), $width, $height);
        imagealphablending($target, true);
        $opacity = (int) self::settings()['watermark_opacity'];
        $color = imagecolorallocatealpha($target, 40, 55, 47, max(45, 127 - (int) round($opacity * 1.27)));
        $label = (string) self::settings()['watermark_text'];
        for ($y = 40; $y < imagesy($target); $y += 130) {
            for ($x = ($y / 130) % 2 ? 20 : 100; $x < imagesx($target); $x += 360) imagestring($target, 3, (int) $x, (int) $y, $label, $color);
        }
        ob_start(); imagepng($target, null, 7); $preview = ob_get_clean();
        imagedestroy($source); imagedestroy($target);
        return ['bytes' => $preview, 'mimeType' => 'image/png'];
    }

    private static function sign_payload(array $payload)
    {
        $body = rtrim(strtr(base64_encode(wp_json_encode($payload)), '+/', '-_'), '=');
        $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, C767_JWT::secret(), true)), '+/', '-_'), '=');
        return $body . '.' . $signature;
    }

    private static function verify_payload($token)
    {
        $parts = explode('.', (string) $token);
        if (count($parts) !== 2) return new WP_Error('c767_signed_token', 'Invalid signed token.', ['status' => 401]);
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $parts[0], C767_JWT::secret(), true)), '+/', '-_'), '=');
        if (!hash_equals($expected, $parts[1])) return new WP_Error('c767_signed_token', 'Invalid signed token.', ['status' => 401]);
        $encoded = strtr($parts[0], '-_', '+/');
        $encoded .= str_repeat('=', (4 - strlen($encoded) % 4) % 4);
        $body = base64_decode($encoded, true);
        if ($body === false) return new WP_Error('c767_signed_token', 'Invalid signed token.', ['status' => 401]);
        $payload = json_decode($body, true);
        if (!is_array($payload) || empty($payload['exp']) || time() > (int) $payload['exp']) return new WP_Error('c767_signed_token_expired', 'Signed token expired.', ['status' => 401]);
        return $payload;
    }

    private static function request_hash($kind)
    {
        $value = $kind === 'ua' ? (string) ($_SERVER['HTTP_USER_AGENT'] ?? '') : (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        return hash_hmac('sha256', $value, C767_JWT::secret());
    }

    private static function table($suffix)
    {
        global $wpdb;
        return $wpdb->prefix . 'c767_' . $suffix;
    }
}
