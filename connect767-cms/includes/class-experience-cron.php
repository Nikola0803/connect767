<?php
/**
 * Migrates legacy experience values to the date-based model.
 *
 * Older plugin versions incremented `years_experience` with a yearly
 * WP-Cron event. The current value is now a baseline and the public total is
 * calculated from `years_experience_as_of_year` whenever a listing is read.
 * This stays correct even when WP-Cron is late or disabled.
 */
class C767_Experience_Cron
{
    const LEGACY_HOOK = 'c767_increment_years_experience';
    const MIGRATION_OPTION = 'c767_experience_baseline_v1';

    public static function init(): void
    {
        add_action('init', [__CLASS__, 'migrate_legacy_values'], 20);
        add_action(self::LEGACY_HOOK, [__CLASS__, 'migrate_legacy_values']);
    }

    public static function migrate_legacy_values(): void
    {
        // Stop the former annual increment from double-counting now that the
        // displayed value is derived from a dated baseline.
        if (wp_next_scheduled(self::LEGACY_HOOK)) {
            wp_clear_scheduled_hook(self::LEGACY_HOOK);
        }

        if (get_option(self::MIGRATION_OPTION)) {
            return;
        }

        $current_year = (int) gmdate('Y');

        do {
            $posts = get_posts([
                'post_type'      => 'listing',
                'post_status'    => 'any',
                'posts_per_page' => 200,
                'fields'         => 'ids',
                'meta_query'     => [
                    'relation' => 'AND',
                    [
                        'key'     => 'years_experience',
                        'compare' => 'EXISTS',
                    ],
                    [
                        'key'     => 'years_experience_as_of_year',
                        'compare' => 'NOT EXISTS',
                    ],
                ],
            ]);

            foreach ($posts as $id) {
                update_post_meta($id, 'years_experience_as_of_year', $current_year);
            }
        } while (count($posts) === 200);

        update_option(self::MIGRATION_OPTION, $current_year, false);
    }
}
