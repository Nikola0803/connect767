<?php
/**
 * Real embedded Stripe payment for the Classified listing tier ($40/yr).
 * Same pattern as class-stripe-checkout.php's Shop checkout (a Stripe
 * PaymentIntent created server-side, confirmed server-side by asking
 * Stripe directly rather than trusting the browser's own claim), just
 * charging against a `listing` post's own tier instead of a WooCommerce
 * cart.
 *
 * This didn't exist before: C767_REST_Listings::submit() already stored
 * `tier => Classified` in post meta the moment a business owner picked
 * that tier in the wizard, with nothing checking whether they'd actually
 * paid — the frontend's own payment step (AddListingPage.jsx) had no
 * matching backend route to call, so every Classified submission silently
 * fell back to "we'll follow up about billing" and went out unpaid. This
 * closes that gap: submissions now carry a real `payment_status` (see
 * C767_REST_Listings::submit()), and `Classified` only reaches
 * `payment_status => paid` once Stripe itself confirms the charge here.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Stripe_Listing_Checkout
{
    const NAMESPACE_ = 'connect767/v1';
    const CLASSIFIED_PRICE_CENTS = 4000; // $40.00/yr

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/listings/payment-intent', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_intent'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/payment-confirm', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'confirm_payment'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/paypal-order', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_paypal_order'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/listings/paypal-capture', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'capture_paypal_order'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
    }

    /**
     * Loads the listing and checks it actually belongs to the requesting
     * user and is genuinely a Classified submission — without this, any
     * authenticated user could pass an arbitrary listingId and create a
     * PaymentIntent tied to someone else's listing, or pay against a Free
     * one that was never meant to be billed.
     */
    private static function get_owned_classified_listing($listing_id, $user_id)
    {
        $post = get_post($listing_id);
        if (!$post || $post->post_type !== 'listing') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if ((int) $post->post_author !== (int) $user_id) {
            return new WP_Error('c767_not_owner', 'This listing does not belong to you.', ['status' => 403]);
        }
        $tier = get_post_meta($post->ID, 'tier', true);
        if ($tier !== 'Classified') {
            return new WP_Error('c767_not_classified', 'This listing is not a Classified submission.', ['status' => 400]);
        }
        return $post;
    }

    /**
     * Creates a Stripe PaymentIntent for the fixed Classified price and
     * stores its ID on the listing, mirroring
     * C767_Stripe_Checkout::create_intent()'s order/PaymentIntent linkage.
     */
    public static function create_intent(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_id = (int) $request->get_param('listingId');
        $listing = self::get_owned_classified_listing($listing_id, $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }

        // Reuse an existing still-open PaymentIntent rather than creating a
        // new one on every retry (e.g. the user backs out of the card form
        // and clicks "Pay" again) — avoids leaving a trail of abandoned
        // PaymentIntents per listing.
        $existing_intent_id = get_post_meta($listing_id, '_c767_stripe_payment_intent', true);
        if ($existing_intent_id) {
            $existing = C767_Stripe_Checkout::stripe_get('/payment_intents/' . $existing_intent_id);
            if (!is_wp_error($existing) && in_array($existing['status'], ['requires_payment_method', 'requires_confirmation', 'requires_action'], true)) {
                return rest_ensure_response([
                    'listingId' => $listing_id,
                    'clientSecret' => $existing['client_secret'],
                ]);
            }
        }

        $email = get_post_meta($listing_id, 'email', true);
        $intent = C767_Stripe_Checkout::stripe_request('/payment_intents', [
            'amount' => self::CLASSIFIED_PRICE_CENTS,
            'currency' => 'usd',
            'metadata' => ['listing_id' => $listing_id, 'purpose' => 'classified_listing'],
            'receipt_email' => $email ?: null,
            // Card-only — see the matching comment in
            // class-stripe-checkout.php::create_intent() for why this is
            // required to avoid the "must provide a return_url" error.
            'payment_method_types' => ['card'],
        ]);

        if (is_wp_error($intent)) {
            return $intent;
        }

        update_post_meta($listing_id, '_c767_stripe_payment_intent', $intent['id']);

        return rest_ensure_response([
            'listingId' => $listing_id,
            'clientSecret' => $intent['client_secret'],
        ]);
    }

    /**
     * Confirms payment actually succeeded by asking Stripe directly —
     * never trusts the frontend's own claim that
     * `stripe.confirmPayment()` succeeded. Only once Stripe reports the
     * PaymentIntent as `succeeded` does the listing's `payment_status`
     * flip to `paid`; the listing itself stays `pending` either way
     * (moderation still happens in Review Listings — paying doesn't skip
     * review, it just settles billing).
     */
    public static function confirm_payment(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_id = (int) $request->get_param('listingId');
        $listing = self::get_owned_classified_listing($listing_id, $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }

        $intent_id = get_post_meta($listing_id, '_c767_stripe_payment_intent', true);
        if (!$intent_id) {
            return new WP_Error('c767_no_payment_intent', 'This listing has no associated payment.', ['status' => 400]);
        }

        $intent = C767_Stripe_Checkout::stripe_get('/payment_intents/' . $intent_id);
        if (is_wp_error($intent)) {
            return $intent;
        }

        if ($intent['status'] === 'succeeded') {
            update_post_meta($listing_id, 'payment_status', 'paid');
            do_action('c767_listing_payment_confirmed', $listing_id);
            return rest_ensure_response(['status' => 'paid', 'listingId' => $listing_id]);
        }

        return rest_ensure_response(['status' => $intent['status'], 'listingId' => $listing_id]);
    }

    /**
     * PayPal's counterpart to create_intent() — same fixed Classified price,
     * same reused-order-on-retry idea isn't needed here since PayPal orders
     * are cheap/short-lived and the frontend only calls this once the buyer
     * actually picks PayPal (see AddListingPage.jsx's "choose payment
     * method" step). Requires C767_PayPal_Checkout to be loaded first —
     * same require-order note as class-rest-vendor-products.php.
     */
    public static function create_paypal_order(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_id = (int) $request->get_param('listingId');
        $listing = self::get_owned_classified_listing($listing_id, $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }

        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $paypal_order = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders', $token, [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) $listing_id,
                'amount' => [
                    'currency_code' => 'USD',
                    'value' => number_format(self::CLASSIFIED_PRICE_CENTS / 100, 2, '.', ''),
                ],
            ]],
        ]);
        if (is_wp_error($paypal_order)) {
            return $paypal_order;
        }

        update_post_meta($listing_id, '_c767_paypal_order_id', $paypal_order['id']);

        return rest_ensure_response([
            'listingId' => $listing_id,
            'paypalOrderId' => $paypal_order['id'],
        ]);
    }

    /** Never trusts the browser's word — asks PayPal directly, same rule as confirm_payment() above. */
    public static function capture_paypal_order(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $listing_id = (int) $request->get_param('listingId');
        $listing = self::get_owned_classified_listing($listing_id, $user->ID);
        if (is_wp_error($listing)) {
            return $listing;
        }

        $paypal_order_id = get_post_meta($listing_id, '_c767_paypal_order_id', true);
        if (!$paypal_order_id) {
            return new WP_Error('c767_no_paypal_order', 'This listing has no associated PayPal order.', ['status' => 400]);
        }

        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            return $token;
        }

        $capture = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders/' . $paypal_order_id . '/capture', $token);
        if (is_wp_error($capture)) {
            return $capture;
        }

        if (($capture['status'] ?? '') === 'COMPLETED') {
            update_post_meta($listing_id, 'payment_status', 'paid');
            do_action('c767_listing_payment_confirmed', $listing_id);
            return rest_ensure_response(['status' => 'paid', 'listingId' => $listing_id]);
        }

        return rest_ensure_response(['status' => strtolower($capture['status'] ?? 'unknown'), 'listingId' => $listing_id]);
    }
}
