<?php
/**
 * Connect767-branded override of WooCommerce's checkout/form-pay.php.
 *
 * Forced into use via the `woocommerce_locate_template` filter in
 * class-checkout-branding.php, which fires *after* WooCommerce's normal
 * template lookup (which checks the active theme first) — so this wins
 * regardless of what the active theme does with this page, rather than
 * hoping a CSS override beats an unknown theme's own specificity. That
 * approach (a plain stylesheet) turned out not to be enough once it was
 * clear a real, opinionated premium theme was also targeting this page.
 *
 * Deliberately keeps WooCommerce's own real hooks, field names, and form
 * action exactly as the original template — this only changes the
 * *presentation*, not how payment actually gets processed, since that's
 * still WooCommerce's job and shouldn't be reinvented here.
 *
 * @var WC_Order $order
 */

defined('ABSPATH') || exit;

do_action('woocommerce_before_pay');
?>

<div class="c767-pay-page">
    <div class="c767-pay-card">
        <h1 class="c767-pay-title">Complete your order</h1>
        <p class="c767-pay-subtitle">Order #<?php echo esc_html($order->get_order_number()); ?></p>

        <?php if ($order->needs_payment()) : ?>

            <?php do_action('woocommerce_before_pay_table'); ?>

            <table class="c767-pay-table">
                <thead>
                    <tr>
                        <th><?php esc_html_e('Product', 'woocommerce'); ?></th>
                        <th><?php esc_html_e('Qty', 'woocommerce'); ?></th>
                        <th class="c767-align-right"><?php esc_html_e('Total', 'woocommerce'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($order->get_items() as $item_id => $item) : ?>
                        <tr>
                            <td>
                                <?php
                                echo wp_kses_post(apply_filters('woocommerce_order_item_name', $item->get_name(), $item, false));
                                ?>
                            </td>
                            <td><?php echo esc_html($item->get_quantity()); ?></td>
                            <td class="c767-align-right">
                                <?php echo wp_kses_post($order->get_formatted_line_subtotal($item)); ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
                <tfoot>
                    <?php foreach ($order->get_order_item_totals() as $key => $total) : ?>
                        <tr class="<?php echo esc_attr($key === 'order_total' ? 'c767-grand-total' : ''); ?>">
                            <th colspan="2"><?php echo esc_html($total['label']); ?></th>
                            <td class="c767-align-right"><?php echo wp_kses_post($total['value']); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tfoot>
            </table>

            <?php do_action('woocommerce_after_pay_table'); ?>

            <?php
            $available_gateways = WC()->payment_gateways->get_available_payment_gateways();
            if ($available_gateways) {
                current($available_gateways)->set_current();
            }
            ?>

            <form id="order_review" method="post" class="c767-pay-form">
                <div id="payment" class="c767-payment-box">
                    <?php if ($available_gateways) : ?>
                        <ul class="c767-payment-methods">
                            <?php foreach ($available_gateways as $gateway) : ?>
                                <li class="c767-payment-method">
                                    <label>
                                        <input
                                            type="radio"
                                            name="payment_method"
                                            class="c767-payment-radio"
                                            value="<?php echo esc_attr($gateway->id); ?>"
                                            <?php checked($gateway->chosen ? $gateway->chosen : ($gateway === current($available_gateways)), true); ?>
                                        />
                                        <span class="c767-payment-title">
                                            <?php echo wp_kses_post($gateway->get_title()); ?>
                                            <?php echo wp_kses_post($gateway->get_icon()); ?>
                                        </span>
                                    </label>
                                    <?php if ($gateway->has_fields() || $gateway->get_description()) : ?>
                                        <div class="c767-payment-fields">
                                            <?php $gateway->payment_fields(); ?>
                                        </div>
                                    <?php endif; ?>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else : ?>
                        <div class="c767-notice c767-notice-info">
                            <?php
                            if (wc_get_page_id('shop') > 0) {
                                printf(
                                    /* translators: %s: shop page link */
                                    wp_kses_post(__('Sorry, it seems that there are no available payment methods. Please <a href="%s">contact us</a> if you require assistance or wish to make alternate arrangements.', 'woocommerce')),
                                    esc_url(wc_get_page_permalink('shop'))
                                );
                            } else {
                                esc_html_e('Sorry, it seems that there are no available payment methods for your location. Please contact us if you require assistance or wish to make alternate arrangements.', 'woocommerce');
                            }
                            ?>
                        </div>
                    <?php endif; ?>
                </div>

                <?php if ($available_gateways) : ?>
                    <div class="c767-pay-actions">
                        <input type="hidden" name="woocommerce_pay" value="1" />
                        <?php wp_nonce_field('woocommerce-pay', 'woocommerce-pay-nonce'); ?>
                        <button type="submit" class="c767-pay-button" id="place_order" value="<?php echo esc_attr($order->get_id()); ?>">
                            <?php
                            printf(
                                /* translators: %s: order total */
                                esc_html__('Pay %s', 'woocommerce'),
                                wp_kses_post($order->get_formatted_order_total())
                            );
                            ?>
                        </button>
                    </div>
                <?php endif; ?>
            </form>

        <?php else : ?>

            <div class="c767-notice c767-notice-success">
                <?php esc_html_e('This order has already been paid for.', 'woocommerce'); ?>
            </div>
            <?php do_action('woocommerce_thankyou_' . $order->get_payment_method(), $order->get_id()); ?>

        <?php endif; ?>
    </div>
</div>

<?php do_action('woocommerce_after_pay'); ?>
