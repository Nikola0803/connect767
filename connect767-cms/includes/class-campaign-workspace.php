<?php
/**
 * Campaign execution workspace for approved Connect767 marketing strategies.
 *
 * Workspaces turn approved recommendations into accountable tasks and UTM
 * links. They never publish content, contact people, or spend money.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Campaign_Workspace
{
    const DB_VERSION = '1.0.0';
    const DB_OPTION = 'c767_campaign_workspace_db_version';

    public static function init()
    {
        self::maybe_install();
        add_action('admin_post_c767_create_campaign_workspace', [__CLASS__, 'create_workspace']);
        add_action('admin_post_c767_update_campaign_workspace', [__CLASS__, 'update_workspace']);
        add_action('admin_post_c767_update_campaign_task', [__CLASS__, 'update_task']);
        add_action('admin_post_c767_add_campaign_task', [__CLASS__, 'add_task']);
        add_action('admin_post_c767_export_campaign_workspace', [__CLASS__, 'export_workspace']);
        add_action('c767_marketing_strategy_actions', [__CLASS__, 'render_strategy_action'], 10, 2);
        add_action('c767_marketing_growth_after_dashboard', [__CLASS__, 'render'], 20, 3);
    }

    private static function campaigns_table()
    {
        global $wpdb;
        return $wpdb->prefix . 'c767_campaign_workspaces';
    }

    private static function tasks_table()
    {
        global $wpdb;
        return $wpdb->prefix . 'c767_campaign_tasks';
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
        $campaigns = self::campaigns_table();
        $tasks = self::tasks_table();
        $charset = $wpdb->get_charset_collate();

        dbDelta("CREATE TABLE $campaigns (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            strategy_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(190) NOT NULL,
            objective VARCHAR(48) NOT NULL DEFAULT '',
            region VARCHAR(160) NOT NULL DEFAULT '',
            status VARCHAR(24) NOT NULL DEFAULT 'planning',
            owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            start_date DATE NULL,
            end_date DATE NULL,
            base_url TEXT NOT NULL,
            utm_source VARCHAR(100) NOT NULL DEFAULT '',
            utm_medium VARCHAR(100) NOT NULL DEFAULT '',
            utm_campaign VARCHAR(160) NOT NULL DEFAULT '',
            budget_cap DECIMAL(12,2) NOT NULL DEFAULT 0,
            notes LONGTEXT NOT NULL,
            created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY strategy_id (strategy_id),
            KEY status_updated (status, updated_at)
        ) $charset;");

        dbDelta("CREATE TABLE $tasks (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            campaign_id BIGINT UNSIGNED NOT NULL,
            recommendation_index INT UNSIGNED NOT NULL DEFAULT 0,
            title VARCHAR(240) NOT NULL,
            description LONGTEXT NOT NULL,
            channel VARCHAR(32) NOT NULL DEFAULT 'planning',
            status VARCHAR(24) NOT NULL DEFAULT 'not_started',
            owner_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            due_date DATE NULL,
            measurement TEXT NOT NULL,
            sort_order INT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY campaign_sort (campaign_id, sort_order),
            KEY status_due (status, due_date)
        ) $charset;");

        update_option(self::DB_OPTION, self::DB_VERSION, false);
    }

    private static function redirect($notice = '', $campaign_id = 0)
    {
        $args = ['page' => 'connect767-marketing-growth'];
        if ($notice) {
            $args['campaign_notice'] = sanitize_key($notice);
        }
        if ($campaign_id) {
            $args['campaign_id'] = absint($campaign_id);
        }
        wp_safe_redirect(add_query_arg($args, admin_url('admin.php')) . '#c767-campaign-workspace');
        exit;
    }

    private static function strategy($id)
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . C767_Marketing_Strategy::table() . ' WHERE id = %d',
            absint($id)
        ), ARRAY_A);
    }

    private static function campaign($id)
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::campaigns_table() . ' WHERE id = %d',
            absint($id)
        ), ARRAY_A);
    }

    private static function campaign_for_strategy($strategy_id)
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::campaigns_table() . ' WHERE strategy_id = %d',
            absint($strategy_id)
        ), ARRAY_A);
    }

    private static function infer_channel($item)
    {
        $text = strtolower(implode(' ', [
            (string) ($item['action'] ?? ''),
            (string) ($item['why'] ?? ''),
        ]));
        if (strpos($text, 'email') !== false || strpos($text, 'reminder') !== false || strpos($text, 'newsletter') !== false) {
            return 'email';
        }
        if (strpos($text, 'community') !== false || strpos($text, 'roundup') !== false) {
            return 'community';
        }
        if (strpos($text, 'social') !== false || strpos($text, 'discovery post') !== false || strpos($text, 'diaspora') !== false) {
            return 'social';
        }
        if (strpos($text, 'landing') !== false || strpos($text, 'registration') !== false || strpos($text, 'profile') !== false) {
            return 'website';
        }
        if (strpos($text, 'utm') !== false || strpos($text, 'measure') !== false || strpos($text, 'tracking') !== false) {
            return 'analytics';
        }
        return 'planning';
    }

    public static function create_workspace()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to create campaign workspaces.', 'connect767-cms'));
        }
        $strategy_id = isset($_POST['strategy_id']) ? absint(wp_unslash($_POST['strategy_id'])) : 0;
        check_admin_referer('c767_create_campaign_workspace_' . $strategy_id);
        $strategy_row = self::strategy($strategy_id);
        if (!$strategy_row || $strategy_row['status'] !== 'approved') {
            self::redirect('strategy_not_approved');
        }
        $existing = self::campaign_for_strategy($strategy_id);
        if ($existing) {
            self::redirect('workspace_exists', $existing['id']);
        }

        $strategy = json_decode($strategy_row['strategy_json'], true);
        if (!is_array($strategy)) {
            self::redirect('workspace_failed');
        }

        global $wpdb;
        $now = current_time('mysql', true);
        $name = sanitize_text_field((string) ($strategy['title'] ?? 'Campaign workspace'));
        $utm_campaign = sanitize_title($name);
        $created = $wpdb->insert(self::campaigns_table(), [
            'strategy_id' => $strategy_id,
            'name' => substr($name, 0, 190),
            'objective' => sanitize_key($strategy_row['objective']),
            'region' => substr(sanitize_text_field($strategy_row['region']), 0, 160),
            'status' => 'planning',
            'owner_id' => get_current_user_id(),
            'start_date' => null,
            'end_date' => null,
            'base_url' => '',
            'utm_source' => '',
            'utm_medium' => '',
            'utm_campaign' => substr($utm_campaign ?: 'connect767-campaign', 0, 160),
            'budget_cap' => 0,
            'notes' => 'Created from approved strategy. Publishing, outreach, and spending require separate administrator action.',
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        if (!$created) {
            self::redirect('workspace_failed');
        }
        $campaign_id = (int) $wpdb->insert_id;
        foreach ((array) ($strategy['recommendations'] ?? []) as $index => $item) {
            if (!is_array($item) || empty($item['action'])) {
                continue;
            }
            $description = '';
            if (!empty($item['evidence'])) {
                $description = 'Evidence: ' . (string) $item['evidence'];
            }
            if (!empty($item['why'])) {
                $description .= ($description ? "\n\n" : '') . 'Execution guidance: ' . (string) $item['why'];
            }
            if (!empty($item['benefit'])) {
                $description .= ($description ? "\n\n" : '') . 'Expected benefit: ' . (string) $item['benefit'];
            }
            if (!empty($item['effort'])) {
                $description .= ($description ? "\n\n" : '') . 'Estimated effort: ' . (string) $item['effort'];
            }
            $wpdb->insert(self::tasks_table(), [
                'campaign_id' => $campaign_id,
                'recommendation_index' => (int) $index,
                'title' => substr(sanitize_text_field($item['action']), 0, 240),
                'description' => sanitize_textarea_field($description),
                'channel' => self::infer_channel($item),
                'status' => 'not_started',
                'owner_id' => 0,
                'due_date' => null,
                'measurement' => sanitize_textarea_field((string) ($item['measurement'] ?? '')),
                'sort_order' => (int) $index,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        self::redirect('workspace_created', $campaign_id);
    }

    private static function valid_date($value)
    {
        $value = sanitize_text_field((string) $value);
        if ($value === '') {
            return null;
        }
        $date = DateTime::createFromFormat('Y-m-d', $value);
        return $date && $date->format('Y-m-d') === $value ? $value : null;
    }

    public static function update_workspace()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to update campaign workspaces.', 'connect767-cms'));
        }
        $id = isset($_POST['campaign_id']) ? absint(wp_unslash($_POST['campaign_id'])) : 0;
        check_admin_referer('c767_update_campaign_workspace_' . $id);
        if (!$id || !self::campaign($id)) {
            self::redirect('workspace_failed');
        }
        $statuses = ['planning', 'approved', 'active', 'paused', 'completed', 'archived'];
        $status = sanitize_key(isset($_POST['campaign_status']) ? wp_unslash($_POST['campaign_status']) : 'planning');
        $status = in_array($status, $statuses, true) ? $status : 'planning';
        $name = substr(sanitize_text_field(isset($_POST['campaign_name']) ? wp_unslash($_POST['campaign_name']) : ''), 0, 190);
        $base_url = esc_url_raw(isset($_POST['base_url']) ? wp_unslash($_POST['base_url']) : '');
        $budget = isset($_POST['budget_cap']) ? max(0, (float) wp_unslash($_POST['budget_cap'])) : 0;
        global $wpdb;
        $updated = $wpdb->update(self::campaigns_table(), [
            'name' => $name ?: 'Campaign workspace',
            'status' => $status,
            'owner_id' => isset($_POST['owner_id']) ? absint(wp_unslash($_POST['owner_id'])) : 0,
            'start_date' => self::valid_date(isset($_POST['start_date']) ? wp_unslash($_POST['start_date']) : ''),
            'end_date' => self::valid_date(isset($_POST['end_date']) ? wp_unslash($_POST['end_date']) : ''),
            'base_url' => $base_url,
            'utm_source' => substr(sanitize_title(isset($_POST['utm_source']) ? wp_unslash($_POST['utm_source']) : ''), 0, 100),
            'utm_medium' => substr(sanitize_title(isset($_POST['utm_medium']) ? wp_unslash($_POST['utm_medium']) : ''), 0, 100),
            'utm_campaign' => substr(sanitize_title(isset($_POST['utm_campaign']) ? wp_unslash($_POST['utm_campaign']) : ''), 0, 160),
            'budget_cap' => $budget,
            'notes' => substr(sanitize_textarea_field(isset($_POST['notes']) ? wp_unslash($_POST['notes']) : ''), 0, 4000),
            'updated_at' => current_time('mysql', true),
        ], ['id' => $id], ['%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%f', '%s', '%s'], ['%d']);
        self::redirect($updated === false ? 'workspace_failed' : 'workspace_updated', $id);
    }

    public static function update_task()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to update campaign tasks.', 'connect767-cms'));
        }
        $id = isset($_POST['task_id']) ? absint(wp_unslash($_POST['task_id'])) : 0;
        $campaign_id = isset($_POST['campaign_id']) ? absint(wp_unslash($_POST['campaign_id'])) : 0;
        check_admin_referer('c767_update_campaign_task_' . $id);
        $statuses = ['not_started', 'ready', 'in_progress', 'blocked', 'complete'];
        $channels = ['planning', 'website', 'email', 'community', 'social', 'partner', 'analytics', 'paid'];
        $status = sanitize_key(isset($_POST['task_status']) ? wp_unslash($_POST['task_status']) : 'not_started');
        $channel = sanitize_key(isset($_POST['channel']) ? wp_unslash($_POST['channel']) : 'planning');
        $status = in_array($status, $statuses, true) ? $status : 'not_started';
        $channel = in_array($channel, $channels, true) ? $channel : 'planning';
        global $wpdb;
        $updated = $wpdb->update(self::tasks_table(), [
            'status' => $status,
            'channel' => $channel,
            'owner_id' => isset($_POST['owner_id']) ? absint(wp_unslash($_POST['owner_id'])) : 0,
            'due_date' => self::valid_date(isset($_POST['due_date']) ? wp_unslash($_POST['due_date']) : ''),
            'updated_at' => current_time('mysql', true),
        ], ['id' => $id, 'campaign_id' => $campaign_id], ['%s', '%s', '%d', '%s', '%s'], ['%d', '%d']);
        self::redirect($updated === false ? 'task_failed' : 'task_updated', $campaign_id);
    }

    public static function add_task()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to add campaign tasks.', 'connect767-cms'));
        }
        $campaign_id = isset($_POST['campaign_id']) ? absint(wp_unslash($_POST['campaign_id'])) : 0;
        check_admin_referer('c767_add_campaign_task_' . $campaign_id);
        if (!$campaign_id || !self::campaign($campaign_id)) {
            self::redirect('task_failed');
        }
        $title = substr(sanitize_text_field(isset($_POST['task_title']) ? wp_unslash($_POST['task_title']) : ''), 0, 240);
        if (!$title) {
            self::redirect('task_failed', $campaign_id);
        }
        global $wpdb;
        $sort = (int) $wpdb->get_var($wpdb->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM ' . self::tasks_table() . ' WHERE campaign_id = %d', $campaign_id));
        $created = $wpdb->insert(self::tasks_table(), [
            'campaign_id' => $campaign_id,
            'recommendation_index' => 0,
            'title' => $title,
            'description' => substr(sanitize_textarea_field(isset($_POST['task_description']) ? wp_unslash($_POST['task_description']) : ''), 0, 2000),
            'channel' => 'planning',
            'status' => 'not_started',
            'owner_id' => 0,
            'due_date' => null,
            'measurement' => '',
            'sort_order' => $sort,
            'created_at' => current_time('mysql', true),
            'updated_at' => current_time('mysql', true),
        ]);
        self::redirect($created ? 'task_added' : 'task_failed', $campaign_id);
    }

    public static function render_strategy_action($row, $strategy)
    {
        if (!current_user_can('manage_options') || empty($row['id'])) {
            return;
        }
        $campaign = self::campaign_for_strategy($row['id']);
        if ($campaign) {
            $url = add_query_arg(['page' => 'connect767-marketing-growth', 'campaign_id' => $campaign['id']], admin_url('admin.php')) . '#c767-campaign-workspace';
            echo '<p class="c767-workspace-strategy-action"><a class="button" href="' . esc_url($url) . '">Open campaign workspace</a></p>';
            return;
        }
        if (($row['status'] ?? '') !== 'approved') {
            return;
        }
        ?>
        <form class="c767-workspace-strategy-action" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="c767_create_campaign_workspace">
            <input type="hidden" name="strategy_id" value="<?php echo esc_attr($row['id']); ?>">
            <?php wp_nonce_field('c767_create_campaign_workspace_' . $row['id']); ?>
            <button class="button button-primary" type="submit">Create campaign workspace</button>
            <span class="description">Creates tasks only. Nothing is published, sent, or purchased.</span>
        </form>
        <?php
    }

    private static function users()
    {
        return get_users([
            'role__in' => ['administrator', 'editor'],
            'orderby' => 'display_name',
            'order' => 'ASC',
            'fields' => ['ID', 'display_name'],
        ]);
    }

    private static function owner_options($users, $selected)
    {
        echo '<option value="0">Unassigned</option>';
        foreach ($users as $user) {
            echo '<option value="' . esc_attr($user->ID) . '" ' . selected((int) $selected, (int) $user->ID, false) . '>' . esc_html($user->display_name) . '</option>';
        }
    }

    private static function utm_url($campaign)
    {
        if (empty($campaign['base_url'])) {
            return '';
        }
        $args = [];
        foreach (['utm_source', 'utm_medium', 'utm_campaign'] as $key) {
            if (!empty($campaign[$key])) {
                $args[$key] = $campaign[$key];
            }
        }
        return $args ? add_query_arg($args, $campaign['base_url']) : $campaign['base_url'];
    }

    private static function notice()
    {
        $key = isset($_GET['campaign_notice']) ? sanitize_key(wp_unslash($_GET['campaign_notice'])) : '';
        $messages = [
            'workspace_created' => ['success', 'Campaign workspace created from the approved strategy.'],
            'workspace_updated' => ['success', 'Campaign workspace updated.'],
            'workspace_exists' => ['info', 'This strategy already has a campaign workspace.'],
            'strategy_not_approved' => ['error', 'Approve the strategy before creating a campaign workspace.'],
            'workspace_failed' => ['error', 'The campaign workspace could not be saved.'],
            'task_updated' => ['success', 'Campaign task updated.'],
            'task_added' => ['success', 'Campaign task added.'],
            'task_failed' => ['error', 'The campaign task could not be saved.'],
        ];
        if (!$key || !isset($messages[$key])) {
            return;
        }
        echo '<div class="notice notice-' . esc_attr($messages[$key][0]) . ' inline"><p>' . esc_html($messages[$key][1]) . '</p></div>';
    }

    public static function render($range, $metrics, $rows)
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        global $wpdb;
        $campaigns = $wpdb->get_results('SELECT * FROM ' . self::campaigns_table() . " WHERE status <> 'archived' ORDER BY updated_at DESC LIMIT 20", ARRAY_A);
        $selected_id = isset($_GET['campaign_id']) ? absint(wp_unslash($_GET['campaign_id'])) : 0;
        $selected = null;
        foreach ($campaigns as $campaign) {
            if ($selected_id && (int) $campaign['id'] === $selected_id) {
                $selected = $campaign;
                break;
            }
        }
        if (!$selected && $campaigns) {
            $selected = $campaigns[0];
        }
        $tasks = $selected ? $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::tasks_table() . ' WHERE campaign_id = %d ORDER BY sort_order ASC, id ASC', $selected['id']), ARRAY_A) : [];
        $users = self::users();
        $completed = 0;
        foreach ($tasks as $task) {
            if ($task['status'] === 'complete') {
                $completed++;
            }
        }
        $progress = $tasks ? round(($completed / count($tasks)) * 100) : 0;
        ?>
        <section id="c767-campaign-workspace" class="c767-campaign-workspace">
            <div class="c767-workspace-heading">
                <div><span class="c767-strategy-kicker">Manual execution</span><h2>Campaign Workspace</h2><p>Turn approved recommendations into owned, measured tasks. Nothing here publishes content, contacts people, or spends money automatically.</p></div>
                <?php if ($selected) : ?><span class="c767-workspace-progress"><?php echo esc_html($progress); ?>% complete</span><?php endif; ?>
            </div>
            <?php self::notice(); ?>
            <?php if (!$campaigns) : ?>
                <div class="c767-workspace-empty"><h3>No campaign workspace yet</h3><p>Approve an AI-assisted strategy, then select <strong>Create campaign workspace</strong> on its strategy card.</p></div>
            <?php else : ?>
                <nav class="c767-workspace-tabs" aria-label="Campaign workspaces">
                    <?php foreach ($campaigns as $campaign) : $url = add_query_arg(['page' => 'connect767-marketing-growth', 'campaign_id' => $campaign['id']], admin_url('admin.php')) . '#c767-campaign-workspace'; ?>
                        <a class="<?php echo $selected && (int) $selected['id'] === (int) $campaign['id'] ? 'is-active' : ''; ?>" href="<?php echo esc_url($url); ?>"><b><?php echo esc_html($campaign['name']); ?></b><span><?php echo esc_html(ucwords(str_replace('_', ' ', $campaign['status']))); ?></span></a>
                    <?php endforeach; ?>
                </nav>
                <?php if ($selected) : $utm_url = self::utm_url($selected); ?>
                    <form class="c767-workspace-settings" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <input type="hidden" name="action" value="c767_update_campaign_workspace"><input type="hidden" name="campaign_id" value="<?php echo esc_attr($selected['id']); ?>"><?php wp_nonce_field('c767_update_campaign_workspace_' . $selected['id']); ?>
                        <label class="is-wide"><span>Campaign name</span><input name="campaign_name" maxlength="190" value="<?php echo esc_attr($selected['name']); ?>" required></label>
                        <label><span>Status</span><select name="campaign_status"><?php foreach (['planning', 'approved', 'active', 'paused', 'completed', 'archived'] as $status) : ?><option value="<?php echo esc_attr($status); ?>" <?php selected($selected['status'], $status); ?>><?php echo esc_html(ucwords(str_replace('_', ' ', $status))); ?></option><?php endforeach; ?></select></label>
                        <label><span>Campaign owner</span><select name="owner_id"><?php self::owner_options($users, $selected['owner_id']); ?></select></label>
                        <label><span>Start date</span><input type="date" name="start_date" value="<?php echo esc_attr($selected['start_date']); ?>"></label>
                        <label><span>End date</span><input type="date" name="end_date" value="<?php echo esc_attr($selected['end_date']); ?>"></label>
                        <label><span>Budget cap (USD)</span><input type="number" min="0" step="0.01" name="budget_cap" value="<?php echo esc_attr($selected['budget_cap']); ?>"><small>Planning limit only; no spending occurs here.</small></label>
                        <label class="is-wide"><span>Destination URL</span><input type="url" name="base_url" placeholder="https://connect767.com/directory" value="<?php echo esc_attr($selected['base_url']); ?>"></label>
                        <label><span>UTM source</span><input name="utm_source" placeholder="facebook" value="<?php echo esc_attr($selected['utm_source']); ?>"></label>
                        <label><span>UTM medium</span><input name="utm_medium" placeholder="organic-social" value="<?php echo esc_attr($selected['utm_medium']); ?>"></label>
                        <label><span>UTM campaign</span><input name="utm_campaign" value="<?php echo esc_attr($selected['utm_campaign']); ?>"></label>
                        <label class="is-wide"><span>Execution notes</span><textarea name="notes" rows="3" maxlength="4000"><?php echo esc_textarea($selected['notes']); ?></textarea></label>
                        <?php if ($utm_url) : ?><div class="is-wide c767-utm-preview"><span>Tracked campaign link</span><input type="text" readonly value="<?php echo esc_attr($utm_url); ?>" aria-label="Tracked campaign link"><button class="button c767-copy-utm" type="button">Copy link</button></div><?php endif; ?>
                        <div class="is-wide c767-workspace-save"><button class="button button-primary" type="submit">Save campaign workspace</button><a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=c767_export_campaign_workspace&campaign_id=' . absint($selected['id'])), 'c767_export_campaign_workspace_' . absint($selected['id']))); ?>">Export plan CSV</a><span class="description">Approved/active status records authorization only. External execution remains manual.</span></div>
                    </form>

                    <div class="c767-workspace-task-head"><div><h3>Execution tasks</h3><p><?php echo esc_html($completed . ' of ' . count($tasks) . ' completed'); ?></p></div><progress max="100" value="<?php echo esc_attr($progress); ?>"><?php echo esc_html($progress); ?>%</progress></div>
                    <div class="c767-workspace-tasks">
                        <?php foreach ($tasks as $task) : ?>
                            <form class="c767-workspace-task <?php echo $task['status'] === 'complete' ? 'is-complete' : ''; ?>" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                <input type="hidden" name="action" value="c767_update_campaign_task"><input type="hidden" name="campaign_id" value="<?php echo esc_attr($selected['id']); ?>"><input type="hidden" name="task_id" value="<?php echo esc_attr($task['id']); ?>"><?php wp_nonce_field('c767_update_campaign_task_' . $task['id']); ?>
                                <header><div><span class="c767-task-channel"><?php echo esc_html(ucfirst($task['channel'])); ?></span><h4><?php echo esc_html($task['title']); ?></h4></div><button class="button button-small" type="submit">Update</button></header>
                                <?php if ($task['description']) : ?><p><?php echo nl2br(esc_html($task['description'])); ?></p><?php endif; ?>
                                <?php if ($task['measurement']) : ?><p class="c767-task-measure"><strong>Measure:</strong> <?php echo esc_html($task['measurement']); ?></p><?php endif; ?>
                                <div class="c767-task-fields">
                                    <label><span>Status</span><select name="task_status"><?php foreach (['not_started', 'ready', 'in_progress', 'blocked', 'complete'] as $status) : ?><option value="<?php echo esc_attr($status); ?>" <?php selected($task['status'], $status); ?>><?php echo esc_html(ucwords(str_replace('_', ' ', $status))); ?></option><?php endforeach; ?></select></label>
                                    <label><span>Channel</span><select name="channel"><?php foreach (['planning', 'website', 'email', 'community', 'social', 'partner', 'analytics', 'paid'] as $channel) : ?><option value="<?php echo esc_attr($channel); ?>" <?php selected($task['channel'], $channel); ?>><?php echo esc_html(ucfirst($channel)); ?></option><?php endforeach; ?></select></label>
                                    <label><span>Owner</span><select name="owner_id"><?php self::owner_options($users, $task['owner_id']); ?></select></label>
                                    <label><span>Due date</span><input type="date" name="due_date" value="<?php echo esc_attr($task['due_date']); ?>"></label>
                                </div>
                            </form>
                        <?php endforeach; ?>
                    </div>
                    <details class="c767-add-task"><summary>Add a manual task</summary><form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>"><input type="hidden" name="action" value="c767_add_campaign_task"><input type="hidden" name="campaign_id" value="<?php echo esc_attr($selected['id']); ?>"><?php wp_nonce_field('c767_add_campaign_task_' . $selected['id']); ?><input name="task_title" maxlength="240" placeholder="Task title" required><textarea name="task_description" maxlength="2000" rows="2" placeholder="Instructions or approval requirements"></textarea><button class="button" type="submit">Add task</button></form></details>
                <?php endif; ?>
            <?php endif; ?>
        </section>
        <style>
            .c767-workspace-strategy-action{display:flex;align-items:center;gap:10px;margin:12px 0 0}.c767-campaign-workspace{margin:28px 0;padding:22px;background:#fff;border:1px solid #dcdcde;border-radius:12px}.c767-workspace-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.c767-workspace-heading h2{margin:4px 0 8px;font-size:24px}.c767-workspace-heading p{margin:0;max-width:760px;color:#50575e}.c767-workspace-progress{padding:7px 11px;border-radius:999px;background:#dff6e8;color:#075c31;font-weight:700}.c767-workspace-empty{margin-top:18px;padding:22px;border:1px dashed #b8c0c7;border-radius:10px;background:#f6f7f7}.c767-workspace-tabs{display:flex;gap:8px;overflow:auto;margin:20px 0}.c767-workspace-tabs a{min-width:200px;padding:11px 13px;border:1px solid #dcdcde;border-radius:8px;text-decoration:none;background:#f6f7f7;color:#1d2327}.c767-workspace-tabs a.is-active{border-color:#0c5d37;background:#edf8f2}.c767-workspace-tabs span{display:block;margin-top:4px;color:#646970;font-size:11px}.c767-workspace-settings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;padding:18px;border:1px solid #dcdcde;border-radius:10px;background:#f9f9f9}.c767-workspace-settings label{display:flex;flex-direction:column;gap:5px;font-weight:600}.c767-workspace-settings input,.c767-workspace-settings select,.c767-workspace-settings textarea{width:100%;max-width:none}.c767-workspace-settings small{font-weight:400;color:#646970}.c767-workspace-settings .is-wide{grid-column:1/-1}.c767-utm-preview{display:grid;grid-template-columns:1fr auto;gap:7px}.c767-utm-preview span{grid-column:1/-1;font-weight:600}.c767-workspace-save{display:flex;align-items:center;gap:9px}.c767-workspace-task-head{display:flex;justify-content:space-between;align-items:center;margin:24px 0 12px}.c767-workspace-task-head h3,.c767-workspace-task-head p{margin:0}.c767-workspace-task-head progress{width:220px}.c767-workspace-tasks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.c767-workspace-task{padding:16px;border:1px solid #dcdcde;border-left:4px solid #2271b1;border-radius:8px;background:#fff}.c767-workspace-task.is-complete{border-left-color:#0c5d37;background:#f3faf6}.c767-workspace-task header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.c767-workspace-task h4{margin:5px 0 0;font-size:15px}.c767-workspace-task p{color:#50575e}.c767-task-channel{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0c5d37}.c767-task-measure{padding-top:8px;border-top:1px solid #e2e4e7}.c767-task-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.c767-task-fields label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600}.c767-task-fields select,.c767-task-fields input{width:100%}.c767-add-task{margin-top:14px;padding:14px;border:1px solid #dcdcde;border-radius:8px}.c767-add-task summary{cursor:pointer;font-weight:600}.c767-add-task form{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.c767-add-task textarea{grid-column:1/-1}.c767-add-task input,.c767-add-task textarea{width:100%;max-width:none}@media(max-width:1000px){.c767-workspace-settings{grid-template-columns:repeat(2,minmax(0,1fr))}.c767-workspace-tasks{grid-template-columns:1fr}}@media(max-width:782px){.c767-workspace-heading,.c767-workspace-task-head,.c767-workspace-save{display:block}.c767-workspace-progress{display:inline-block;margin-top:12px}.c767-workspace-settings{grid-template-columns:1fr}.c767-workspace-settings .is-wide{grid-column:auto}.c767-workspace-save>*{margin:5px 5px 0 0}.c767-task-fields{grid-template-columns:1fr}.c767-add-task form{grid-template-columns:1fr}.c767-add-task textarea{grid-column:auto}}
        </style>
        <script>
            document.addEventListener('click',function(event){var button=event.target.closest('.c767-copy-utm');if(!button){return;}var input=button.parentNode.querySelector('input');if(!input){return;}input.select();if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(input.value).then(function(){button.textContent='Copied';});}else{document.execCommand('copy');button.textContent='Copied';}});
        </script>
        <?php
    }

    public static function export_workspace()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to export campaign workspaces.', 'connect767-cms'));
        }
        $id = isset($_GET['campaign_id']) ? absint(wp_unslash($_GET['campaign_id'])) : 0;
        check_admin_referer('c767_export_campaign_workspace_' . $id);
        $campaign = self::campaign($id);
        if (!$campaign) {
            self::redirect('workspace_failed');
        }
        global $wpdb;
        $tasks = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::tasks_table() . ' WHERE campaign_id = %d ORDER BY sort_order ASC, id ASC', $id), ARRAY_A);
        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=connect767-campaign-' . absint($id) . '-' . gmdate('Y-m-d') . '.csv');
        $output = fopen('php://output', 'w');
        fputcsv($output, ['Campaign', $campaign['name']]);
        fputcsv($output, ['Status', $campaign['status']]);
        fputcsv($output, ['Region', $campaign['region']]);
        fputcsv($output, ['Budget cap USD', $campaign['budget_cap']]);
        fputcsv($output, ['Tracked URL', self::utm_url($campaign)]);
        fputcsv($output, []);
        fputcsv($output, ['Task', 'Status', 'Channel', 'Owner', 'Due date', 'Measurement']);
        foreach ($tasks as $task) {
            $owner = $task['owner_id'] ? get_userdata($task['owner_id']) : null;
            fputcsv($output, [$task['title'], $task['status'], $task['channel'], $owner ? $owner->display_name : '', $task['due_date'], $task['measurement']]);
        }
        fclose($output);
        exit;
    }
}
