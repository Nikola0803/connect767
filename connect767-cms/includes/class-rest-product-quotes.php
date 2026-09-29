<?php
/**
 * POST /connect767/v1/product-quotes — the shop Product Customizer's
 * "Request order" submission (src/pages/ProductCustomizerPage.jsx). Same
 * pattern as class-rest-uniform-quotes.php: stores the full design state
 * as a private `product_quote` post and emails the site admin, rather than
 * trying to re-render the design server-side — the client-generated PNG
 * preview is stored as-is.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_REST_Product_Quotes
{
    const NAMESPACE_ = 'connect767/v1';

    public static function init()
    {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
    }

    public static function register_routes()
    {
        register_rest_route(self::NAMESPACE_, '/product-quotes', [
            'methods' => 'POST',
            'callback' => [__CLASS__, 'submit'],
            'permission_callback' => '__return_true',
        ]);
    }

    public static function submit(WP_REST_Request $request)
    {
        $product_type = sanitize_text_field((string) $request->get_param('productType'));
        $quantity = max(1, (int) $request->get_param('quantity'));
        $layers = $request->get_param('layers');

        if (empty($layers)) {
            return new WP_Error('c767_empty_design', 'Add at least one text or artwork layer before requesting an order.', ['status' => 400]);
        }

        $title = sprintf(
            '%s — qty %d — %s',
            $product_type ?: 'Custom product',
            $quantity,
            current_time('Y-m-d H:i')
        );

        $post_id = wp_insert_post([
            'post_type' => 'product_quote',
            'post_status' => 'private',
            'post_title' => $title,
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('c767_quote_failed', $post_id->get_error_message(), ['status' => 400]);
        }

        $payload = [
            'productType' => $product_type,
            'color' => sanitize_text_field((string) $request->get_param('color')),
            'quantity' => $quantity,
            'sizes' => sanitize_text_field((string) $request->get_param('sizes')),
            'layers' => $layers,
        ];

        update_post_meta($post_id, 'quote_payload', wp_json_encode($payload));
        update_post_meta($post_id, 'quantity', $quantity);

        // The preview image is a large base64 PNG from html-to-image — store
        // it as its own meta key so it's easy to skip when just listing orders.
        $preview = (string) $request->get_param('previewImage');
        if ($preview) {
            update_post_meta($post_id, 'preview_image', $preview);
        }

        $email = sanitize_email((string) $request->get_param('email'));
        if ($email) {
            update_post_meta($post_id, 'contact_email', $email);
        }

        $user = get_user_by('id', get_current_user_id());
        $to = get_option('admin_email');
        $subject = sprintf('[Connect767] New custom product order — %s x%d', $product_type ?: 'product', $quantity);
        $body = sprintf(
            "Product: %s\nQuantity: %d\nContact: %s\nSubmitted by: %s\n\nView in wp-admin: %s",
            $product_type ?: 'Custom product',
            $quantity,
            $email ?: 'not provided',
            $user ? $user->user_email : 'Guest',
            admin_url('post.php?post=' . $post_id . '&action=edit')
        );
        wp_mail($to, $subject, $body);

        do_action('c767_product_quote_submitted', $post_id);

        return rest_ensure_response([
            'id' => $post_id,
            'message' => "We've received your order request.",
        ]);
    }
}
