<?php
/**
 * POST /connect767/v1/listings/{slug}/reviews — public review submission for
 * src/components/ListingProfile.jsx's ReviewForm. This route never existed
 * on the backend at all (only class-listing-review.php's admin moderation
 * queue for whole listing *submissions* did), which is why every review
 * attempt hit a 404 and the form showed "Couldn't submit your review right
 * now" — see repository.js's submitListingReview(), which POSTs here.
 *
 * No login required, same as uniform-quotes/product-quotes — bot mitigation
 * for this form is the client-side honeypot + arithmetic challenge in
 * ListingProfile.jsx (deliberately token-free per the original request).
 *
 * Reviews are appended straight to the `reviews` meta (same JSON-encoded
 * shape class-meta-fields.php's repeater already uses, so they also show up
 * in the normal wp-admin "Listing Details" box), and `rating`/`review_count`
 * are recalculated so the directory card and listing header remain correct
 * immediately without waiting on an admin to hit Approve.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Rest_Listing_Reviews
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/listings/(?P<slug>[a-zA-Z0-9-_]+)/reviews', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'submit'],
            'permission_callback' => '__return_true',
            'args' => [
                'slug' => ['required' => true],
            ],
        ]);

        register_rest_route(self::NAMESPACE_, '/storefronts/(?P<slug>[a-zA-Z0-9-_]+)/reviews', [
            [
                'methods' => 'GET',
                'callback' => [__CLASS__, 'storefront_reviews'],
                'permission_callback' => '__return_true',
            ],
            [
                'methods' => 'POST',
                'callback' => [__CLASS__, 'submit_storefront_review'],
                'permission_callback' => '__return_true',
            ],
        ]);
    }

    private static function storefront_listing($slug)
    {
        $post = get_page_by_path(sanitize_title((string) $slug), OBJECT, 'listing');
        return $post && $post->post_status === 'publish' ? $post : null;
    }

    private static function storefront_review_rows($post_id)
    {
        $rows = json_decode((string) get_post_meta($post_id, 'storefront_reviews', true), true);
        return is_array($rows) ? $rows : [];
    }

    public static function storefront_reviews(WP_REST_Request $request)
    {
        $post = self::storefront_listing($request->get_param('slug'));
        if (!$post) {
            return new WP_Error('c767_storefront_not_found', 'Storefront not found.', ['status' => 404]);
        }
        return rest_ensure_response(array_reverse(self::storefront_review_rows($post->ID)));
    }

    public static function submit_storefront_review(WP_REST_Request $request)
    {
        $post = self::storefront_listing($request->get_param('slug'));
        if (!$post) {
            return new WP_Error('c767_storefront_not_found', 'Storefront not found.', ['status' => 404]);
        }

        $name = sanitize_text_field((string) $request->get_param('name'));
        $text = sanitize_textarea_field((string) $request->get_param('text'));
        $rating = max(1, min(5, (int) $request->get_param('stars')));
        if ($name === '' || $text === '') {
            return new WP_Error('c767_missing_storefront_review_fields', 'Name, rating, and review text are required.', ['status' => 400]);
        }

        $rows = self::storefront_review_rows($post->ID);
        $entry = [
            'id' => 'store-review-' . wp_generate_uuid4(),
            'name' => $name,
            'rating' => $rating,
            'text' => $text,
            'submittedAt' => current_time('mysql'),
        ];
        $rows[] = $entry;
        update_post_meta($post->ID, 'storefront_reviews', wp_json_encode($rows));
        update_post_meta($post->ID, 'storefront_review_count', count($rows));
        update_post_meta($post->ID, 'storefront_rating', round(array_sum(array_column($rows, 'rating')) / count($rows), 1));

        do_action('c767_storefront_review_submitted', $post->ID, $entry);
        return rest_ensure_response($entry);
    }

    public static function submit(WP_REST_Request $request)
    {
        $slug = sanitize_title((string) $request->get_param('slug'));
        $post = get_page_by_path($slug, OBJECT, 'listing');
        if (!$post || $post->post_status !== 'publish') {
            return new WP_Error('c767_listing_not_found', 'Listing not found.', ['status' => 404]);
        }

        $name = sanitize_text_field((string) $request->get_param('name'));
        $text = sanitize_textarea_field((string) $request->get_param('text'));
        $stars = (int) $request->get_param('stars');
        $stars = $stars > 0 ? max(1, min(5, $stars)) : 5;

        if ($name === '' || $text === '') {
            return new WP_Error('c767_missing_fields', 'Name and review text are required.', ['status' => 400]);
        }

        $raw = get_post_meta($post->ID, 'reviews', true);
        $reviews = json_decode($raw, true);
        $reviews = is_array($reviews) ? $reviews : [];

        $entry = [
            'name' => $name,
            'time' => 'Just now',
            'stars' => $stars,
            'text' => $text,
        ];
        $reviews[] = $entry;
        update_post_meta($post->ID, 'reviews', wp_json_encode($reviews));

        $count = count($reviews);
        $average = $count ? array_sum(array_column($reviews, 'stars')) / $count : 0;
        update_post_meta($post->ID, 'review_count', (string) $count);
        update_post_meta($post->ID, 'rating', number_format($average, 1));

        do_action('c767_listing_review_submitted', $post->ID, $name, $stars);

        return rest_ensure_response([
            'status' => 'published',
            'review' => $entry,
            'reviewCount' => $count,
            'rating' => number_format($average, 1),
        ]);
    }
}
