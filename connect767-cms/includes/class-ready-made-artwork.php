<?php
if (!defined('ABSPATH')) exit;

/** Customer-supplied ready-made artwork stays private on the WooCommerce order. */
class C767_Ready_Made_Artwork
{
    const META_KEY = '_c767_ready_made_artwork';
    const MAX_FILES = 10;
    const MAX_TOTAL_BYTES = 10485760;

    public static function init()
    {
        add_action('woocommerce_admin_order_data_after_order_details', [__CLASS__, 'render_order_files']);
        add_action('admin_post_c767_ready_made_artwork', [__CLASS__, 'download_order_file']);
    }

    public static function validate($files, array $designs)
    {
        if (!is_array($files) || count($files) > self::MAX_FILES) {
            return new WP_Error('c767_artwork_count', 'Attach up to 10 files.', ['status' => 400]);
        }
        if ($files && !$designs) return new WP_Error('c767_artwork_order', 'Artwork must accompany a ready-made uniform order.', ['status' => 400]);
        $clean = [];
        $total = 0;
        foreach (array_values($files) as $row) {
            if (!is_array($row)) return new WP_Error('c767_artwork_invalid', 'One of the artwork files is invalid.', ['status' => 400]);
            $file = C767_REST_Uniform_Quotes::sanitize_collar_attachment($row);
            if (!$file) return new WP_Error('c767_artwork_file', 'Upload valid PNG, JPG, WebP or PDF artwork, up to 2 MB per file.', ['status' => 400]);
            $total += $file['size'];
            if ($total > self::MAX_TOTAL_BYTES) return new WP_Error('c767_artwork_size', 'Keep all attachments at or below 10 MB combined.', ['status' => 400]);
            $kind = (string) ($row['kind'] ?? 'team');
            if (!in_array($kind, ['team', 'sponsor', 'other'], true)) return new WP_Error('c767_artwork_kind', 'Choose Team Logo, Sponsor or Other File for each attachment.', ['status' => 400]);
            $slug = sanitize_title((string) ($row['productSlug'] ?? ''));
            if ($slug !== '' && !isset($designs[$slug])) return new WP_Error('c767_artwork_design', 'An artwork file refers to a design that is not in this order.', ['status' => 400]);
            $clean[] = array_merge($file, [
                'kind' => $kind,
                'productSlug' => $slug,
                'productTitle' => $slug !== '' ? sanitize_text_field($designs[$slug]) : '',
                'notes' => mb_substr(sanitize_textarea_field((string) ($row['notes'] ?? '')), 0, 500),
            ]);
        }
        return $clean;
    }

    public static function store(WC_Order $order, array $files)
    {
        if (!$files) return;
        $order->update_meta_data(self::META_KEY, wp_json_encode($files));
        $order->update_meta_data('Team Logo, Sponsors or Other Files', count($files) . ' file(s) attached');
        $lines = array_map(function ($file) {
            $label = $file['kind'] === 'team' ? 'Team Logo' : ($file['kind'] === 'sponsor' ? 'Sponsor' : 'Other File');
            return $label . ': ' . $file['name']
                . ' — ' . ($file['productTitle'] ?: 'All designs')
                . ($file['notes'] !== '' ? ' — ' . $file['notes'] : '');
        }, $files);
        $order->add_order_note("Team Logo, Sponsors or Other Files:\n" . implode("\n", $lines), false);
    }

    private static function files($order)
    {
        $stored = $order->get_meta(self::META_KEY);
        $files = is_array($stored) ? $stored : json_decode((string) $stored, true);
        return is_array($files) ? array_values($files) : [];
    }

    /** Return only email-safe attachment metadata; never expose stored file bytes or data URLs. */
    public static function order_file_summaries($order)
    {
        return array_map(function ($file) {
            $kind = (string) ($file['kind'] ?? 'other');
            return [
                'name' => sanitize_file_name((string) ($file['name'] ?? 'Attachment')),
                'kind' => in_array($kind, ['team', 'sponsor', 'other'], true) ? $kind : 'other',
                'productTitle' => sanitize_text_field((string) ($file['productTitle'] ?? '')),
                'notes' => mb_substr(sanitize_textarea_field((string) ($file['notes'] ?? '')), 0, 500),
            ];
        }, self::files($order));
    }

    public static function render_order_files($order)
    {
        if (!current_user_can('edit_shop_orders') && !current_user_can('manage_woocommerce')) return;
        $files = self::files($order);
        if (!$files) return;
        echo '<div style="clear:both;margin-top:20px"><h3>Team Logo, Sponsors or Other Files</h3><ul>';
        foreach ($files as $index => $file) {
            $url = wp_nonce_url(add_query_arg(['action' => 'c767_ready_made_artwork', 'order_id' => $order->get_id(), 'file' => $index], admin_url('admin-post.php')), 'c767_ready_made_artwork_' . $order->get_id());
            $kind = (string) ($file['kind'] ?? 'other');
            $label = $kind === 'team' ? 'Team Logo' : ($kind === 'sponsor' ? 'Sponsor' : 'Other File');
            echo '<li style="margin-bottom:12px"><strong>' . esc_html($label) . '</strong>: <a href="' . esc_url($url) . '">' . esc_html($file['name'] ?? 'Attachment') . '</a>';
            echo '<br><small>' . esc_html(($file['productTitle'] ?? '') ?: 'All designs') . '</small>';
            if (!empty($file['notes'])) echo '<br>' . nl2br(esc_html($file['notes']));
            echo '</li>';
        }
        echo '</ul></div>';
    }

    public static function download_order_file()
    {
        if (!current_user_can('edit_shop_orders') && !current_user_can('manage_woocommerce')) wp_die('You cannot download order artwork.', '', ['response' => 403]);
        $order_id = absint($_GET['order_id'] ?? 0);
        check_admin_referer('c767_ready_made_artwork_' . $order_id);
        $order = wc_get_order($order_id);
        if (!$order) wp_die('Order not found.', '', ['response' => 404]);
        $index = filter_var($_GET['file'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        $files = self::files($order);
        $file = $index !== false && $index !== null && isset($files[$index]) ? C767_REST_Uniform_Quotes::sanitize_collar_attachment($files[$index]) : null;
        if (!$file) wp_die('Artwork not found.', '', ['response' => 404]);
        $bytes = base64_decode(substr($file['src'], strpos($file['src'], ',') + 1), true);
        nocache_headers();
        header('X-Content-Type-Options: nosniff');
        header('Content-Type: ' . $file['type']);
        header('Content-Disposition: attachment; filename="' . sanitize_file_name($file['name'] ?: 'order-artwork') . '"');
        header('Content-Length: ' . strlen($bytes));
        echo $bytes;
        exit;
    }
}
