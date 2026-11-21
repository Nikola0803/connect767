<?php
// Isolated checkout validation test. No WordPress, network or payment calls.
define('ABSPATH', __DIR__);
class WP_REST_Request {
    private $params;
    public function __construct($params) { $this->params = $params; }
    public function get_param($name) { return $this->params[$name] ?? null; }
}
class WP_Error {
    public $code;
    public function __construct($code, $message, $data = []) { $this->code = $code; }
}
function sanitize_email($email) { return $email; }
function is_email($email) { return filter_var($email, FILTER_VALIDATE_EMAIL); }
require_once __DIR__ . '/../includes/class-uniform-checkout.php';
$build = new ReflectionMethod('C767_Uniform_Checkout', 'build_order');
$build->setAccessible(true);
$checks = 0;
foreach ([[], ['customOrderTermsAccepted' => false], ['customOrderTermsAccepted' => 'true'], ['customOrderTermsAccepted' => 1], ['customOrderTermsAccepted' => true, 'customOrderTermsVersion' => 'old']] as $payload) {
    $result = $build->invoke(null, new WP_REST_Request(['order' => $payload]), false);
    if (!($result instanceof WP_Error) || $result->code !== 'c767_uniform_terms_required') throw new Exception('Checkout bypassed explicit current-policy acceptance.');
    $checks++;
}
$accepted = ['customOrderTermsAccepted' => true, 'customOrderTermsVersion' => C767_Uniform_Checkout::CUSTOM_ORDER_TERMS_VERSION];
$result = $build->invoke(null, new WP_REST_Request(['order' => $accepted]), false);
if ($result->code !== 'c767_invalid_email') throw new Exception('Accepted consent did not proceed to ordinary checkout validation.');
$checks++;
$result = $build->invoke(null, new WP_REST_Request(['order' => []]), true);
if ($result->code !== 'c767_invalid_email') throw new Exception('Consent incorrectly prevented calculating a quote.');
$checks++;
echo "$checks uniform consent checks passed.\n";
