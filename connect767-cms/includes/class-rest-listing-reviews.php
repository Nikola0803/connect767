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
