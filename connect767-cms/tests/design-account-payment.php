<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ABSPATH', __DIR__ . '/'); define('ARRAY_A', 'ARRAY_A');
function get_option($key, $default = false) { return $key === 'c767_design_security_settings' ? ['service_secret' => 'test-bridge'] : $default; }
function wp_parse_args($value, $defaults) { return array_merge($defaults, $value); }
function wp_generate_password($length, $special = true, $extra = false) { return str_repeat('x', $length); }
function absint($value) { return abs((int) $value); }
function sanitize_text_field($value) { return (string) $value; }
function sanitize_key($value) { return strtolower((string) $value); }
function rest_sanitize_boolean($value) { return (bool) $value; }
function rest_ensure_response($value) { return $value; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_json_encode($value) { return json_encode($value); }
function rest_url($path) { return 'https://cms.example.test/wp-json/' . $path; }
class WP_Error {
    public $code, $message, $data;
    public function __construct($code, $message, $data = []) { $this->code = $code; $this->message = $message; $this->data = $data; }
}
class WP_REST_Request {
    private $params, $headers = [];
    public function __construct($params = []) { $this->params = $params; }
    public function get_param($key) { return $this->params[$key] ?? null; }
    public function set_header($key, $value) { $this->headers[$key] = $value; }
    public function get_header($key) { return $this->headers[$key] ?? ''; }
}
class C767_REST_Auth {
    public static function user_from_request($request) {
        return $request->get_header('authorization') === 'Bearer member-7'
            ? (object) ['ID' => 7] : new WP_Error('c767_bad_token', 'Sign in required.', ['status' => 401]);
    }
}
class C767_JWT { public static function secret() { return 'isolated-signing-key'; } }
class TestPaidOrder {
    public $paid = false, $customer = 7;
    public function is_paid() { return $this->paid; }
    public function get_customer_id() { return $this->customer; }
    public function get_meta($key) { return $key === '_c767_uniform_order'; }
}
$order = new TestPaidOrder();
function wc_get_order($id) { global $order; return $id === 18 ? $order : false; }
class AccessDatabase {
    public $prefix = 'wp_', $queries = 0, $active = true, $order_id = 18, $file_type = 'png';
    public function prepare($sql, ...$args) { return ['sql' => $sql, 'args' => $args]; }
    public function get_row($query, $format) { $this->queries++; return ['id' => 4, 'project_id' => 9, 'file_type' => $this->file_type]; }
    public function get_results($query, $format) {
        $this->queries++;
        if (strpos($query['sql'], 'design_entitlements') !== false) return $this->active ? [['file_types' => '["png"]', 'order_id' => $this->order_id]] : [];
        return [];
    }
    public function get_var($query) { $this->queries++; return 0; }
}
$wpdb = new AccessDatabase();
require_once __DIR__ . '/../includes/class-design-studio-security.php';
require_once __DIR__ . '/../includes/class-uniform-checkout.php';
$checks = 0;
function check_access($condition, $message) { global $checks; if (!$condition) throw new Exception($message); $checks++; }
function member_request($params = []) { $r = new WP_REST_Request($params); $r->set_header('authorization', 'Bearer member-7'); return $r; }
foreach (['', 'old-guest-token'] as $guest) {
    $r = new WP_REST_Request(['requestId' => 'blocked', 'projectId' => 'old-guest-project']); $r->set_header('x-c767-guest-token', $guest);
    $result = C767_Design_Studio_Security::reserve_ai($r);
    check_access(is_wp_error($result) && $result->data['status'] === 401 && $result->data['requiresAccount'], 'Guest AI generation was allowed');
}
check_access($wpdb->queries === 0, 'Guest prompt touched the usage ledger');
$service = new ReflectionMethod('C767_Design_Studio_Security', 'service_identity'); $service->setAccessible(true);
$r = new WP_REST_Request(); $r->set_header('x-c767-user-authorization', 'Bearer expired');
check_access(is_wp_error($service->invoke(null, $r)), 'An invalid account token was accepted');
$r->set_header('x-c767-user-authorization', 'Bearer member-7');
check_access($service->invoke(null, $r)['user_id'] === 7, 'A valid member account was rejected');
check_access(is_wp_error(C767_Design_Studio_Security::download_token(new WP_REST_Request(['fileId' => 4]))), 'Anonymous download token was issued');
$unpaid = C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]));
check_access(is_wp_error($unpaid) && $unpaid->data['status'] === 403, 'An unpaid customer downloaded an original');
$status = new ReflectionMethod('C767_Design_Studio_Security', 'project_download_state'); $status->setAccessible(true);
check_access(!$status->invoke(null, ['user_id' => 7], ['id' => 9])['downloadUnlocked'], 'Files-ready state was exposed before payment');
$order->paid = true; $order->customer = 8;
check_access(is_wp_error(C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]))), 'Another customer\'s paid order unlocked this download');
$order->customer = 7;
$paid = C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]));
check_access(!is_wp_error($paid) && isset($paid['url']), 'The paid owner could not request a download');
check_access($status->invoke(null, ['user_id' => 7], ['id' => 9])['downloadUnlocked'], 'The paid owner did not receive the ready state');
$wpdb->file_type = 'webp';
check_access(!is_wp_error(C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]))), 'Paid native image encoding was rejected');
$wpdb->file_type = 'svg';
check_access(is_wp_error(C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]))), 'An unpurchased file type was allowed');
$wpdb->file_type = 'png'; $order->paid = false;
parse_str(parse_url($paid['url'], PHP_URL_QUERY), $ticket);
$blocked = C767_Design_Studio_Security::download(member_request($ticket));
check_access(is_wp_error($blocked) && $blocked->data['status'] === 403, 'A previously issued ticket bypassed a refunded order');
$order->paid = true; $wpdb->active = false;
check_access(is_wp_error(C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]))), 'Revoked order access remained unlocked');
$wpdb->active = true; $wpdb->order_id = 99;
check_access(is_wp_error(C767_Design_Studio_Security::download_token(member_request(['fileId' => 4]))), 'A missing paid order remained unlocked');
$price = new ReflectionMethod('C767_Uniform_Checkout', 'authoritative_unit_price'); $price->setAccessible(true);
check_access($price->invoke(null, ['sport' => 'basketball', 'collar' => 'Polo', 'sleeve' => 'Long']) === 30.0, 'Basketball retained collar or sleeve surcharges');
check_access($price->invoke(null, ['sport' => 'soccer', 'collar' => 'Polo', 'sleeve' => 'Long']) === 39.0, 'Other categories lost existing collar/sleeve pricing');
echo "$checks account and payment checks passed.\n";
