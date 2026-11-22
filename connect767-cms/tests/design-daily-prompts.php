<?php
// Isolated quota test: no WordPress, external AI requests or customer data.
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);
define('DAY_IN_SECONDS', 86400);
define('ARRAY_A', 'ARRAY_A');
$options = [];
function get_option($key, $default = false) { global $options; return $options[$key] ?? $default; }
function update_option($key, $value, $autoload = null) { global $options; $options[$key] = $value; }
function wp_parse_args($saved, $defaults) { return array_merge($defaults, $saved); }
function wp_generate_password($length, $special = true, $extra = false) { return str_repeat('x', $length); }
function absint($value) { return abs((int) $value); }
function sanitize_text_field($value) { return (string) $value; }
function sanitize_key($value) { return strtolower($value); }
function rest_ensure_response($value) { return $value; }
function rest_sanitize_boolean($value) { return $value === true || $value === 'true'; }
function is_wp_error($value) { return $value instanceof WP_Error; }
class WP_Error {
    public $code, $message, $data;
    public function __construct($code, $message, $data = []) { $this->code = $code; $this->message = $message; $this->data = $data; }
}
class WP_REST_Request {
    private $params, $headers = [];
    public function __construct($params = []) { $this->params = $params; }
    public function get_param($name) { return $this->params[$name] ?? null; }
    public function set_header($name, $value) { $this->headers[$name] = $value; }
    public function get_header($name) { return $this->headers[$name] ?? ''; }
}
class C767_REST_Auth {
    public static function user_from_request($request) { return (object) ['ID' => 7]; }
}
class QuotaDatabase {
    public $prefix = 'wp_', $usage = [];
    public function prepare($sql, ...$args) { return ['sql' => $sql, 'args' => $args]; }
    public function get_var($query) {
        $sql = $query['sql']; $args = $query['args'];
        if (strpos($sql, 'GET_LOCK') !== false || strpos($sql, 'RELEASE_LOCK') !== false) return 1;
        if (strpos($sql, 'SUM(credit_cost)') !== false) {
            $used = 0;
            foreach ($this->usage as $row) {
                if ($row['subject_type'] !== $args[0] || $row['subject_key'] !== $args[1] || $row['created_at'] < $args[2]) continue;
                if ($row['status'] === 'completed' || ($row['status'] === 'reserved' && $row['updated_at'] >= $args[3])) $used += $row['credit_cost'];
            }
            return $used;
        }
        if (strpos($sql, 'COUNT(*)') !== false) return count($this->usage);
        throw new Exception('Unexpected quota SQL');
    }
    public function get_row($query, $format = null) {
        if (strpos($query['sql'], 'design_projects') !== false) return ['id' => 9, 'public_id' => 'test-project', 'owner_user_id' => 7];
        return $this->usage[$query['args'][0]] ?? null;
    }
    public function insert($table, $row, $formats = []) { $this->usage[$row['request_id']] = $row; return 1; }
    public function update($table, $patch, $where, $formats = [], $where_formats = []) {
        $id = $where['request_id']; $this->usage[$id] = array_merge($this->usage[$id], $patch); return 1;
    }
}
$wpdb = new QuotaDatabase();
require_once __DIR__ . '/../includes/class-design-studio-security.php';
$settings = new ReflectionMethod('C767_Design_Studio_Security', 'settings'); $settings->setAccessible(true);
$quota = new ReflectionMethod('C767_Design_Studio_Security', 'quota'); $quota->setAccessible(true);
$identity = ['user_id' => 7, 'type' => 'user', 'session_key' => '', 'token' => ''];
$checks = 0;
function verify_quota($condition, $message) { global $checks; if (!$condition) throw new Exception($message); $checks++; }
function quota_request($id, $extra = []) {
    $request = new WP_REST_Request(array_merge(['requestId' => $id, 'projectId' => 'test-project', 'operation' => 'generation'], $extra));
    $request->set_header('x-c767-user-authorization', 'Bearer isolated-test'); return $request;
}
$options[C767_Design_Studio_Security::OPTION_KEY] = ['registered_daily_limit' => 10, 'guest_limit' => 3, 'watermark_text' => 'Keep me', 'service_secret' => 'isolated-test-secret'];
for ($i = 1; $i <= 4; $i++) $wpdb->usage['old-' . $i] = ['request_id' => 'old-' . $i, 'subject_type' => 'user', 'subject_key' => '7', 'status' => 'completed', 'credit_cost' => 1, 'created_at' => gmdate('Y-m-d H:i:s'), 'updated_at' => gmdate('Y-m-d H:i:s')];
$usage_before = $wpdb->usage;
C767_Design_Studio_Security::migrate_quota_policy();
$current = $settings->invoke(null);
verify_quota($current['registered_daily_limit'] === 5, 'Existing ten-prompt settings did not migrate to five');
verify_quota($current['watermark_text'] === 'Keep me' && $current['service_secret'] === 'isolated-test-secret' && $current['guest_limit'] === 3, 'Migration changed unrelated settings');
verify_quota($wpdb->usage === $usage_before, 'Migration reset existing daily usage');
verify_quota($quota->invoke(null, $identity) === ['limit' => 5, 'used' => 4, 'remaining' => 1], 'Four existing prompts should leave one');
$saved = $options;
C767_Design_Studio_Security::migrate_quota_policy();
verify_quota($saved === $options, 'Quota policy migration is not idempotent');
$fifth = C767_Design_Studio_Security::reserve_ai(quota_request('fifth'));
verify_quota($fifth['allowed'] && $fifth['limit'] === 5 && $fifth['remaining'] === 0, 'Fifth prompt did not consume the final allowance');
$duplicate = C767_Design_Studio_Security::reserve_ai(quota_request('fifth'));
verify_quota($duplicate['duplicate'] && count($wpdb->usage) === 5, 'One logical prompt was charged twice');
$sixth = C767_Design_Studio_Security::reserve_ai(quota_request('sixth'));
verify_quota(is_wp_error($sixth) && $sixth->code === 'c767_ai_limit_reached' && $sixth->data['status'] === 429, 'Server allowed a sixth prompt');
verify_quota($sixth->data['remaining'] === 0 && $sixth->data['limit'] === 5 && count($wpdb->usage) === 5, 'Exhausted quota response or ledger is incorrect');
C767_Design_Studio_Security::settle_ai(quota_request('fifth', ['successful' => false]));
verify_quota($quota->invoke(null, $identity)['remaining'] === 1, 'Failed generation did not return its allowance');
$retry = C767_Design_Studio_Security::reserve_ai(quota_request('retry'));
verify_quota($retry['allowed'] && $retry['remaining'] === 0, 'Returned allowance cannot be reused');
C767_Design_Studio_Security::settle_ai(quota_request('retry', ['successful' => true]));
verify_quota($quota->invoke(null, $identity)['used'] === 5, 'Successful retry exceeded five prompts');
foreach ($wpdb->usage as &$row) $row['created_at'] = '2000-01-01 00:00:00'; unset($row);
verify_quota($quota->invoke(null, $identity)['remaining'] === 5, 'Allowance did not reset for a new UTC day');
verify_quota($quota->invoke(null, ['user_id' => 0, 'type' => 'guest', 'session_key' => 'guest'])['limit'] === 3, 'Registered policy changed guest allowance');
$options = [];
C767_Design_Studio_Security::migrate_quota_policy();
verify_quota($settings->invoke(null)['registered_daily_limit'] === 5, 'New installation does not default to five prompts');
echo "$checks daily prompt checks passed.\n";
