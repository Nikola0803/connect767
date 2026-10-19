<?php
/**
 * Annually increments every listing's `years_experience` meta on January 1st.
 * Registered as a WP-Cron event; fires once per year via the custom
 * `c767_yearly` schedule added here.
 *
 * The cron fires at midnight UTC on Jan 1st (WP stores timestamps as UTC).
 * Only listings with a numeric `years_experience` value are touched — listings
 * that left the field blank stay blank so the profile keeps showing nothing
 * rather than an incorrect "1 Yr Exp." badge after the first increment.
 */
class C767_Experience_Cron
{
    const HOOK     = 'c767_increment_years_experience';
    const SCHEDULE = 'c767_yearly';

    public static function init(): void
    {
        add_filter('cron_schedules', [__CLASS__, 'add_yearly_schedule']);
        add_action('wp', [__CLASS__, 'schedule_event']);
        add_action(self::HOOK, [__CLASS__, 'run']);
    }

    public static function add_yearly_schedule(array $schedules): array
    {
        if (!isset($schedules[self::SCHEDULE])) {
            $schedules[self::SCHEDULE] = [
                'interval' => YEAR_IN_SECONDS,
                'display'  => __('Once a year', 'connect767-cms'),
            ];
        }
        return $schedules;
    }

    /**
     * Schedule the first event at the next January 1st 00:00 UTC, then let
     * WP-Cron repeat it annually via the interval above.
     */
    public static function schedule_event(): void
    {
        if (wp_next_scheduled(self::HOOK)) {
            return;
        }

        // Find the next Jan 1st midnight UTC from now.
        $now  = current_time('timestamp', true); // UTC
        $year = (int) gmdate('Y', $now);
        $next = mktime(0, 0, 0, 1, 1, $year + 1); // Jan 1 next year, UTC

        wp_schedule_event($next, self::SCHEDULE, self::HOOK);
    }

    /**
     * Query all published listings that have a numeric years_experience and
     * increment each one by 1. Runs in batches of 200 to stay within
     * typical PHP memory limits even on large directories.
     */
    public static function run(): void
    {
        $offset = 0;
        $batch  = 200;

        do {
            $posts = get_posts([
                'post_type'      => 'listing',
                'post_status'    => 'publish',
                'posts_per_page' => $batch,
                'offset'         => $offset,
                'fields'         => 'ids',
                'meta_query'     => [[
                    'key'     => 'years_experience',
                    'compare' => 'EXISTS',
                ]],
            ]);

            foreach ($posts as $id) {
                $current = get_post_meta($id, 'years_experience', true);
                if (is_numeric($current)) {
                    update_post_meta($id, 'years_experience', (string)((int) $current + 1));
                }
            }

            $offset += $batch;
        } while (count($posts) === $batch);
    }
}
