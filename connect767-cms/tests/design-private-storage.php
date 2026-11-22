<?php
// Isolated storage integration test; run with the PHP GD extension enabled.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ABSPATH', __DIR__ . '/');
define('ARRAY_A', 'ARRAY_A');
define('C767_PRIVATE_DESIGN_DIR', sys_get_temp_dir() . '/c767-private-test-' . bin2hex(random_bytes(6)));
$allow_directory = false;
function wp_mkdir_p($path) { global $allow_directory; return $allow_directory && mkdir($path, 0700, true); }
function trailingslashit($path) { return rtrim($path, '/\\') . '/'; }
function wp_generate_password($length, $special = true, $extra = false) { return substr(bin2hex(random_bytes($length)), 0, $length); }
function get_option($key, $default = false) { return $default; }
function update_option($key, $value, $autoload = null) { return true; }
function wp_parse_args($value, $defaults) { return array_merge($defaults, $value); }
function sanitize_text_field($value) { return (string) $value; }
function sanitize_file_name($value) { return basename($value); }
function sanitize_key($value) { return strtolower($value); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function rest_ensure_response($value) { return $value; }
class WP_Error {
    public $code, $message, $data;
    public function __construct($code, $message, $data = []) { $this->code = $code; $this->message = $message; $this->data = $data; }
}
class WP_REST_Request {
    private $params;
    public function __construct($params) { $this->params = $params; }
    public function get_param($key) { return $this->params[$key] ?? null; }
}
class StorageDatabase {
    public $prefix = 'wp_', $insert_id = 0, $files = [], $fail = false;
    public function prepare($sql, ...$args) { return ['sql' => $sql, 'args' => $args]; }
    public function get_row($query, $format) { return ['project_id' => 9, 'status' => 'reserved']; }
    public function insert($table, $row, $formats) {
        if ($this->fail) return false;
        $this->files[++$this->insert_id] = $row; return 1;
    }
}
$wpdb = new StorageDatabase();
require_once __DIR__ . '/../includes/class-design-studio-security.php';
$read = new ReflectionMethod('C767_Design_Studio_Security', 'read_private_source');
$read->setAccessible(true);
$checks = 0;
function verify_storage($condition, $message) { global $checks; if (!$condition) throw new Exception($message); $checks++; }
$image = imagecreatetruecolor(640, 360);
imagefill($image, 0, 0, imagecolorallocate($image, 0, 100, 65));
ob_start(); imagepng($image); $bytes = ob_get_clean(); imagedestroy($image);
$request = new WP_REST_Request(['requestId' => 'isolated-storage-check', 'b64' => base64_encode($bytes), 'fileType' => 'png', 'originalName' => 'test-design.png']);
try {
    $result = C767_Design_Studio_Security::store_file($request);
    verify_storage(!is_wp_error($result), 'A managed host with no private directory must still save the design');
    $saved = $wpdb->files[$result['fileId']];
    verify_storage($saved['source_data'] === $bytes, 'Original bytes were not persisted in the private database row');
    verify_storage(!is_dir(C767_PRIVATE_DESIGN_DIR), 'Fallback unexpectedly wrote into a public or temporary directory');
    verify_storage($read->invoke(null, $saved) === $bytes, 'Database-backed download did not recover the exact original');
    verify_storage($result['watermarked'] && $result['previewOnly'] && base64_decode($result['b64']) !== $bytes, 'The public result must only contain a watermarked preview');
    verify_storage(!array_key_exists('source_data', $result) && !array_key_exists('storage_name', $result), 'Private storage details leaked into the result');
    $damaged = $saved; $damaged['source_data'] .= 'corrupt';
    verify_storage(is_wp_error($read->invoke(null, $damaged)), 'Corrupt database source passed integrity validation');
    $wpdb->fail = true;
    $failed = C767_Design_Studio_Security::store_file($request);
    verify_storage(is_wp_error($failed) && $failed->code === 'c767_file_store', 'A failed database write was reported as successful');
    $wpdb->fail = false; $allow_directory = true;
    $disk_result = C767_Design_Studio_Security::store_file($request);
    verify_storage(!is_wp_error($disk_result), 'Writable private disk storage stopped working');
    $disk = $wpdb->files[$disk_result['fileId']];
    verify_storage($disk['source_data'] === null && is_file(C767_PRIVATE_DESIGN_DIR . '/' . $disk['storage_name']), 'Writable hosts must keep using private disk storage');
    verify_storage($read->invoke(null, $disk) === $bytes, 'Legacy private disk downloads stopped working');
    unset($disk['source_data']);
    verify_storage($read->invoke(null, $disk) === $bytes, 'Old file rows without a blob field are not readable');
    $disk['storage_name'] = 'missing.png';
    verify_storage(is_wp_error($read->invoke(null, $disk)), 'Missing private source was accepted');
    echo "$checks private storage checks passed.\n";
} finally {
    if (is_dir(C767_PRIVATE_DESIGN_DIR)) {
        foreach (scandir(C767_PRIVATE_DESIGN_DIR) as $entry) if ($entry !== '.' && $entry !== '..') unlink(C767_PRIVATE_DESIGN_DIR . '/' . $entry);
        rmdir(C767_PRIVATE_DESIGN_DIR);
    }
}
