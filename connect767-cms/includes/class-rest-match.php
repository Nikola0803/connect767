<?php
/**
 * POST /connect767/v1/match — server-side version of the "AI Matching" quiz
 * scoring. Deliberately mirrors src/lib/matching.js's weight tables and
 * formula line-for-line so behavior is identical whether the frontend is
 * running on local fixtures or against this live endpoint — nothing about
 * the ranking should change just because the backend went live.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Match
{
    const NAMESPACE_ = 'connect767/v1';

    private static function priority_weights()
    {
        return [
            'rating' => ['category' => 25, 'price' => 10, 'rating' => 30, 'tier' => 10, 'location' => 10],
            'value' => ['category' => 25, 'price' => 30, 'rating' => 10, 'tier' => 5, 'location' => 15],
            'location' => ['category' => 20, 'price' => 10, 'rating' => 10, 'tier' => 5, 'location' => 40],
            'top-tier' => ['category' => 20, 'price' => 10, 'rating' => 10, 'tier' => 35, 'location' => 10],
        ];
    }

    private static function default_weights()
    {
        return ['category' => 30, 'price' => 15, 'rating' => 20, 'tier' => 10, 'location' => 15];
    }

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/match', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'handle'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function handle(WP_REST_Request $request)
    {
        $criteria = [
            'categorySlug' => sanitize_key((string) $request->get_param('categorySlug')),
            'priceTiers' => array_map('sanitize_text_field', (array) $request->get_param('priceTiers')),
            'location' => sanitize_text_field((string) $request->get_param('location')),
            'priority' => sanitize_key((string) $request->get_param('priority')) ?: 'rating',
        ];

        $listings = self::fetch_mapped_listings();

        $weights = self::priority_weights()[$criteria['priority']] ?? self::default_weights();

        foreach ($listings as &$listing) {
            $listing['matchScore'] = self::score($listing, $criteria, $weights);
        }
        unset($listing);

        usort($listings, function ($a, $b) {
            return $b['matchScore'] <=> $a['matchScore'];
        });

        return rest_ensure_response($listings);
    }

    /**
     * Reuses the wp/v2/listing REST controller (via an internal request)
     * so matching results are serialized identically to a normal directory
     * fetch — same acf shape, same embedded terms — rather than
     * hand-rolling a second serializer that could drift out of sync.
     */
    private static function fetch_mapped_listings()
    {
        $internal = new WP_REST_Request('GET', '/wp/v2/listing');
        $internal->set_param('per_page', 100);
        $internal->set_param('status', 'publish');
        $internal->set_param('_embed', 1);

        $response = rest_do_request($internal);
        if ($response->is_error()) {
            return [];
        }

        $data = $response->get_data();
        $out = [];
        foreach ($data as $item) {
            $acf = $item['acf'] ?? [];
            $terms = $item['_embedded']['wp:term'] ?? [[]];
            $category_term = null;
            foreach ($terms as $group) {
                foreach ((array) $group as $term) {
                    if (($term['taxonomy'] ?? '') === 'listing_category') {
                        $category_term = $term;
                    }
                }
            }

            $out[] = [
                'id' => $item['id'],
                'slug' => $item['slug'],
                'title' => $item['title']['rendered'] ?? '',
                'categorySlug' => $category_term['slug'] ?? ($acf['category_slug'] ?? ''),
                'price' => $acf['price_tier'] ?? '$',
                'badge' => $acf['tier'] ?? 'Free',
                'rating' => $acf['rating'] ?? 0,
                'location' => $acf['location'] ?? '',
            ];
        }
        return $out;
    }

    private static function score($listing, $criteria, $weights)
    {
        $score = 0;
        $max = 0;

        if (!empty($criteria['categorySlug'])) {
            $max += $weights['category'];
            if (($listing['categorySlug'] ?? '') === $criteria['categorySlug']) {
                $score += $weights['category'];
            }
        }

        if (!empty($criteria['priceTiers'])) {
            $max += $weights['price'];
            if (in_array($listing['price'] ?? '', $criteria['priceTiers'], true)) {
                $score += $weights['price'];
            }
        }

        $max += $weights['rating'];
        $rating = min((float) ($listing['rating'] ?? 0), 5);
        $score += ($rating / 5) * $weights['rating'];

        $max += $weights['tier'];
        if (($listing['badge'] ?? '') === 'Classified') {
            $score += $weights['tier'];
        } elseif (($listing['badge'] ?? '') === 'Featured') {
            $score += $weights['tier'] * 0.6;
        }

        $trimmed_location = trim($criteria['location']);
        if ($trimmed_location !== '') {
            $max += $weights['location'];
            $needle = mb_strtolower($trimmed_location);
            $haystack = mb_strtolower($listing['location'] ?? '');
            if (str_contains($haystack, $needle)) {
                $score += $weights['location'];
            }
        }

        if ($max === 0) {
            return 50;
        }

        $pct = ($score / $max) * 100;
        return (int) round(max(5, min(99, $pct)));
    }
}
