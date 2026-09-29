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
    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'add_menu']);
        add_action('admin_post_c767_review_listing', [__CLASS__, 'handle_action']);
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
