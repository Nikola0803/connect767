<?php
/**
 * Evidence-based AI marketing strategies for Connect767 administrators.
 *
 * Strategies are drafts until an administrator approves them. The module
 * sends aggregate counts only; it never sends user, visitor, or contact data.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Marketing_Strategy
{
    const DB_VERSION = '1.0.0';
    const DB_OPTION = 'c767_marketing_strategy_db_version';
    const OPENAI_URL = 'https://api.openai.com/v1/responses';

    public static function init()
    {
        self::maybe_install();
        add_action('admin_post_c767_generate_marketing_strategy', [__CLASS__, 'generate']);
        add_action('admin_post_c767_update_marketing_strategy', [__CLASS__, 'update_status']);
        add_action('c767_marketing_growth_after_dashboard', [__CLASS__, 'render'], 10, 3);
    }

    public static function table()
    {
        global $wpdb;
        return $wpdb->prefix . 'c767_marketing_strategies';
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
        $table = self::table();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $table (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(190) NOT NULL,
            objective VARCHAR(48) NOT NULL,
            audience VARCHAR(48) NOT NULL,
            region VARCHAR(120) NOT NULL DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            provider VARCHAR(32) NOT NULL DEFAULT 'rules',
            model VARCHAR(80) NOT NULL DEFAULT '',
            input_snapshot LONGTEXT NOT NULL,
            strategy_json LONGTEXT NOT NULL,
            created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
            approved_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY status_created (status, created_at),
            KEY created_by (created_by)
        ) $charset;");
        update_option(self::DB_OPTION, self::DB_VERSION, false);
    }

    private static function api_key()
    {
        if (defined('C767_OPENAI_API_KEY') && C767_OPENAI_API_KEY) {
            return trim((string) C767_OPENAI_API_KEY);
        }
        $value = getenv('OPENAI_API_KEY');
        return $value ? trim((string) $value) : '';
    }

    private static function model()
    {
        if (defined('C767_OPENAI_TEXT_MODEL') && C767_OPENAI_TEXT_MODEL) {
            return sanitize_text_field((string) C767_OPENAI_TEXT_MODEL);
        }
        $value = getenv('OPENAI_TEXT_MODEL');
        return $value ? sanitize_text_field((string) $value) : 'gpt-4.1-mini';
    }

    private static function redirect($notice, $days = 30)
    {
        wp_safe_redirect(add_query_arg([
            'page' => 'connect767-marketing-growth',
            'days' => absint($days),
            'strategy_notice' => sanitize_key($notice),
        ], admin_url('admin.php')));
        exit;
    }

    public static function generate()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to create marketing strategies.', 'connect767-cms'));
        }
        check_admin_referer('c767_generate_marketing_strategy');

        $objectives = ['registrations', 'listing_completion', 'traffic', 'engagement', 'diaspora', 'campaign'];
        $audiences = ['local_businesses', 'local_public', 'diaspora', 'international', 'all'];
        $objective = sanitize_key(isset($_POST['objective']) ? wp_unslash($_POST['objective']) : 'registrations');
        $audience = sanitize_key(isset($_POST['audience']) ? wp_unslash($_POST['audience']) : 'all');
        $objective = in_array($objective, $objectives, true) ? $objective : 'registrations';
        $audience = in_array($audience, $audiences, true) ? $audience : 'all';
        $region = substr(sanitize_text_field(isset($_POST['region']) ? wp_unslash($_POST['region']) : ''), 0, 120);
        $notes = substr(sanitize_textarea_field(isset($_POST['context']) ? wp_unslash($_POST['context']) : ''), 0, 1200);
        $days = isset($_POST['days']) ? absint(wp_unslash($_POST['days'])) : 30;
        $snapshot = C767_Marketing_Growth::strategy_snapshot($days);
        $baseline = self::baseline_strategy($snapshot, $objective, $audience, $region);
        $strategy = $baseline;
        $provider = 'rules';
        $model = '';
        $notice = 'baseline_created';

        if (self::api_key()) {
            $ai = self::request_ai_strategy($snapshot, $objective, $audience, $region, $notes);
            if (!is_wp_error($ai)) {
                $strategy = self::sanitize_strategy($ai, $baseline);
                $provider = 'openai';
                $model = self::model();
                $notice = 'ai_created';
            } else {
                set_transient('c767_strategy_error_' . get_current_user_id(), $ai->get_error_message(), MINUTE_IN_SECONDS * 5);
            }
        }

        global $wpdb;
        $now = current_time('mysql', true);
        $inserted = $wpdb->insert(self::table(), [
            'title' => $strategy['title'],
            'objective' => $objective,
            'audience' => $audience,
            'region' => $region,
            'status' => 'draft',
            'provider' => $provider,
            'model' => $model,
            'input_snapshot' => wp_json_encode($snapshot),
            'strategy_json' => wp_json_encode($strategy),
            'created_by' => get_current_user_id(),
            'approved_by' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ], ['%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s']);

        self::redirect($inserted ? $notice : 'save_failed', $days);
    }

    public static function update_status()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to approve marketing strategies.', 'connect767-cms'));
        }
        $id = isset($_POST['strategy_id']) ? absint(wp_unslash($_POST['strategy_id'])) : 0;
        check_admin_referer('c767_update_marketing_strategy_' . $id);
        $status = sanitize_key(isset($_POST['strategy_status']) ? wp_unslash($_POST['strategy_status']) : 'draft');
        if (!in_array($status, ['draft', 'approved', 'archived'], true) || !$id) {
            self::redirect('invalid_status');
        }

        global $wpdb;
        $updated = $wpdb->update(self::table(), [
            'status' => $status,
            'approved_by' => $status === 'approved' ? get_current_user_id() : 0,
            'updated_at' => current_time('mysql', true),
        ], ['id' => $id], ['%s', '%d', '%s'], ['%d']);
        self::redirect($updated === false ? 'save_failed' : 'status_updated');
    }

    private static function baseline_strategy($snapshot, $objective, $audience, $region)
    {
        $m = $snapshot['metrics'];
        $p = $snapshot['performance'];
        $f = $p['funnel'];
        $registration_rate = $f['registration_started'] > 0 ? round(($f['registration_completed'] / $f['registration_started']) * 100, 1) : 0;
        $listing_rate = $f['listing_started'] > 0 ? round(($f['listing_submitted'] / $f['listing_started']) * 100, 1) : 0;
        $returning_rate = $m['visitors'] > 0 ? round(($m['returning'] / $m['visitors']) * 100, 1) : 0;
        $top_category = !empty($p['categories'][0]['label']) ? $p['categories'][0]['label'] : '';
        $top_source = !empty($p['sources'][0]['label']) ? $p['sources'][0]['label'] : '';
        $audience_label = ucwords(str_replace('_', ' ', $audience));
        $objective_label = ucwords(str_replace('_', ' ', $objective));
        $recommendations = [];

        if ($f['registration_started'] > 0) {
            $recommendations[] = self::recommendation(
                'Improve the registration path',
                $f['registration_started'] . ' registrations started and ' . $f['registration_completed'] . ' completed (' . $registration_rate . '%).',
                $registration_rate < 60 ? 'Reduce friction on the highest-drop-off fields and clarify the listing benefit beside the primary action.' : 'Preserve the current flow and test one focused value proposition at a time.',
                'More completed member and business registrations.',
                'Medium',
                'Registration completion rate over the next 30 days.'
            );
        } else {
            $recommendations[] = self::recommendation(
                'Establish the registration baseline',
                'No registration starts were recorded in this ' . $snapshot['period_days'] . '-day snapshot.',
                'Confirm registration-start tracking, then run one UTM-tagged registration campaign before changing the form.',
                'A trustworthy baseline for conversion decisions.',
                'Low',
                'At least 20 observed registration starts with source attribution.'
            );
        }

        if ($m['profile']['total'] > 0 && $m['profile']['rate'] < 80) {
            $recommendations[] = self::recommendation(
                'Complete more published business profiles',
                $m['profile']['completed'] . ' of ' . $m['profile']['total'] . ' published profiles meet the completion definition (' . $m['profile']['rate'] . '%).',
                'Prioritize owner reminders for missing logo, cover, contact, category, and location fields. Require approval before sending.',
                'Stronger directory quality and more useful listing pages.',
                'Medium',
                'Published profile completion rate reaches 80% or improves by 10 percentage points.'
            );
        } else {
            $recommendations[] = self::recommendation(
                'Protect listing quality',
                $m['profile']['completed'] . ' of ' . $m['profile']['total'] . ' published profiles currently meet the completion definition.',
                'Review incomplete profiles weekly and draft owner reminders without automatically sending them.',
                'Consistent, trustworthy directory content.',
                'Low',
                'Weekly count of completed profiles and profile-completion rate.'
            );
        }

        if ($top_category) {
            $recommendations[] = self::recommendation(
                'Build a measured campaign around ' . $top_category,
                $top_category . ' is the most-viewed recorded directory category in this snapshot.',
                'Draft a local discovery post, diaspora variation, and category landing-page improvement using one shared UTM campaign.',
                'Use demonstrated interest to attract qualified visitors and relevant registrations.',
                'Medium',
                'UTM-attributed category visits, registration starts, and completed listings.'
            );
        } else {
            $recommendations[] = self::recommendation(
                'Create the first category discovery test',
                'No category view leader is available yet.',
                'Select one verified category with complete listings and run a small UTM-tagged discovery campaign.',
                'Reveal which directory topics attract qualified interest.',
                'Low',
                'Category views and registration starts attributed to the test campaign.'
            );
        }

        $recommendations[] = self::recommendation(
            'Increase repeat visits',
            $m['returning'] . ' returning visitors were observed among ' . $m['visitors'] . ' visitors (' . $returning_rate . '%).',
            $returning_rate < 20 ? 'Prepare a weekly community-and-business roundup for consented channels.' : 'Maintain the strongest recurring content and compare engagement by topic.',
            'More repeat discovery and community participation.',
            'Medium',
            'Returning-visitor rate and Community Feed engagement over 30 days.'
        );

        $source_evidence = $top_source
            ? $top_source . ' is the leading recorded traffic source; ' . count($p['campaigns']) . ' UTM campaigns appear in the snapshot.'
            : 'No reliable traffic-source leader or UTM campaign history is available yet.';
        $recommendations[] = self::recommendation(
            'Standardize campaign measurement',
            $source_evidence,
            'Use consistent utm_source, utm_medium, and utm_campaign values on every approved social, email, partner, and diaspora link.',
            'Comparable channel performance without guessing.',
            'Low',
            'Share of campaign visits with complete UTM attribution and registration completion by campaign.'
        );

        return [
            'title' => $objective_label . ' strategy for ' . $audience_label,
            'summary' => 'A draft ' . strtolower($objective_label) . ' plan for ' . strtolower($audience_label) . ($region ? ' focused on ' . $region : '') . '. It uses only the recorded ' . $snapshot['period_days'] . '-day Connect767 snapshot and requires administrator approval before outreach, publishing, or spending.',
            'recommendations' => array_slice($recommendations, 0, 6),
            'guardrails' => [
                'Do not publish, message contacts, or spend advertising budget without administrator approval.',
                'Use only verified listing information and consented contact channels.',
                'Treat expected benefits as hypotheses; measure the stated success metric before scaling.',
            ],
        ];
    }

    private static function recommendation($action, $evidence, $why, $benefit, $effort, $measurement)
    {
        return compact('action', 'evidence', 'why', 'benefit', 'effort', 'measurement');
    }

    private static function request_ai_strategy($snapshot, $objective, $audience, $region, $notes)
    {
        $provider_snapshot = $snapshot;
        // Listing names are useful in the private dashboard but unnecessary
        // for strategic reasoning. Keep only rank and aggregate performance.
        foreach ((array) ($provider_snapshot['performance']['listings'] ?? []) as $index => $listing) {
            $provider_snapshot['performance']['listings'][$index]['label'] = 'Listing rank ' . ($index + 1);
        }
        $system = 'You are the Connect767 marketing strategy assistant. Return JSON only. Use only the aggregate evidence supplied. Never invent analytics, businesses, testimonials, search volume, or results. If data is absent, say so and recommend a measurement step. Every recommendation must include action, evidence, why, benefit, effort (Low/Medium/High), and measurement. Public posting, outreach, or spending always requires administrator approval.';
        $input = [
            'objective' => $objective,
            'audience' => $audience,
            'region' => $region,
            'administrator_context' => $notes,
            'aggregate_snapshot' => $provider_snapshot,
        ];
        $response = wp_remote_post(self::OPENAI_URL, [
            'timeout' => 45,
            'redirection' => 0,
            'headers' => [
                'Authorization' => 'Bearer ' . self::api_key(),
                'Content-Type' => 'application/json',
            ],
            'body' => wp_json_encode([
                'model' => self::model(),
                'input' => [
                    ['role' => 'system', 'content' => [['type' => 'input_text', 'text' => $system]]],
                    ['role' => 'user', 'content' => [['type' => 'input_text', 'text' => wp_json_encode($input)]]],
                ],
                'text' => ['format' => [
                    'type' => 'json_schema',
                    'name' => 'connect767_marketing_strategy',
                    'strict' => true,
                    'schema' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['title', 'summary', 'recommendations', 'guardrails'],
                        'properties' => [
                            'title' => ['type' => 'string'],
                            'summary' => ['type' => 'string'],
                            'recommendations' => [
                                'type' => 'array',
                                'minItems' => 3,
                                'maxItems' => 8,
                                'items' => [
                                    'type' => 'object',
                                    'additionalProperties' => false,
                                    'required' => ['action', 'evidence', 'why', 'benefit', 'effort', 'measurement'],
                                    'properties' => [
                                        'action' => ['type' => 'string'],
                                        'evidence' => ['type' => 'string'],
                                        'why' => ['type' => 'string'],
                                        'benefit' => ['type' => 'string'],
                                        'effort' => ['type' => 'string', 'enum' => ['Low', 'Medium', 'High']],
                                        'measurement' => ['type' => 'string'],
                                    ],
                                ],
                            ],
                            'guardrails' => ['type' => 'array', 'minItems' => 2, 'maxItems' => 6, 'items' => ['type' => 'string']],
                        ],
                    ],
                ]],
                'max_output_tokens' => 2600,
            ]),
        ]);
        if (is_wp_error($response)) {
            return $response;
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($code < 200 || $code >= 300) {
            $message = isset($body['error']['message']) ? $body['error']['message'] : 'The AI provider did not accept the strategy request.';
            return new WP_Error('c767_strategy_ai_error', sanitize_text_field($message));
        }
        $text = '';
        if (!empty($body['output_text'])) {
            $text = $body['output_text'];
        } elseif (!empty($body['output']) && is_array($body['output'])) {
            foreach ($body['output'] as $item) {
                foreach ((array) ($item['content'] ?? []) as $content) {
                    if (($content['type'] ?? '') === 'output_text' && !empty($content['text'])) {
                        $text .= $content['text'];
                    }
                }
            }
        }
        $decoded = json_decode(trim($text), true);
        if (!is_array($decoded)) {
            return new WP_Error('c767_strategy_ai_invalid', 'The AI provider returned an invalid strategy format.');
        }
        return $decoded;
    }

    private static function clean_text($value, $fallback = '', $limit = 900)
    {
        $value = is_scalar($value) ? sanitize_textarea_field((string) $value) : '';
        return substr($value !== '' ? $value : $fallback, 0, $limit);
    }

    private static function sanitize_strategy($strategy, $fallback)
    {
        $clean = [
            'title' => self::clean_text($strategy['title'] ?? '', $fallback['title'], 190),
            'summary' => self::clean_text($strategy['summary'] ?? '', $fallback['summary'], 1400),
            'recommendations' => [],
            'guardrails' => [],
        ];
        foreach ((array) ($strategy['recommendations'] ?? []) as $item) {
            if (!is_array($item) || empty($item['action'])) {
                continue;
            }
            $effort = ucfirst(strtolower(self::clean_text($item['effort'] ?? '', 'Medium', 12)));
            if (!in_array($effort, ['Low', 'Medium', 'High'], true)) {
                $effort = 'Medium';
            }
            $clean['recommendations'][] = [
                'action' => self::clean_text($item['action'], '', 240),
                'evidence' => self::clean_text($item['evidence'] ?? '', 'No supporting measurement was available.', 800),
                'why' => self::clean_text($item['why'] ?? '', '', 900),
                'benefit' => self::clean_text($item['benefit'] ?? '', '', 600),
                'effort' => $effort,
                'measurement' => self::clean_text($item['measurement'] ?? '', '', 600),
            ];
            if (count($clean['recommendations']) >= 8) {
                break;
            }
        }
        if (!$clean['recommendations']) {
            $clean['recommendations'] = $fallback['recommendations'];
        }
        foreach ((array) ($strategy['guardrails'] ?? []) as $guardrail) {
            $value = self::clean_text($guardrail, '', 400);
            if ($value !== '') {
                $clean['guardrails'][] = $value;
            }
        }
        if (!$clean['guardrails']) {
            $clean['guardrails'] = $fallback['guardrails'];
        }
        return $clean;
    }

    private static function notice()
    {
        $notice = isset($_GET['strategy_notice']) ? sanitize_key(wp_unslash($_GET['strategy_notice'])) : '';
        $messages = [
            'ai_created' => ['success', 'AI strategy created as a draft from the current aggregate data.'],
            'baseline_created' => ['warning', 'A data-driven draft was created. Configure the server-side OpenAI key to enable AI enhancement.'],
            'status_updated' => ['success', 'Strategy status updated.'],
            'save_failed' => ['error', 'The strategy could not be saved.'],
            'invalid_status' => ['error', 'The requested strategy status is invalid.'],
        ];
        if (!$notice || !isset($messages[$notice])) {
            return;
        }
        list($type, $message) = $messages[$notice];
        echo '<div class="notice notice-' . esc_attr($type) . ' inline"><p>' . esc_html($message) . '</p></div>';
        if ($notice === 'baseline_created') {
            $error = get_transient('c767_strategy_error_' . get_current_user_id());
            if ($error) {
                echo '<p class="description">AI provider note: ' . esc_html($error) . '</p>';
                delete_transient('c767_strategy_error_' . get_current_user_id());
            }
        }
    }

    public static function render($range, $metrics, $rows)
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        global $wpdb;
        $strategies = $wpdb->get_results('SELECT * FROM ' . self::table() . " WHERE status <> 'archived' ORDER BY created_at DESC LIMIT 10", ARRAY_A);
        $ai_ready = self::api_key() !== '';
        ?>
        <section class="c767-strategy-center">
            <div class="c767-strategy-head">
                <div><span class="c767-strategy-kicker">Evidence-based planning</span><h2>AI Marketing Strategy</h2><p>Create an administrator-reviewed plan from the current aggregate Connect767 data. Nothing is published, sent, or purchased automatically.</p></div>
                <span class="c767-strategy-readiness <?php echo $ai_ready ? 'is-ready' : ''; ?>"><?php echo esc_html($ai_ready ? 'AI ready' : 'Data strategy ready · AI key needed'); ?></span>
            </div>
            <?php self::notice(); ?>
            <form class="c767-strategy-form" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="c767_generate_marketing_strategy">
                <input type="hidden" name="days" value="<?php echo esc_attr($range['days']); ?>">
                <?php wp_nonce_field('c767_generate_marketing_strategy'); ?>
                <label><span>Objective</span><select name="objective"><option value="registrations">Increase registrations</option><option value="listing_completion">Complete business profiles</option><option value="traffic">Grow qualified traffic</option><option value="engagement">Increase repeat engagement</option><option value="diaspora">Reach the Dominican diaspora</option><option value="campaign">Plan a measured campaign</option></select></label>
                <label><span>Audience</span><select name="audience"><option value="all">All priority audiences</option><option value="local_businesses">Dominica businesses</option><option value="local_public">People in Dominica</option><option value="diaspora">Dominican diaspora</option><option value="international">International audience</option></select></label>
                <label><span>Geographic focus</span><input name="region" maxlength="120" placeholder="Dominica, New York, Toronto…"></label>
                <label class="is-wide"><span>Context for this draft <small>(optional · do not enter personal or contact data)</small></span><textarea name="context" rows="2" maxlength="1200" placeholder="Upcoming event, priority category, available channels, or constraints"></textarea></label>
                <div class="is-wide c767-strategy-submit"><p><?php echo $ai_ready ? 'Aggregate counts only will be sent to the configured AI provider.' : 'A rules-based evidence draft will be created until a server-side OpenAI key is configured.'; ?></p><button class="button button-primary" type="submit">Generate draft strategy</button></div>
            </form>

            <div class="c767-strategy-history">
                <h3>Strategy history</h3>
                <?php if (!$strategies) : ?><p class="description">No strategies have been created yet.</p><?php endif; ?>
                <?php foreach ($strategies as $row) : $strategy = json_decode($row['strategy_json'], true); if (!is_array($strategy)) { continue; } ?>
                    <article class="c767-strategy-card">
                        <header><div><span class="c767-status <?php echo $row['status'] === 'approved' ? 'is-live' : ''; ?>"><?php echo esc_html(ucfirst($row['status'])); ?></span><span class="c767-strategy-source"><?php echo esc_html($row['provider'] === 'openai' ? 'AI-assisted' : 'Data-driven baseline'); ?></span><h3><?php echo esc_html($strategy['title']); ?></h3><p><?php echo esc_html($strategy['summary']); ?></p></div><time><?php echo esc_html(mysql2date(get_option('date_format'), $row['created_at'])); ?></time></header>
                        <div class="c767-recommendations">
                            <?php foreach ((array) ($strategy['recommendations'] ?? []) as $index => $item) : ?>
                                <div class="c767-recommendation"><b><?php echo esc_html(($index + 1) . '. ' . ($item['action'] ?? 'Action')); ?></b><p><strong>Evidence:</strong> <?php echo esc_html($item['evidence'] ?? ''); ?></p><p><strong>Action:</strong> <?php echo esc_html($item['why'] ?? ''); ?></p><p><strong>Expected benefit:</strong> <?php echo esc_html($item['benefit'] ?? ''); ?></p><footer><span>Effort: <?php echo esc_html($item['effort'] ?? 'Medium'); ?></span><span>Measure: <?php echo esc_html($item['measurement'] ?? ''); ?></span></footer></div>
                            <?php endforeach; ?>
                        </div>
                        <details><summary>Safety and approval guardrails</summary><ul><?php foreach ((array) ($strategy['guardrails'] ?? []) as $guardrail) : ?><li><?php echo esc_html($guardrail); ?></li><?php endforeach; ?></ul></details>
                        <form class="c767-strategy-actions" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                            <input type="hidden" name="action" value="c767_update_marketing_strategy"><input type="hidden" name="strategy_id" value="<?php echo esc_attr($row['id']); ?>"><?php wp_nonce_field('c767_update_marketing_strategy_' . $row['id']); ?>
                            <?php if ($row['status'] !== 'approved') : ?><button class="button button-primary" name="strategy_status" value="approved">Approve strategy</button><?php else : ?><button class="button" name="strategy_status" value="draft">Return to draft</button><?php endif; ?>
                            <button class="button" name="strategy_status" value="archived">Archive</button>
                        </form>
                    </article>
                <?php endforeach; ?>
            </div>
        </section>
        <style>
            .c767-strategy-center{margin:28px 0;padding:22px;background:#fff;border:1px solid #dcdcde;border-radius:12px}.c767-strategy-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.c767-strategy-head h2{margin:4px 0 8px;font-size:24px}.c767-strategy-head p{margin:0;max-width:780px;color:#50575e}.c767-strategy-kicker{color:#0c5d37;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}.c767-strategy-readiness{flex:none;padding:6px 10px;border-radius:999px;background:#fff3cd;color:#664d03;font-size:12px;font-weight:700}.c767-strategy-readiness.is-ready{background:#dff6e8;color:#075c31}.c767-strategy-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0;padding:18px;background:#f6f7f7;border-radius:10px}.c767-strategy-form label{display:flex;flex-direction:column;gap:6px;font-weight:600}.c767-strategy-form label span small{font-weight:400;color:#646970}.c767-strategy-form input,.c767-strategy-form select,.c767-strategy-form textarea{width:100%;max-width:none}.c767-strategy-form .is-wide{grid-column:1/-1}.c767-strategy-submit{display:flex;justify-content:space-between;align-items:center;gap:16px}.c767-strategy-submit p{margin:0;color:#646970}.c767-strategy-history>h3{font-size:18px}.c767-strategy-card{margin-top:16px;padding:20px;border:1px solid #dcdcde;border-radius:10px}.c767-strategy-card>header{display:flex;justify-content:space-between;gap:20px}.c767-strategy-card>header h3{margin:10px 0 4px;font-size:20px}.c767-strategy-card>header p{margin:0;color:#50575e}.c767-strategy-card time{white-space:nowrap;color:#646970}.c767-strategy-source{margin-left:8px;color:#646970;font-size:12px}.c767-recommendations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.c767-recommendation{padding:15px;background:#f9f9f9;border-left:3px solid #0c5d37;border-radius:6px}.c767-recommendation p{margin:8px 0;color:#3c434a}.c767-recommendation footer{display:flex;flex-direction:column;gap:5px;padding-top:8px;border-top:1px solid #e2e4e7;color:#646970;font-size:12px}.c767-strategy-actions{display:flex;gap:8px;margin-top:14px}@media(max-width:900px){.c767-strategy-form{grid-template-columns:1fr}.c767-strategy-form .is-wide{grid-column:auto}.c767-recommendations{grid-template-columns:1fr}.c767-strategy-head,.c767-strategy-card>header,.c767-strategy-submit{display:block}.c767-strategy-readiness{display:inline-block;margin-top:12px}.c767-strategy-submit .button{margin-top:12px}}
        </style>
        <?php
    }
}
