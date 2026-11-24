<?php
// Isolated attachment validation/storage checks; no WordPress, uploads or payment calls.
define('ABSPATH', __DIR__);
class WP_Error { public $code; public function __construct($code, $message, $data = []) { $this->code = $code; } }
class WC_Order {
    public $meta = []; public $notes = [];
    public function update_meta_data($key, $value) { $this->meta[$key] = $value; }
    public function get_meta($key) { return $this->meta[$key] ?? ''; }
    public function get_id() { return 42; }
    public function add_order_note($note, $customer) { $this->notes[] = $note; }
}
function sanitize_file_name($s) { return preg_replace('/[^A-Za-z0-9._-]/', '', basename($s)); }
function sanitize_title($s) { return preg_replace('/[^a-z0-9-]/', '', strtolower($s)); }
function sanitize_text_field($s) { return trim(strip_tags($s)); }
function sanitize_textarea_field($s) { return trim(strip_tags($s)); }
if (!function_exists('mb_substr')) { function mb_substr($s, $start, $length) { return substr($s, $start, $length); } }
function wp_json_encode($value) { return json_encode($value); }
function current_user_can($cap) { return $GLOBALS['manager'] ?? false; }
function esc_html($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function esc_url($s) { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function admin_url($path) { return 'https://example.test/wp-admin/' . $path; }
function add_query_arg($args, $url) { return $url . '?' . http_build_query($args); }
function wp_nonce_url($url, $action) { return $url . '&_wpnonce=' . $action; }
function absint($value) { return abs((int) $value); }
function wp_die($message, $title, $args) { throw new RuntimeException($message, $args['response']); }
function check_admin_referer($action) { if (!($GLOBALS['nonce_valid'] ?? false)) throw new RuntimeException('Invalid nonce', 403); }
function wc_get_order($id) { return $id === 42 ? $GLOBALS['test_order'] : null; }
function nocache_headers() {}
require_once __DIR__ . '/../includes/class-rest-uniform-quotes.php';
require_once __DIR__ . '/../includes/class-ready-made-artwork.php';
$checks = 0;
function check($condition, $message) { global $checks; if (!$condition) throw new RuntimeException($message); $checks++; }
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOioAAAAASUVORK5CYII=');
$team = ['name' => 'crest.png', 'kind' => 'team', 'src' => 'data:image/png;base64,' . base64_encode($png), 'size' => 1, 'productSlug' => 'home-kit', 'productTitle' => 'Forged title', 'notes' => '<b>Left chest</b>'];
$sponsor = ['name' => 'sponsor.pdf', 'kind' => 'sponsor', 'src' => 'data:application/pdf;base64,' . base64_encode('%PDF-1.4 sponsor artwork'), 'notes' => 'Upper back'];
$designs = ['home-kit' => 'Home Kit'];
$files = C767_Ready_Made_Artwork::validate([$team, $sponsor], $designs);
check(is_array($files) && count($files) === 2, 'Valid team and sponsor files rejected.');
check($files[0]['size'] === strlen($png), 'Client byte count was trusted.');
check($files[0]['productTitle'] === 'Home Kit' && $files[0]['notes'] === 'Left chest', 'Design title/notes were not sanitized.');
check($files[1]['type'] === 'application/pdf' && $files[1]['kind'] === 'sponsor', 'Sponsor PDF changed.');
check(C767_Ready_Made_Artwork::validate([], []) === [], 'Optional artwork incorrectly required.');
foreach ([
    [[$team], [], 'c767_artwork_order'],
    [array_fill(0, 11, $team), $designs, 'c767_artwork_count'],
    [[array_merge($team, ['kind' => 'script'])], $designs, 'c767_artwork_kind'],
    [[array_merge($team, ['productSlug' => 'other-order'])], $designs, 'c767_artwork_design'],
    [[array_merge($team, ['src' => 'data:image/svg+xml;base64,' . base64_encode('<svg/>')])], $designs, 'c767_artwork_file'],
    [[array_merge($team, ['src' => 'data:image/png;base64,' . base64_encode('%PDF-1.4 fake')])], $designs, 'c767_artwork_file'],
    [[array_merge($sponsor, ['src' => 'data:application/pdf;base64,' . base64_encode('%PDF-' . str_repeat('x', 2097152))])], $designs, 'c767_artwork_file'],
] as $case) {
    $result = C767_Ready_Made_Artwork::validate($case[0], $case[1]);
    check($result instanceof WP_Error && $result->code === $case[2], 'Invalid artwork accepted: ' . $case[2]);
}
$large = array_merge($sponsor, ['src' => 'data:application/pdf;base64,' . base64_encode('%PDF-' . str_repeat('x', 1600000))]);
$result = C767_Ready_Made_Artwork::validate([$large, $large], $designs);
check($result instanceof WP_Error && $result->code === 'c767_artwork_size', 'Combined size limit bypassed.');
$order = new WC_Order(); $GLOBALS['test_order'] = $order;
C767_Ready_Made_Artwork::store($order, $files);
$saved = json_decode($order->meta[C767_Ready_Made_Artwork::META_KEY], true);
check($saved[0]['src'] === $team['src'] && $saved[1]['src'] === $sponsor['src'], 'Original order files lost.');
check(strpos($order->notes[0], 'Upper back') !== false && strpos($order->notes[0], 'base64') === false, 'Production note omitted placement or exposed binary data.');
ob_start(); C767_Ready_Made_Artwork::render_order_files($order); $html = ob_get_clean();
check($html === '', 'Unauthorized admin artwork list was shown.');
$GLOBALS['manager'] = true;
ob_start(); C767_Ready_Made_Artwork::render_order_files($order); $html = ob_get_clean();
check(strpos($html, 'action=c767_ready_made_artwork') !== false && strpos($html, '_wpnonce=c767_ready_made_artwork_42') !== false && strpos($html, 'base64') === false, 'Admin links missing order-bound nonce or leaking original bytes.');
foreach ([[false, false, 0, 403], [true, false, 0, 403], [true, true, 99, 404]] as $case) {
    $GLOBALS['manager'] = $case[0]; $GLOBALS['nonce_valid'] = $case[1]; $_GET = ['order_id' => 42, 'file' => $case[2]];
    try { C767_Ready_Made_Artwork::download_order_file(); throw new Exception('Invalid download accepted.'); }
    catch (RuntimeException $error) { check($error->getCode() === $case[3], 'Download access check failed.'); }
}
if (in_array($argv[1] ?? '', ['download-team', 'download-sponsor'], true)) {
    $GLOBALS['manager'] = true; $GLOBALS['nonce_valid'] = true;
    $_GET = ['order_id' => 42, 'file' => $argv[1] === 'download-team' ? 0 : 1];
    C767_Ready_Made_Artwork::download_order_file();
}
echo "$checks ready-made artwork checks passed.\n";
