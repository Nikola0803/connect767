<?php
/**
 * Booking requests. A listing owner switches booking on for their own
 * listing from the dashboard (POST /listings/{id}/booking — see
 * class-rest-listings.php::set_booking_enabled()); once on, visitors see a
 * "Request a booking" form on that listing's public profile
 * (ListingProfile.jsx) and submissions land here as a `booking` post,
 * exactly like listing submissions land as `pending` posts for moderation.
 *
 * No payment involved — this is a request/response flow (like the
 * uniform-quotes and product-quotes forms), not a calendar with live
 * availability slots. The owner sees requests in their dashboard and
 * confirms/declines by contacting the customer directly using the
 * phone/email they submitted.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Rest_Bookings
{
    const NAMESPACE_ = 'connect767/v1';

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
    }

    public static function check_auth(WP_REST_Request $request)
    {
        $user = C767_REST_Auth::user_from_request($request);
        return is_wp_error($user) ? $user : true;
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
        $preferred_date = sanitize_text_field((string) $request->get_param('preferredDate'));
        $preferred_time = sanitize_text_field((string) $request->get_param('preferredTime'));
        $notes = sanitize_textarea_field((string) $request->get_param('notes'));

        if ($name === '' || ($email === '' && $phone === '')) {
            return new WP_Error(
                'c767_missing_fields',
                'Name and at least one contact method (email or phone) are required.',
                ['status' => 400]
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
            'status' => 'pending',
        ];
        foreach ($meta as $key => $value) {
            update_post_meta($booking_id, $key, $value);
        }

        do_action('c767_booking_submitted', $booking_id, $listing->ID);

        return rest_ensure_response([
            'id' => $booking_id,
            'status' => 'pending',
            'message' => 'Your booking request was sent — the business will reach out to confirm.',
        ]);
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
                'status' => get_post_meta($post->ID, 'status', true) ?: 'pending',
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

        update_post_meta($booking_id, 'status', $status);

        return rest_ensure_response(['id' => $booking_id, 'status' => $status]);
    }
}
