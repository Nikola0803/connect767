<?php
/**
 * Booking requests. A listing owner switches booking on for their own
 * listing from the dashboard (POST /listings/{id}/booking — see
 * class-rest-listings.php::set_booking_enabled()); once on, visitors see a
 * "Request a booking" form on that listing's public profile
 * (ListingProfile.jsx) and submissions land here as a `booking` post,
 * exactly like listing submissions land as `pending` posts for moderation.
 *
 * Paid bookings use the site's existing Stripe/PayPal accounts. The price
 * always comes from private listing settings on the server, payment is
 * verified with the processor server-side, and the private meeting link is
 * only returned after payment (or owner confirmation for a free booking).
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Rest_Bookings
{
    const NAMESPACE_ = 'connect767/v1';
    const PAID_TERMS_VERSION = '2026-10-23';
    const PLATFORM_FEE_PERCENT = 10;
    const RENTAL_BOOKING_TYPES = [
        'rental', 'apartments', 'audio-equipment', 'boats', 'electronics',
        'heavy-equipment', 'hotels', 'jet-ski', 'long-term-rental-housing',
        'musical-equipment', 'short-term-rental-housing', 'tools', 'vehicles',
        'video-equipment', 'video-games',
    ];

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/listings/(?P<slug>[a-zA-Z0-9-_]+)/bookings', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'submit'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/bookings/mine', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'mine'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/bookings/(?P<id>\d+)/status', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'set_status'],
            'permission_callback' => [__CLASS__, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE_, '/bookings/(?P<id>\d+)/checkout', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/bookings/(?P<id>\d+)/confirm', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'confirm_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/bookings/(?P<id>\d+)/paypal-order', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'create_paypal_checkout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route(self::NAMESPACE_, '/bookings/(?P<id>\d+)/paypal-capture', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'confirm_paypal_checkout'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
    }

    private static function valid_date($value)
    {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string) $value, $parts)) {
            return false;
        }
        return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
    }

    private static function normalize_booking_type($value)
    {
        $type = sanitize_key((string) $value);
        return $type === 'appointment' || in_array($type, self::RENTAL_BOOKING_TYPES, true)
            ? $type
            : 'appointment';
    }

    private static function is_rental($type)
    {
        return in_array($type, self::RENTAL_BOOKING_TYPES, true);
    }

    private static function rate_unit($type)
    {
        if ($type === 'long-term-rental-housing') {
            return 'month';
        }
        if (in_array($type, ['rental', 'apartments', 'hotels', 'short-term-rental-housing'], true)) {
            return 'night';
        }
        return self::is_rental($type) ? 'day' : 'booking';
    }

    private static function rental_conflict($listing_id, $check_in, $check_out, $exclude_booking_id = 0)
    {
        $ids = get_posts([
            'post_type' => 'booking',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields' => 'ids',
            'meta_query' => [
                ['key' => 'listing_id', 'value' => (int) $listing_id, 'compare' => '='],
                ['key' => 'booking_type', 'value' => self::RENTAL_BOOKING_TYPES, 'compare' => 'IN'],
            ],
        ]);

        foreach ($ids as $id) {
            if ((int) $id === (int) $exclude_booking_id) {
                continue;
            }
            $status = (string) get_post_meta($id, 'status', true);
            $hold_expires = (int) get_post_meta($id, 'hold_expires', true);
            if ($status !== 'confirmed' && $hold_expires <= time()) {
                continue;
            }
            $existing_in = (string) get_post_meta($id, 'check_in', true);
            $existing_out = (string) get_post_meta($id, 'check_out', true);
            // Half-open ranges allow a new guest to check in on the prior
            // guest's check-out date, matching hotel/Airbnb conventions.
            if ($check_in < $existing_out && $check_out > $existing_in) {
                return true;
            }
        }
        return false;
    }

    private static function ensure_rental_available($booking_id)
    {
        if (!self::is_rental(self::normalize_booking_type(get_post_meta($booking_id, 'booking_type', true)))) {
            return true;
        }
        $listing_id = (int) get_post_meta($booking_id, 'listing_id', true);
        $check_in = (string) get_post_meta($booking_id, 'check_in', true);
        $check_out = (string) get_post_meta($booking_id, 'check_out', true);
        if (self::rental_conflict($listing_id, $check_in, $check_out, $booking_id)) {
            return new WP_Error('c767_rental_unavailable', 'Those dates are no longer available. Please choose another stay.', ['status' => 409]);
        }
        return true;
    }

    /**
     * Public submission — no login required, same reasoning as the review
     * form (submitter is a customer, not necessarily a registered user).
     * Rejects outright if the listing hasn't opted in, so the form can
     * never be reached by guessing a slug even if a client bypassed the
     * frontend's own `data.bookingEnabled` check.
     */
    public static function submit(WP_REST_Request $request)
    {
        $slug = sanitize_title((string) $request->get_param('slug'));
        $listing = get_page_by_path($slug, OBJECT, 'listing');
        if (!$listing || $listing->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }
        if (get_post_meta($listing->ID, 'booking_enabled', true) !== '1') {
            return new WP_Error('c767_booking_disabled', 'This listing isn’t accepting booking requests.', ['status' => 400]);
        }

        $name = sanitize_text_field((string) $request->get_param('name'));
        $email = sanitize_email((string) $request->get_param('email'));
        $phone = sanitize_text_field((string) $request->get_param('phone'));
        $booking_type = self::normalize_booking_type(get_post_meta($listing->ID, 'booking_type', true));
        $rate_unit = self::rate_unit($booking_type);
        $preferred_date = sanitize_text_field((string) $request->get_param('preferredDate'));
        $preferred_time = sanitize_text_field((string) $request->get_param('preferredTime'));
        $check_in = sanitize_text_field((string) $request->get_param('checkIn'));
        $check_out = sanitize_text_field((string) $request->get_param('checkOut'));
        $notes = sanitize_textarea_field((string) $request->get_param('notes'));
        $rate_cents = max(0, (int) get_post_meta($listing->ID, 'booking_price_cents', true));
        $amount_cents = $rate_cents;
        $duration_minutes = max(15, (int) (get_post_meta($listing->ID, 'booking_duration_minutes', true) ?: 30));

        if ($name === '' || $email === '' || $phone === '' || $notes === '') {
            return new WP_Error(
                'c767_missing_fields',
                'Name, email, phone, and booking details are required.',
                ['status' => 400]
            );
        }

        $units = 0;
        if (self::is_rental($booking_type)) {
            if (!self::valid_date($check_in) || !self::valid_date($check_out) || $check_in < wp_date('Y-m-d')) {
                return new WP_Error('c767_bad_stay_dates', 'Choose valid check-in and check-out dates that are not in the past.', ['status' => 400]);
            }
            $days = (int) ((strtotime($check_out . ' UTC') - strtotime($check_in . ' UTC')) / DAY_IN_SECONDS);
            $units = $rate_unit === 'month' ? (int) ceil($days / 30) : $days;
            if ($days < 1 || $days > 3650) {
                return new WP_Error('c767_bad_rental_length', 'The end date must be after the start date, with a maximum rental period of 10 years.', ['status' => 400]);
            }
            if (self::rental_conflict($listing->ID, $check_in, $check_out)) {
                return new WP_Error('c767_rental_unavailable', 'Those dates are already booked. Please choose another stay.', ['status' => 409]);
            }
            $amount_cents = min(100000000, $rate_cents * $units);
            $preferred_date = $check_in;
            $preferred_time = '';
        } elseif ($preferred_date === '' || $preferred_time === '') {
            return new WP_Error('c767_missing_fields', 'Preferred date and time are required for an appointment.', ['status' => 400]);
        }

        $terms_accepted = rest_sanitize_boolean($request->get_param('termsAccepted'));
        if ($amount_cents > 0 && !$terms_accepted) {
            return new WP_Error(
                'c767_paid_terms_required',
                'You must accept the Paid Booking Terms, including Connect767\'s 10% transaction fee, before continuing.',
                ['status' => 400]
            );
        }
        $owner_payout_method = (string) get_post_meta($listing->ID, '_booking_payout_method', true);
        if ($amount_cents > 0 && !in_array($owner_payout_method, ['bank', 'digital'], true)) {
            return new WP_Error(
                'c767_owner_payout_unavailable',
                'This business must finish its payout setup before accepting paid bookings.',
                ['status' => 409]
            );
        }

        $booking_id = wp_insert_post([
            'post_type' => 'booking',
            'post_status' => 'publish', // internal CPT, not public-facing — see class-post-types.php
            'post_title' => sprintf('%s — %s', $name, $listing->post_title),
        ], true);
        if (is_wp_error($booking_id)) {
            return new WP_Error('c767_booking_failed', $booking_id->get_error_message(), ['status' => 400]);
        }

        $meta = [
            'listing_id' => $listing->ID,
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'preferred_date' => $preferred_date,
            'preferred_time' => $preferred_time,
            'notes' => $notes,
            'booking_type' => $booking_type,
            'check_in' => $check_in,
            'check_out' => $check_out,
            'nights' => $rate_unit === 'night' ? $units : 0,
            'units' => $units,
            'rate_unit' => $rate_unit,
            'rate_cents' => $rate_cents,
            'status' => 'pending',
            'amount_cents' => $amount_cents,
            'duration_minutes' => $duration_minutes,
            'payment_status' => $amount_cents > 0 ? 'unpaid' : 'not_required',
            'paid_terms_accepted' => $amount_cents > 0 ? '1' : '0',
            'paid_terms_version' => $amount_cents > 0 ? self::PAID_TERMS_VERSION : '',
            'paid_terms_accepted_at' => $amount_cents > 0 ? current_time('mysql', true) : '',
            'platform_fee_percent' => $amount_cents > 0 ? self::PLATFORM_FEE_PERCENT : 0,
            'owner_payout_method' => $amount_cents > 0 ? $owner_payout_method : '',
            'owner_payout_amount_cents' => $amount_cents > 0
                ? (int) floor($amount_cents * (100 - self::PLATFORM_FEE_PERCENT) / 100)
                : 0,
            'owner_payout_status' => $amount_cents > 0 ? 'awaiting_payment' : 'not_required',
            // Possession of this high-entropy token is required for every
            // public payment/confirmation call, so guessing a numeric booking
            // ID can never reveal a private meeting URL.
            'access_token' => wp_generate_password(40, false, false),
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($booking_id, $key, $value);
        }

        do_action('c767_booking_submitted', $booking_id, $listing->ID);

        return rest_ensure_response([
            'id' => $booking_id,
            'bookingId' => $booking_id,
            'status' => 'pending',
            'paymentRequired' => $amount_cents > 0,
            'amountCents' => $amount_cents,
            'platformFeePercent' => $amount_cents > 0 ? self::PLATFORM_FEE_PERCENT : 0,
            'termsVersion' => $amount_cents > 0 ? self::PAID_TERMS_VERSION : '',
            'durationMinutes' => $duration_minutes,
            'bookingType' => $booking_type,
            'rateUnit' => $rate_unit,
            'units' => $units,
            'checkIn' => $check_in,
            'checkOut' => $check_out,
            'nights' => $rate_unit === 'night' ? $units : 0,
            'accessToken' => $meta['access_token'],
            'message' => $amount_cents > 0
                ? (self::is_rental($booking_type) ? 'Your rental is reserved pending payment.' : 'Your appointment is reserved pending payment.')
                : 'Your booking request was sent — the business will reach out to confirm.',
        ]);
    }

    private static function public_booking(WP_REST_Request $request)
    {
        $booking_id = (int) $request->get_param('id');
        $booking = get_post($booking_id);
        if (!$booking || $booking->post_type !== 'booking') {
            return new WP_Error('c767_booking_not_found', 'Booking not found.', ['status' => 404]);
        }
        $provided = (string) $request->get_param('accessToken');
        $expected = (string) get_post_meta($booking_id, 'access_token', true);
        if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
            return new WP_Error('c767_booking_forbidden', 'Invalid booking access token.', ['status' => 403]);
        }
        return $booking;
    }

    private static function ensure_paid_terms_accepted($booking)
    {
        if ((int) get_post_meta($booking->ID, 'amount_cents', true) <= 0) {
            return true;
        }
        if (get_post_meta($booking->ID, 'paid_terms_accepted', true) !== '1') {
            return new WP_Error(
                'c767_paid_terms_required',
                'Paid Booking Terms must be accepted before payment can begin.',
                ['status' => 400]
            );
        }
        return true;
    }

    private static function meeting_url($booking_id)
    {
        $listing_id = (int) get_post_meta($booking_id, 'listing_id', true);
        return (string) get_post_meta($listing_id, 'booking_meeting_url', true);
    }

    private static function mark_paid($booking_id, $processor_reference)
    {
        $already_paid = get_post_meta($booking_id, 'payment_status', true) === 'paid';
        update_post_meta($booking_id, 'payment_status', 'paid');
        update_post_meta($booking_id, 'status', 'confirmed');
        update_post_meta($booking_id, 'payment_reference', sanitize_text_field($processor_reference));
        update_post_meta($booking_id, 'owner_payout_status', 'pending');
        if (!$already_paid) {
            do_action('c767_booking_confirmed', $booking_id);
        }
        return [
            'status' => 'paid',
            'bookingStatus' => 'confirmed',
            'bookingId' => $booking_id,
            'meetingUrl' => self::meeting_url($booking_id),
        ];
    }

    public static function create_checkout(WP_REST_Request $request)
    {
        $booking = self::public_booking($request);
        if (is_wp_error($booking)) {
            return $booking;
        }
        $amount_cents = (int) get_post_meta($booking->ID, 'amount_cents', true);
        if ($amount_cents <= 0) {
            return new WP_Error('c767_booking_free', 'This booking does not require payment.', ['status' => 400]);
        }
        $terms = self::ensure_paid_terms_accepted($booking);
        if (is_wp_error($terms)) {
            return $terms;
        }
        $available = self::ensure_rental_available($booking->ID);
        if (is_wp_error($available)) {
            return $available;
        }

        $existing_id = (string) get_post_meta($booking->ID, 'stripe_payment_intent', true);
        if ($existing_id) {
            $existing = C767_Stripe_Checkout::stripe_get('/payment_intents/' . $existing_id);
            if (!is_wp_error($existing) && in_array($existing['status'] ?? '', ['requires_payment_method', 'requires_confirmation', 'requires_action'], true)) {
                update_post_meta($booking->ID, 'hold_expires', time() + (30 * MINUTE_IN_SECONDS));
                return rest_ensure_response(['bookingId' => $booking->ID, 'clientSecret' => $existing['client_secret']]);
            }
        }

        $intent = C767_Stripe_Checkout::stripe_request('/payment_intents', [
            'amount' => $amount_cents,
            'currency' => 'usd',
            'metadata' => ['booking_id' => $booking->ID, 'listing_id' => get_post_meta($booking->ID, 'listing_id', true)],
            'receipt_email' => get_post_meta($booking->ID, 'email', true) ?: null,
            'payment_method_types' => ['card'],
        ]);
        if (is_wp_error($intent)) {
            return $intent;
        }
        update_post_meta($booking->ID, 'stripe_payment_intent', $intent['id']);
        update_post_meta($booking->ID, 'hold_expires', time() + (30 * MINUTE_IN_SECONDS));
        return rest_ensure_response(['bookingId' => $booking->ID, 'clientSecret' => $intent['client_secret']]);
    }

    public static function confirm_checkout(WP_REST_Request $request)
    {
        $booking = self::public_booking($request);
        if (is_wp_error($booking)) {
            return $booking;
        }
        $intent_id = (string) get_post_meta($booking->ID, 'stripe_payment_intent', true);
        if ($intent_id === '') {
            return new WP_Error('c767_no_payment_intent', 'This booking has no associated payment.', ['status' => 400]);
        }
        $intent = C767_Stripe_Checkout::stripe_get('/payment_intents/' . $intent_id);
        if (is_wp_error($intent)) {
            return $intent;
        }
        if (($intent['status'] ?? '') === 'succeeded') {
            return rest_ensure_response(self::mark_paid($booking->ID, $intent_id));
        }
        return rest_ensure_response(['status' => $intent['status'] ?? 'unknown', 'bookingId' => $booking->ID]);
    }

    public static function create_paypal_checkout(WP_REST_Request $request)
    {
        $booking = self::public_booking($request);
        if (is_wp_error($booking)) {
            return $booking;
        }
        $amount_cents = (int) get_post_meta($booking->ID, 'amount_cents', true);
        if ($amount_cents <= 0) {
            return new WP_Error('c767_booking_free', 'This booking does not require payment.', ['status' => 400]);
        }
        $terms = self::ensure_paid_terms_accepted($booking);
        if (is_wp_error($terms)) {
            return $terms;
        }
        $available = self::ensure_rental_available($booking->ID);
        if (is_wp_error($available)) {
            return $available;
        }
        $token = C767_PayPal_Checkout::access_token();
        if (is_wp_error($token)) {
            return $token;
        }
        $paypal_order = C767_PayPal_Checkout::paypal_request('POST', '/v2/checkout/orders', $token, [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => (string) $booking->ID,
                'amount' => ['currency_code' => 'USD', 'value' => number_format($amount_cents / 100, 2, '.', '')],
            ]],
        ]);
        if (is_wp_error($paypal_order)) {
            return $paypal_order;
        }
        update_post_meta($booking->ID, 'paypal_order_id', $paypal_order['id']);
        update_post_meta($booking->ID, 'hold_expires', time() + (30 * MINUTE_IN_SECONDS));
        return rest_ensure_response(['bookingId' => $booking->ID, 'paypalOrderId' => $paypal_order['id']]);
    }

    public static function confirm_paypal_checkout(WP_REST_Request $request)
    {
        $booking = self::public_booking($request);
        if (is_wp_error($booking)) {
            return $booking;
        }
        $paypal_order_id = (string) get_post_meta($booking->ID, 'paypal_order_id', true);
        if ($paypal_order_id === '') {
            return new WP_Error('c767_no_paypal_order', 'This booking has no associated PayPal order.', ['status' => 400]);
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
            return rest_ensure_response(self::mark_paid($booking->ID, $paypal_order_id));
        }
        return rest_ensure_response(['status' => strtolower($capture['status'] ?? 'unknown'), 'bookingId' => $booking->ID]);
    }

    /**
     * Every booking request across every listing the current user owns —
     * powers a "Booking requests" section in DashboardPage.jsx, the same
     * shape/spirit as listings/mine.
     */
    public static function mine(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $owned_listing_ids = get_posts([
            'post_type' => 'listing',
            'post_status' => 'any',
            'author' => $user->ID,
            'numberposts' => -1,
            'fields' => 'ids',
        ]);
        if (empty($owned_listing_ids)) {
            return rest_ensure_response([]);
        }

        $bookings = get_posts([
            'post_type' => 'booking',
            'post_status' => 'publish',
            'numberposts' => -1,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => [
                ['key' => 'listing_id', 'value' => $owned_listing_ids, 'compare' => 'IN'],
            ],
        ]);

        $results = array_map(function ($post) {
            $listing_id = (int) get_post_meta($post->ID, 'listing_id', true);
            $listing = get_post($listing_id);
            return [
                'id' => $post->ID,
                'listingId' => $listing_id,
                'listingTitle' => $listing ? $listing->post_title : '',
                'listingSlug' => $listing ? $listing->post_name : '',
                'name' => get_post_meta($post->ID, 'name', true),
                'email' => get_post_meta($post->ID, 'email', true),
                'phone' => get_post_meta($post->ID, 'phone', true),
                'preferredDate' => get_post_meta($post->ID, 'preferred_date', true),
                'preferredTime' => get_post_meta($post->ID, 'preferred_time', true),
                'notes' => get_post_meta($post->ID, 'notes', true),
                'bookingType' => self::normalize_booking_type(get_post_meta($post->ID, 'booking_type', true)),
                'checkIn' => get_post_meta($post->ID, 'check_in', true),
                'checkOut' => get_post_meta($post->ID, 'check_out', true),
                'nights' => (int) get_post_meta($post->ID, 'nights', true),
                'units' => (int) (get_post_meta($post->ID, 'units', true) ?: get_post_meta($post->ID, 'nights', true)),
                'rateUnit' => (string) (get_post_meta($post->ID, 'rate_unit', true) ?: 'night'),
                'rateCents' => (int) get_post_meta($post->ID, 'rate_cents', true),
                'status' => get_post_meta($post->ID, 'status', true) ?: 'pending',
                'paymentStatus' => get_post_meta($post->ID, 'payment_status', true) ?: 'not_required',
                'amountCents' => (int) get_post_meta($post->ID, 'amount_cents', true),
                'durationMinutes' => (int) (get_post_meta($post->ID, 'duration_minutes', true) ?: 30),
                'meetingUrl' => self::meeting_url($post->ID),
                'submittedAt' => $post->post_date,
            ];
        }, $bookings);

        return rest_ensure_response($results);
    }

    /** Owner marks a request confirmed/declined after contacting the customer themselves. */
    public static function set_status(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        if (is_wp_error($user)) {
            return $user;
        }

        $booking_id = (int) $request->get_param('id');
        $booking = get_post($booking_id);
        if (!$booking || $booking->post_type !== 'booking') {
            return new WP_Error('c767_booking_not_found', 'Booking not found.', ['status' => 404]);
        }

        $listing_id = (int) get_post_meta($booking_id, 'listing_id', true);
        $listing = get_post($listing_id);
        if (!$listing || (int) $listing->post_author !== (int) $user->ID) {
            return new WP_Error('c767_not_owner', 'This booking isn’t on one of your listings.', ['status' => 403]);
        }

        $status = sanitize_key((string) $request->get_param('status'));
        if (!in_array($status, ['pending', 'confirmed', 'declined'], true)) {
            return new WP_Error('c767_bad_status', 'Status must be pending, confirmed, or declined.', ['status' => 400]);
        }

        if (
            $status === 'confirmed' &&
            (int) get_post_meta($booking_id, 'amount_cents', true) > 0 &&
            get_post_meta($booking_id, 'payment_status', true) !== 'paid'
        ) {
            return new WP_Error('c767_booking_unpaid', 'A paid booking cannot be confirmed until payment succeeds.', ['status' => 400]);
        }

        if ($status === 'confirmed') {
            $available = self::ensure_rental_available($booking_id);
            if (is_wp_error($available)) {
                return $available;
            }
        }

        $previous = get_post_meta($booking_id, 'status', true) ?: 'pending';
        update_post_meta($booking_id, 'status', $status);

        if ($status === 'confirmed' && $previous !== 'confirmed') {
            do_action('c767_booking_confirmed', $booking_id);
        }

        return rest_ensure_response([
            'id' => $booking_id,
            'status' => $status,
            'meetingUrl' => $status === 'confirmed' ? self::meeting_url($booking_id) : '',
        ]);
    }
}
