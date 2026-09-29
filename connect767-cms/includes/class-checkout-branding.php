<?php
/**
 * Real Connect767 branding for WooCommerce's own native cart/checkout/
 * my-account pages. These render through whatever WordPress theme is
 * active on the backend — completely separate from the React frontend's
 * build — so without this they're fully unstyled default WooCommerce
 * markup with no relation to the rest of the site. Scoped tightly to only
 * WooCommerce's own pages via is_cart()/is_checkout()/is_account_page(),
 * so it can never leak into anything else on the WordPress install.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Checkout_Branding
{
    public static function init()
    {
        if (!class_exists('WooCommerce')) {
            return;
        }
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue']);
        add_action('woocommerce_before_cart', [__CLASS__, 'render_header_bar']);
        add_action('woocommerce_before_checkout_form', [__CLASS__, 'render_header_bar']);
        add_action('woocommerce_account_navigation', [__CLASS__, 'render_header_bar'], 0);
        add_filter('woocommerce_locate_template', [__CLASS__, 'override_template'], 100, 3);
    }

    /**
     * `wc_locate_template()` checks the *active theme's* directory before
     * this filter ever runs — meaning a theme with its own opinionated
     * `checkout/form-pay.php` (as turned out to be the actual case here)
     * wins over a plain CSS override every time, no matter how many
     * `!important`s get added. This filter fires *after* that lookup and
     * can still override the result, so returning our own file path here
     * forces the branded template regardless of what the theme does with
     * this specific page. Only the pay-for-order page is overridden for
     * now — the highest-visibility, most critical step (it's the actual
     * payment screen) — not every WooCommerce template.
     */
    public static function override_template($template, $template_name, $template_path)
    {
        if ($template_name === 'checkout/form-pay.php') {
            $override = C767_PLUGIN_DIR . 'templates/woocommerce/checkout/form-pay.php';
            if (file_exists($override)) {
                return $override;
            }
        }
        return $template;
    }

    private static function is_relevant_page()
    {
        return function_exists('is_cart') && (is_cart() || is_checkout() || is_account_page());
    }

    public static function enqueue()
    {
        if (!self::is_relevant_page()) {
            return;
        }

        wp_enqueue_style(
            'c767-google-fonts',
            'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&family=Manrope:wght@400;600;700&display=swap',
            [],
            null
        );

        wp_enqueue_style(
            'c767-checkout-branding',
            plugins_url('assets/css/woocommerce-branding.css', C767_PLUGIN_FILE),
            [],
            C767_VERSION
        );
    }

    /**
     * A simple bar linking back to the real site — without this, landing
     * on checkout from the React app feels like arriving on a completely
     * separate, unbranded site with no way back to where you came from.
     * Hooked onto three different actions since cart/checkout/my-account
     * each fire different template hooks; harmless if more than one fires
     * on a given page since they render identical markup.
     */
    public static function render_header_bar()
    {
        static $rendered = false;
        if ($rendered || !self::is_relevant_page()) {
            return;
        }
        $rendered = true;
        $shop_url = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : home_url('/');
        ?>
        <div class="c767-checkout-bar">
            <a href="<?php echo esc_url($shop_url); ?>">
                Connect<span class="c767-accent">767</span>
            </a>
        </div>
        <?php
    }
}
