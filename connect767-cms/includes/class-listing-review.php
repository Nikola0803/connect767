<?php
/**
 * Moderation queue for listings submitted through the Add Listing wizard
 * (they land as `pending` — see class-rest-listings.php). Lets an admin
 * see what's waiting and Approve (publish) or Reject (trash) without
 * having to know WordPress's default post-status filters exist.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Listing_Review
{
    private static function can_approve_listings()
    {
        return current_user_can('edit_others_posts') || current_user_can('publish_posts');
    }

    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'add_menu']);
        add_action('admin_post_c767_review_listing', [__CLASS__, 'handle_action']);
        add_action('admin_post_c767_approve_listing', [__CLASS__, 'handle_row_approve']);
        add_filter('post_row_actions', [__CLASS__, 'add_approve_row_action'], 10, 2);
        add_filter('bulk_actions-edit-listing', [__CLASS__, 'add_bulk_approve_action']);
        add_filter('handle_bulk_actions-edit-listing', [__CLASS__, 'handle_bulk_approve'], 10, 3);
        add_action('admin_notices', [__CLASS__, 'show_approval_notice']);
    }

    /**
     * Put the most common moderation action directly in WordPress's Listings
     * table, beside Edit, Quick Edit, Trash, and Preview. It is intentionally
     * limited to pending listings and users who can publish that post.
     */
    public static function add_approve_row_action($actions, $post)
    {
        if (
            !$post
            || $post->post_type !== 'listing'
            || $post->post_status !== 'pending'
            || !self::can_approve_listings()
            || !current_user_can('edit_post', $post->ID)
        ) {
            return $actions;
        }

        $url = wp_nonce_url(
            admin_url('admin-post.php?action=c767_approve_listing&post_id=' . (int) $post->ID),
            'c767_approve_listing_' . (int) $post->ID
        );

        $actions['c767_approve'] = sprintf(
            '<a href="%s" style="color:#008a20;font-weight:600;" aria-label="%s">%s</a>',
            esc_url($url),
            esc_attr(sprintf('Approve and publish %s', $post->post_title)),
            esc_html__('Approve', 'connect767-cms')
        );

        return $actions;
    }

    public static function handle_row_approve()
    {
        $post_id = absint($_GET['post_id'] ?? 0);
        $post = $post_id ? get_post($post_id) : null;

        if (
            !$post
            || $post->post_type !== 'listing'
            || !self::can_approve_listings()
            || !current_user_can('edit_post', $post_id)
        ) {
            wp_die(esc_html__('You are not allowed to approve this listing.', 'connect767-cms'));
        }

        check_admin_referer('c767_approve_listing_' . $post_id);

        if ($post->post_status === 'pending') {
            $result = wp_update_post([
                'ID' => $post_id,
                'post_status' => 'publish',
            ], true);

            if (is_wp_error($result)) {
                wp_die(esc_html($result->get_error_message()));
            }

            do_action('c767_listing_approved', $post_id);
        }

        $redirect = wp_get_referer();
        if (!$redirect || strpos($redirect, admin_url()) !== 0) {
            $redirect = admin_url('edit.php?post_type=listing&post_status=pending');
        }

        wp_safe_redirect(add_query_arg('c767_approved', '1', $redirect));
        exit;
    }

    public static function add_bulk_approve_action($actions)
    {
        if (self::can_approve_listings()) {
            $actions['c767_approve_listings'] = esc_html__('Approve', 'connect767-cms');
        }

        return $actions;
    }

    public static function handle_bulk_approve($redirect_url, $action, $post_ids)
    {
        if ($action !== 'c767_approve_listings' || !self::can_approve_listings()) {
            return $redirect_url;
        }

        $approved = 0;
        foreach (array_map('absint', (array) $post_ids) as $post_id) {
            $post = get_post($post_id);
            if (
                !$post
                || $post->post_type !== 'listing'
                || $post->post_status !== 'pending'
                || !current_user_can('edit_post', $post_id)
            ) {
                continue;
            }

            $result = wp_update_post([
                'ID' => $post_id,
                'post_status' => 'publish',
            ], true);

            if (!is_wp_error($result)) {
                $approved++;
                do_action('c767_listing_approved', $post_id);
            }
        }

        return add_query_arg('c767_bulk_approved', $approved, $redirect_url);
    }

    public static function show_approval_notice()
    {
        $single_approved = isset($_GET['c767_approved']) && sanitize_key($_GET['c767_approved']) === '1';
        $bulk_approved = isset($_GET['c767_bulk_approved']) ? absint($_GET['c767_bulk_approved']) : null;

        if (!$single_approved && $bulk_approved === null) {
            return;
        }

        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || $screen->id !== 'edit-listing') {
            return;
        }
        ?>
        <div class="notice notice-success is-dismissible"><p>
            <?php
            if ($bulk_approved !== null) {
                printf(
                    esc_html(_n('%d listing approved and published.', '%d listings approved and published.', $bulk_approved, 'connect767-cms')),
                    esc_html($bulk_approved)
                );
            } else {
                esc_html_e('Listing approved and published.', 'connect767-cms');
            }
            ?>
        </p></div>
        <?php
    }

    public static function add_menu()
    {
        add_submenu_page(
            'connect767-cms',
            'Review Listings',
            'Review Listings',
            'edit_others_posts',
            'connect767-review-listings',
            [__CLASS__, 'render']
        );
    }

    public static function handle_action()
    {
        if (!current_user_can('edit_others_posts') || !check_admin_referer('c767_review_listing')) {
            wp_die('Not allowed.');
        }

        $post_id = (int) ($_POST['post_id'] ?? 0);
        $decision = sanitize_key($_POST['decision'] ?? '');
        $post = get_post($post_id);

        if ($post && $post->post_type === 'listing') {
            if ($decision === 'approve') {
                wp_update_post(['ID' => $post_id, 'post_status' => 'publish']);
                do_action('c767_listing_approved', $post_id);
            } elseif ($decision === 'reject') {
                wp_trash_post($post_id);
                do_action('c767_listing_rejected', $post_id);
            }
        }

        wp_safe_redirect(admin_url('admin.php?page=connect767-review-listings&reviewed=1'));
        exit;
    }

    public static function render()
    {
        $pending = get_posts([
            'post_type' => 'listing',
            'post_status' => 'pending',
            'numberposts' => -1,
            'orderby' => 'date',
            'order' => 'ASC',
        ]);
        ?>
        <div class="wrap">
            <h1>Review Listings</h1>
            <p class="description">Businesses submitted through the Add Listing wizard land here
                before they appear in the public directory.</p>

            <?php if (isset($_GET['reviewed'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Listing updated.</p></div>
            <?php endif; ?>

            <?php if (empty($pending)) : ?>
                <div class="notice notice-info"><p>Nothing waiting for review right now.</p></div>
            <?php else : ?>
                <table class="widefat striped">
                    <thead>
                        <tr>
                            <th>Business</th>
                            <th>Category</th>
                            <th>Tier</th>
                            <th>Payment</th>
                            <th>Location</th>
                            <th>Contact</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($pending as $post) :
                            $terms = get_the_terms($post->ID, 'listing_category');
                            $category_names = $terms && !is_wp_error($terms)
                                ? implode(', ', wp_list_pluck($terms, 'name'))
                                : '—';
                            $tier = get_post_meta($post->ID, 'tier', true) ?: 'Free';
                            $payment_status = get_post_meta($post->ID, 'payment_status', true) ?: 'n/a';
                            $location = get_post_meta($post->ID, 'location_display', true) ?: '—';
                            $phone = get_post_meta($post->ID, 'phone', true);
                            $email = get_post_meta($post->ID, 'email', true);
                            $author = get_userdata($post->post_author);
                            ?>
                            <tr>
                                <td>
                                    <strong>
                                        <a href="<?php echo esc_url(get_edit_post_link($post->ID)); ?>">
                                            <?php echo esc_html($post->post_title); ?>
                                        </a>
                                    </strong>
                                    <?php if ($post->post_content) : ?>
                                        <p class="description" style="max-width:320px;">
                                            <?php echo esc_html(wp_trim_words($post->post_content, 20)); ?>
                                        </p>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo esc_html($category_names); ?></td>
                                <td>
                                    <span class="c767-tier-badge c767-tier-<?php echo esc_attr(strtolower($tier)); ?>">
                                        <?php echo esc_html($tier); ?>
                                    </span>
                                </td>
                                <td>
                                    <?php if ($payment_status === 'n/a') : ?>
                                        <span aria-hidden="true">—</span>
                                    <?php else : ?>
                                        <span class="c767-payment-badge c767-payment-<?php echo esc_attr($payment_status); ?>">
                                            <?php echo esc_html(ucfirst($payment_status)); ?>
                                        </span>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo esc_html($location); ?></td>
                                <td>
                                    <?php if ($phone) : ?><div><?php echo esc_html($phone); ?></div><?php endif; ?>
                                    <?php if ($email) : ?><div><?php echo esc_html($email); ?></div><?php endif; ?>
                                    <?php if ($author) : ?><div class="description">by <?php echo esc_html($author->user_email); ?></div><?php endif; ?>
                                </td>
                                <td><?php echo esc_html(human_time_diff(strtotime($post->post_date), current_time('timestamp'))); ?> ago</td>
                                <td>
                                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                        <input type="hidden" name="action" value="c767_review_listing" />
                                        <input type="hidden" name="post_id" value="<?php echo esc_attr($post->ID); ?>" />
                                        <input type="hidden" name="decision" value="approve" />
                                        <?php wp_nonce_field('c767_review_listing'); ?>
                                        <button type="submit" class="button button-primary">Approve</button>
                                    </form>
                                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;" onsubmit="return confirm('Move this listing to trash?');">
                                        <input type="hidden" name="action" value="c767_review_listing" />
                                        <input type="hidden" name="post_id" value="<?php echo esc_attr($post->ID); ?>" />
                                        <input type="hidden" name="decision" value="reject" />
                                        <?php wp_nonce_field('c767_review_listing'); ?>
                                        <button type="submit" class="button">Reject</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <style>
            .c767-tier-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
            .c767-tier-classified { background: #d4edda; color: #155724; }
            .c767-tier-featured { background: #fff3cd; color: #856404; }
            .c767-tier-free { background: #e2e3e5; color: #383d41; }
            .c767-payment-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
            .c767-payment-paid { background: #d4edda; color: #155724; }
            .c767-payment-unpaid { background: #f8d7da; color: #721c24; }
        </style>
        <?php
    }
}
