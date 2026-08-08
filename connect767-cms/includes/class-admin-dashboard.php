<?php
/**
 * The "where do I actually manage content" answer: a proper dashboard
 * under the Connect767 admin menu with live counts, a pending-listings
 * queue, and direct links into everything — instead of expecting the
 * admin to already know that Listings/Quote Requests/Products are separate
 * stock WP post-type screens.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Admin_Dashboard
{
    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'add_menu'], 5);
    }

    public static function add_menu()
    {
        add_menu_page(
            'Connect767',
            'Connect767',
            'manage_options',
            'connect767-cms',
            [__CLASS__, 'render'],
            'dashicons-store',
            3
        );

        add_submenu_page(
            'connect767-cms',
            'Dashboard',
            'Dashboard',
            'manage_options',
            'connect767-cms',
            [__CLASS__, 'render']
        );
    }

    private static function count($post_type, $status = 'publish')
    {
        $counts = wp_count_posts($post_type);
        return isset($counts->$status) ? (int) $counts->$status : 0;
    }

    public static function render()
    {
        $pending_listings = self::count('listing', 'pending');
        $published_listings = self::count('listing', 'publish');
        $quote_requests = self::count('uniform_quote', 'private');
        $blog_posts = self::count('post', 'publish');
        $templates = self::count('uniform_template', 'publish');
        $has_woocommerce = class_exists('WooCommerce');
        $products = $has_woocommerce ? self::count('product', 'publish') : null;
        ?>
        <div class="wrap c767-dashboard">
            <h1>Connect767 Content Management</h1>
            <p class="description">This is the home base for everything the frontend reads from —
                listings, uniform templates, blog posts, quote requests<?php echo $has_woocommerce ? ', and shop products' : ''; ?>.</p>

            <?php if ($pending_listings > 0) : ?>
                <div class="notice notice-warning" style="margin: 16px 0;">
                    <p>
                        <strong><?php echo esc_html($pending_listings); ?> listing<?php echo $pending_listings === 1 ? '' : 's'; ?></strong>
                        submitted through the Add Listing wizard <?php echo $pending_listings === 1 ? 'is' : 'are'; ?> waiting for review.
                        <a href="<?php echo esc_url(admin_url('admin.php?page=connect767-review-listings')); ?>" class="button button-primary" style="margin-left:10px;">
                            Review now
                        </a>
                    </p>
                </div>
            <?php endif; ?>

            <div class="c767-stat-grid">
                <a class="c767-stat-card" href="<?php echo esc_url(admin_url('edit.php?post_type=listing')); ?>">
                    <span class="c767-stat-number"><?php echo esc_html($published_listings); ?></span>
                    <span class="c767-stat-label">Published listings</span>
                </a>
                <a class="c767-stat-card <?php echo $pending_listings ? 'is-alert' : ''; ?>" href="<?php echo esc_url(admin_url('admin.php?page=connect767-review-listings')); ?>">
                    <span class="c767-stat-number"><?php echo esc_html($pending_listings); ?></span>
                    <span class="c767-stat-label">Pending review</span>
                </a>
                <a class="c767-stat-card" href="<?php echo esc_url(admin_url('edit.php?post_type=uniform_quote')); ?>">
                    <span class="c767-stat-number"><?php echo esc_html($quote_requests); ?></span>
                    <span class="c767-stat-label">Uniform quote requests</span>
                </a>
                <a class="c767-stat-card" href="<?php echo esc_url(admin_url('edit.php?post_type=uniform_template')); ?>">
                    <span class="c767-stat-number"><?php echo esc_html($templates); ?></span>
                    <span class="c767-stat-label">Uniform templates</span>
                </a>
                <a class="c767-stat-card" href="<?php echo esc_url(admin_url('edit.php')); ?>">
                    <span class="c767-stat-number"><?php echo esc_html($blog_posts); ?></span>
                    <span class="c767-stat-label">Blog posts</span>
                </a>
                <?php if ($has_woocommerce) : ?>
                    <a class="c767-stat-card" href="<?php echo esc_url(admin_url('edit.php?post_type=product')); ?>">
                        <span class="c767-stat-number"><?php echo esc_html($products); ?></span>
                        <span class="c767-stat-label">Shop products</span>
                    </a>
                <?php else : ?>
                    <div class="c767-stat-card is-disabled">
                        <span class="c767-stat-number">—</span>
                        <span class="c767-stat-label">Shop products (install WooCommerce)</span>
                    </div>
                <?php endif; ?>
            </div>

            <h2>Manage content</h2>
            <table class="widefat striped c767-links-table">
                <tbody>
                    <tr>
                        <td><strong>Listings (Directory)</strong><br /><span class="description">Business listings shown on /listings — category, tier, contact info, gallery, reviews.</span></td>
                        <td>
                            <a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=listing')); ?>">View all</a>
                            <a class="button" href="<?php echo esc_url(admin_url('post-new.php?post_type=listing')); ?>">Add new</a>
                            <a class="button button-primary" href="<?php echo esc_url(admin_url('admin.php?page=connect767-review-listings')); ?>">Review pending (<?php echo esc_html($pending_listings); ?>)</a>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Categories &amp; Industries</strong><br /><span class="description">The 7-category / 191-industry taxonomy used across the directory, Add Listing wizard, and AI Matching.</span></td>
                        <td><a class="button" href="<?php echo esc_url(admin_url('edit-tags.php?taxonomy=listing_category&post_type=listing')); ?>">Manage taxonomy</a></td>
                    </tr>
                    <tr>
                        <td><strong>Uniform Studio Templates</strong><br /><span class="description">The template gallery shown in the Uniform Studio customizer.</span></td>
                        <td>
                            <a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=uniform_template')); ?>">View all</a>
                            <a class="button" href="<?php echo esc_url(admin_url('post-new.php?post_type=uniform_template')); ?>">Add new</a>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Uniform Quote Requests</strong><br /><span class="description">Roster + design submissions from the Uniform Studio, including the exported design preview.</span></td>
                        <td><a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=uniform_quote')); ?>">View all</a></td>
                    </tr>
                    <tr>
                        <td><strong>Blog Posts</strong><br /><span class="description">Standard WordPress posts — the frontend reads reading_time, author_key, tags, and body from the custom fields below the editor.</span></td>
                        <td>
                            <a class="button" href="<?php echo esc_url(admin_url('edit.php')); ?>">View all</a>
                            <a class="button" href="<?php echo esc_url(admin_url('post-new.php')); ?>">Add new</a>
                        </td>
                    </tr>
                    <?php if ($has_woocommerce) : ?>
                        <tr>
                            <td><strong>Shop Products</strong><br /><span class="description">Standard WooCommerce products. Category "icon" field is under each Product Category's edit screen.</span></td>
                            <td>
                                <a class="button" href="<?php echo esc_url(admin_url('edit.php?post_type=product')); ?>">View all</a>
                                <a class="button" href="<?php echo esc_url(admin_url('edit-tags.php?taxonomy=product_cat&post_type=product')); ?>">Categories</a>
                            </td>
                        </tr>
                    <?php endif; ?>
                    <tr>
                        <td><strong>Sample content</strong><br /><span class="description">One-click seed matching what the frontend shows locally — safe to re-run.</span></td>
                        <td><a class="button" href="<?php echo esc_url(admin_url('admin.php?page=connect767-import')); ?>">Go to importer</a></td>
                    </tr>
                </tbody>
            </table>

            <h2>REST API</h2>
            <p>Base URL for the frontend's <code>VITE_WP_BASE_URL</code>:
                <code><?php echo esc_url(home_url()); ?></code></p>
            <ul style="list-style:disc;padding-left:20px;">
                <li><code>GET /wp-json/wp/v2/listing</code> — directory</li>
                <li><code>GET /wp-json/wp/v2/posts</code> — blog</li>
                <li><code>GET /wp-json/wc/v3/products</code> — shop (requires WooCommerce)</li>
                <li><code>POST /wp-json/connect767/v1/auth/register</code> / <code>/auth/login</code></li>
                <li><code>POST /wp-json/connect767/v1/match</code> — AI matching</li>
                <li><code>POST /wp-json/connect767/v1/listings</code> — Add Listing wizard (auth required)</li>
                <li><code>POST /wp-json/connect767/v1/uniform-quotes</code> — Uniform Studio quote requests</li>
                <li><code>POST /wp-json/connect767/v1/checkout</code> — headless WooCommerce checkout</li>
            </ul>
        </div>

        <style>
            .c767-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 20px 0 30px; }
            .c767-stat-card { display: flex; flex-direction: column; gap: 4px; background: #fff; border: 1px solid #dcdcde; border-radius: 6px; padding: 18px; text-decoration: none; transition: box-shadow .15s ease, border-color .15s ease; }
            .c767-stat-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); border-color: #2271b1; }
            .c767-stat-card.is-alert { border-color: #d63638; background: #fcf0f1; }
            .c767-stat-card.is-disabled { opacity: .6; }
            .c767-stat-number { font-size: 28px; font-weight: 600; color: #1d2327; line-height: 1.1; }
            .c767-stat-label { font-size: 13px; color: #646970; }
            .c767-links-table td { vertical-align: middle; padding: 14px 12px; }
            .c767-links-table .button { margin-right: 6px; }
        </style>
        <?php
    }
}
