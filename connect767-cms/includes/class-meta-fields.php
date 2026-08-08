<?php
/**
 * Post meta for `listing`, `uniform_template`, and core `post` (blog),
 * exposed to REST in the exact shape src/lib/mappers.js expects under
 * `acf.*` — without requiring the real ACF plugin. If ACF Pro is installed
 * later with matching field names, this steps back automatically (see the
 * function_exists('get_fields') guard below) rather than double-registering.
 *
 * Also includes: structured location fields (location_country / _region /
 * _city / _display) — implementing the "planned change" flagged in
 * WORDPRESS.md so country/region/city filtering is possible from day one
 * instead of retrofitted later.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Meta_Fields
{
    public static function init()
    {
        add_action('init', [__CLASS__, 'register_listing_meta']);
        add_action('init', [__CLASS__, 'register_uniform_template_meta']);
        add_action('init', [__CLASS__, 'register_product_type_meta']);
        add_action('init', [__CLASS__, 'register_post_meta_fields']);

        if (!function_exists('get_fields')) {
            add_action('rest_api_init', [__CLASS__, 'register_synthetic_acf_fields']);
        }

        add_action('add_meta_boxes', [__CLASS__, 'add_meta_boxes']);
        add_action('save_post_listing', [__CLASS__, 'save_listing_meta']);
        add_action('save_post_uniform_template', [__CLASS__, 'save_uniform_template_meta']);
        add_action('save_post_product_type', [__CLASS__, 'save_product_type_meta']);
        add_action('save_post_post', [__CLASS__, 'save_blog_meta']);

        add_action('listing_category_add_form_fields', [__CLASS__, 'render_category_icon_field_add']);
        add_action('listing_category_edit_form_fields', [__CLASS__, 'render_category_icon_field_edit']);
        add_action('created_listing_category', [__CLASS__, 'save_category_icon_field']);
        add_action('edited_listing_category', [__CLASS__, 'save_category_icon_field']);
    }

    public static function render_category_icon_field_add()
    {
        ?>
        <div class="form-field">
            <label for="c767_icon">Icon (Remix Icon class)</label>
            <input type="text" name="c767_icon" id="c767_icon" placeholder="ri-store-3-line" />
            <p class="description">Used for this category's icon on the homepage grid and directory filters. Browse icons at remixicon.com.</p>
        </div>
        <?php
    }

    public static function render_category_icon_field_edit($term)
    {
        $icon = get_term_meta($term->term_id, 'c767_icon', true);
        ?>
        <tr class="form-field">
            <th scope="row"><label for="c767_icon">Icon (Remix Icon class)</label></th>
            <td>
                <input type="text" name="c767_icon" id="c767_icon" value="<?php echo esc_attr($icon); ?>" placeholder="ri-store-3-line" />
                <p class="description">Used for this category's icon on the homepage grid and directory filters. Browse icons at remixicon.com.</p>
            </td>
        </tr>
        <?php
    }

    public static function save_category_icon_field($term_id)
    {
        if (isset($_POST['c767_icon'])) {
            update_term_meta($term_id, 'c767_icon', sanitize_text_field(wp_unslash($_POST['c767_icon'])));
        }
    }

    // ---------- Field definitions ----------

    public static function listing_fields()
    {
        return [
            'price_tier' => ['label' => 'Price tier ($ / $$ / $$$)', 'type' => 'string'],
            'tier' => ['label' => 'Listing tier (Free / Featured / Classified)', 'type' => 'string'],
            'verified' => ['label' => 'Verified badge', 'type' => 'boolean'],
            'featured' => ['label' => 'Show in homepage Featured section', 'type' => 'boolean'],
            'booking_enabled' => ['label' => 'Accept booking requests (owner-toggled from their dashboard)', 'type' => 'boolean'],
            'rating' => ['label' => 'Rating (0–5)', 'type' => 'number'],
            'review_count' => ['label' => 'Review count', 'type' => 'integer'],
            'location_display' => ['label' => 'Location (display text, e.g. "Roseau, Dominica")', 'type' => 'string'],
            'location_country' => ['label' => 'Country', 'type' => 'string'],
            'location_region' => ['label' => 'State / region / parish', 'type' => 'string'],
            'location_city' => ['label' => 'City', 'type' => 'string'],
            'description' => ['label' => 'Short description', 'type' => 'string', 'area' => true],
            // Per-listing (not per-account) — a Classified owner running
            // several businesses can show different credentials on each.
            // Validated against a closed set server-side in
            // class-rest-listings.php's sanitize_education()/
            // sanitize_experience_level(), same pattern as tier/position.
            'education' => ['label' => 'Education (Associate/Bachelor\'s/Master\'s/PhD/Post Graduate/Professional Certificate/Other)', 'type' => 'string'],
            'experience_level' => ['label' => 'Experience level (0-5/5-10/10-15/15-20/20+ years)', 'type' => 'string'],
            'tags' => ['label' => 'Tags (one per line)', 'type' => 'array'],
            'amenities' => ['label' => 'Amenities (one per line)', 'type' => 'array'],
            'hours' => ['label' => 'Hours (one per line, e.g. "Mon–Sat 9am–6pm")', 'type' => 'array'],
            'gallery' => ['label' => 'Gallery', 'type' => 'array', 'json' => true, 'repeater' => 'gallery'],
            'reviews' => ['label' => 'Reviews', 'type' => 'array', 'json' => true, 'repeater' => 'reviews'],
            'phone' => ['label' => 'Phone', 'type' => 'string'],
            'email' => ['label' => 'Email', 'type' => 'string'],
            'website' => ['label' => 'Website', 'type' => 'string'],
            'address' => ['label' => 'Street address', 'type' => 'string'],
            'instagram' => ['label' => 'Instagram URL', 'type' => 'string'],
            'facebook' => ['label' => 'Facebook URL', 'type' => 'string'],
            'youtube' => ['label' => 'YouTube URL', 'type' => 'string'],
            'twitter' => ['label' => 'Twitter / X URL', 'type' => 'string'],
            // A phone number, not a URL — src/components/ListingProfile.jsx
            // builds the wa.me chat link from this the same way it already
            // does for the `phone` field's tel: link.
            'whatsapp' => ['label' => 'WhatsApp phone number', 'type' => 'string'],
            'map_embed_url' => ['label' => 'Google Maps embed URL', 'type' => 'string'],
            'logo' => ['label' => 'Logo / profile picture URL', 'type' => 'string'],
            'logo_position' => ['label' => 'Logo crop anchor (3x3 grid, e.g. top-left / center / bottom-right)', 'type' => 'string'],
            'logo_zoom' => ['label' => 'Logo zoom (1.0-2.5)', 'type' => 'string'],
            'cover_position' => ['label' => 'Cover photo crop anchor (3x3 grid, e.g. top-left / center / bottom-right)', 'type' => 'string'],
            'cover_zoom' => ['label' => 'Cover photo zoom (1.0-2.5)', 'type' => 'string'],
            'fallback_image' => ['label' => 'Fallback image URL (used when no featured image / gallery is set)', 'type' => 'string'],
        ];
    }

    public static function uniform_template_fields()
    {
        return [
            'default_collar' => ['label' => 'Default collar (Crew / V-Neck / Polo)', 'type' => 'string'],
            'default_sleeve' => ['label' => 'Default sleeve (Short / Long / Sleeveless)', 'type' => 'string'],
            'description' => ['label' => 'Description', 'type' => 'string', 'area' => true],
        ];
    }

    /**
     * The Product Configurator's per-product fields — this is the "admin
     * controls what and where can be customized" system: `zones` is a
     * repeater of every customizable placement (Front, Back, Left sleeve,
     * ...), each with its own allow_text/allow_logo/allow_recolor toggles.
     * Add, remove, rename, or reorder zones here and the frontend's tabs
     * and gating (src/pages/ProductCustomizerPage.jsx) update immediately —
     * no code change needed. `model_url` is optional: leave blank and the
     * 3D preview uses a built-in placeholder shape for that product's
     * slug; set it once a real GLTF/GLB scan or model exists.
     */
    public static function product_type_fields()
    {
        return [
            'base_price' => ['label' => 'Base price (USD, per unit)', 'type' => 'number'],
            'icon' => ['label' => 'Icon (Remix Icon class, e.g. ri-t-shirt-line)', 'type' => 'string'],
            'model_url' => ['label' => '3D model URL (.glb/.gltf — leave blank to use the built-in placeholder shape)', 'type' => 'string'],
            'color_palette' => ['label' => 'Color palette (hex codes, one per line — leave blank to use the shop default palette)', 'type' => 'array'],
            'techniques' => [
                'label' => 'Printing/embroidery techniques (JSON array of {"key","label","group","description"} — leave blank for the shop default)',
                'type' => 'array',
                'json' => true,
            ],
            'zones' => ['label' => 'Customizable zones', 'type' => 'array', 'json' => true, 'repeater' => 'zones'],
        ];
    }

    public static function blog_fields()
    {
        return [
            'reading_time' => ['label' => 'Reading time (minutes)', 'type' => 'integer'],
            'author_key' => ['label' => 'Author key (matches the frontend authors map)', 'type' => 'string'],
            'tags' => ['label' => 'Tags (one per line)', 'type' => 'array'],
            'body' => ['label' => 'Structured body (JSON array of {"type":"p"|"h2","text"}) — leave blank to use the main editor content instead', 'type' => 'array', 'json' => true],
            'fallback_image' => ['label' => 'Fallback image URL (used when no featured image is set)', 'type' => 'string'],
        ];
    }

    // ---------- Registration ----------

    private static function register_fields_for($post_type, $fields)
    {
        foreach ($fields as $key => $def) {
            $schema = null;
            $type = 'string';

            if ($def['type'] === 'boolean') {
                $type = 'boolean';
            } elseif ($def['type'] === 'number') {
                $type = 'number';
            } elseif ($def['type'] === 'integer') {
                $type = 'integer';
            } elseif ($def['type'] === 'array') {
                $type = 'array';
                $schema = ['type' => 'array', 'items' => ['type' => !empty($def['json']) ? 'object' : 'string']];
            }

            register_post_meta($post_type, $key, [
                'show_in_rest' => $schema ? ['schema' => $schema] : true,
                'single' => true,
                'type' => $type,
                'auth_callback' => function () {
                    return current_user_can('edit_posts');
                },
            ]);
        }
    }

    public static function register_listing_meta()
    {
        self::register_fields_for('listing', self::listing_fields());
    }

    public static function register_uniform_template_meta()
    {
        self::register_fields_for('uniform_template', self::uniform_template_fields());
    }

    public static function register_product_type_meta()
    {
        self::register_fields_for('product_type', self::product_type_fields());
    }

    public static function register_post_meta_fields()
    {
        self::register_fields_for('post', self::blog_fields());
    }

    /**
     * Assembles a virtual `acf` object per post from the registered meta so
     * src/lib/mappers.js's `wp.acf || wp.meta` lookup works without ACF.
     */
    public static function register_synthetic_acf_fields()
    {
        register_rest_field('listing', 'acf', [
            'get_callback' => function ($post) {
                return self::build_acf_object($post['id'], self::listing_fields());
            },
        ]);

        register_rest_field('uniform_template', 'acf', [
            'get_callback' => function ($post) {
                return self::build_acf_object($post['id'], self::uniform_template_fields());
            },
        ]);

        register_rest_field('product_type', 'acf', [
            'get_callback' => function ($post) {
                return self::build_acf_object($post['id'], self::product_type_fields());
            },
        ]);

        register_rest_field('post', 'acf', [
            'get_callback' => function ($post) {
                return self::build_acf_object($post['id'], self::blog_fields());
            },
        ]);

        // Category icon (Remix Icon class, e.g. "ri-store-3-line") — set on
        // each `listing_category` term via the importer or the term edit
        // screen (see class-importer.php's ensure_term() and
        // class-woocommerce.php for the equivalent on product_cat). Exposed
        // here so getDirectoryCategories()/getHomeCategories() in the
        // frontend's repository.js can read it back as `acf.icon`.
        register_rest_field('listing_category', 'acf', [
            'get_callback' => function ($term) {
                return ['icon' => get_term_meta($term['id'], 'c767_icon', true) ?: ''];
            },
        ]);
    }

    private static function build_acf_object($post_id, $fields)
    {
        $out = [];
        foreach ($fields as $key => $def) {
            $value = get_post_meta($post_id, $key, true);
            if ($def['type'] === 'array') {
                $decoded = json_decode($value, true);
                // An empty array is truthy in JavaScript — `acf.body ||
                // fallback` on the frontend never falls through to real
                // post content if this returns `[]` for a post that
                // simply never had the structured-body field filled in
                // (the normal case for anything written through wp-admin's
                // regular editor, not this plugin's custom meta box).
                // `null` here is what actually lets that fallback trigger.
                $out[$key] = (is_array($decoded) && !empty($decoded)) ? $decoded : null;
            } elseif ($def['type'] === 'boolean') {
                $out[$key] = (bool) $value;
            } elseif ($def['type'] === 'number') {
                $out[$key] = $value !== '' ? (float) $value : null;
            } elseif ($def['type'] === 'integer') {
                $out[$key] = $value !== '' ? (int) $value : null;
            } else {
                $out[$key] = $value;
            }
        }
        // Alias so mapListingCpt's acf.location keeps working.
        if (isset($out['location_display'])) {
            $out['location'] = $out['location_display'];
        }
        return $out;
    }

    // ---------- Admin UI ----------

    public static function add_meta_boxes()
    {
        add_meta_box('c767_listing_fields', 'Listing Details', [__CLASS__, 'render_listing_box'], 'listing', 'normal', 'high');
        add_meta_box('c767_uniform_template_fields', 'Template Details', [__CLASS__, 'render_uniform_template_box'], 'uniform_template', 'normal', 'high');
        add_meta_box('c767_product_type_fields', 'Product Configurator Details', [__CLASS__, 'render_product_type_box'], 'product_type', 'normal', 'high');
        add_meta_box('c767_blog_fields', 'Connect767 Frontend Fields', [__CLASS__, 'render_blog_box'], 'post', 'normal', 'high');
    }

    private static function render_fields_table($post, $fields)
    {
        wp_nonce_field('c767_save_meta', 'c767_meta_nonce');
        echo '<table class="form-table"><tbody>';
        foreach ($fields as $key => $def) {
            if (!empty($def['repeater'])) {
                echo '<tr><th style="width:280px;vertical-align:top;padding-top:16px;"><label>' . esc_html($def['label']) . '</label></th><td>';
                self::render_repeater($post->ID, $key, $def['repeater']);
                echo '</td></tr>';
                continue;
            }

            $value = get_post_meta($post->ID, $key, true);
            echo '<tr><th style="width:280px;"><label for="c767_' . esc_attr($key) . '">' . esc_html($def['label']) . '</label></th><td>';

            if ($def['type'] === 'boolean') {
                printf(
                    '<input type="checkbox" id="c767_%1$s" name="c767_%1$s" value="1" %2$s />',
                    esc_attr($key),
                    checked($value, '1', false)
                );
            } elseif (!empty($def['area']) || $def['type'] === 'array') {
                $display = $def['type'] === 'array' && !$def['json'] ? implode("\n", (array) json_decode($value, true)) : $value;
                printf(
                    '<textarea id="c767_%1$s" name="c767_%1$s" rows="%2$d" style="width:100%%;font-family:monospace;">%3$s</textarea>',
                    esc_attr($key),
                    !empty($def['json']) ? 6 : 4,
                    esc_textarea($display)
                );
            } else {
                printf(
                    '<input type="text" id="c767_%1$s" name="c767_%1$s" value="%2$s" style="width:100%%;" />',
                    esc_attr($key),
                    esc_attr($value)
                );
            }
            echo '</td></tr>';
        }
        echo '</tbody></table>';
    }

    /**
     * Row-based editor for the gallery and reviews repeater fields — plain
     * HTML form arrays (name="c767_gallery[][url]" etc.), so PHP receives a
     * ready-made array of rows on save with no client-side JSON
     * serialization needed. The only JS is add/remove-row, inline and
     * dependency-free so this works from a plain plugin zip.
     */
    private static function render_repeater($post_id, $key, $kind)
    {
        $raw = get_post_meta($post_id, $key, true);
        $rows = json_decode($raw, true);
        $rows = is_array($rows) ? $rows : [];

        $templates = [
            'gallery' => ['url' => '', 'alt' => ''],
            'reviews' => ['name' => '', 'time' => '', 'stars' => '5', 'text' => ''],
            'zones' => ['key' => '', 'label' => '', 'allow_text' => '1', 'allow_logo' => '1', 'allow_recolor' => '1'],
        ];
        $empty_row = $templates[$kind] ?? [];
        if (empty($rows)) {
            $rows = [];
        }

        $container_id = 'c767-repeater-' . $key;
        echo '<div id="' . esc_attr($container_id) . '" class="c767-repeater" data-key="' . esc_attr($key) . '" data-kind="' . esc_attr($kind) . '">';
        echo '<div class="c767-repeater-rows">';
        foreach ($rows as $i => $row) {
            self::render_repeater_row($key, $kind, $row, $i);
        }
        echo '</div>';
        $add_label = ['gallery' => 'image', 'reviews' => 'review', 'zones' => 'zone'];
        printf(
            '<button type="button" class="button c767-repeater-add">+ Add %s</button>',
            esc_html($add_label[$kind] ?? 'row')
        );
        echo '</div>';

        // Row template used by JS when adding a new row — rendered once per
        // field, hidden, so add/remove needs no server round-trip.
        echo '<template id="' . esc_attr($container_id) . '-template">';
        self::render_repeater_row($key, $kind, $empty_row, '__INDEX__');
        echo '</template>';

        self::print_repeater_script_once();
    }

    private static function render_repeater_row($key, $kind, $row, $index)
    {
        $name = fn ($field) => sprintf('c767_%s[%s][%s]', $key, $index, $field);
        echo '<div class="c767-repeater-row">';

        if ($kind === 'gallery') {
            printf(
                '<input type="text" placeholder="Image URL" name="%s" value="%s" class="c767-repeater-input-wide" />',
                esc_attr($name('url')),
                esc_attr($row['url'] ?? '')
            );
            printf(
                '<input type="text" placeholder="Alt text" name="%s" value="%s" />',
                esc_attr($name('alt')),
                esc_attr($row['alt'] ?? '')
            );
        } elseif ($kind === 'reviews') {
            printf(
                '<input type="text" placeholder="Reviewer name" name="%s" value="%s" />',
                esc_attr($name('name')),
                esc_attr($row['name'] ?? '')
            );
            printf(
                '<input type="text" placeholder="e.g. 2 weeks ago" name="%s" value="%s" />',
                esc_attr($name('time')),
                esc_attr($row['time'] ?? '')
            );
            echo '<select name="' . esc_attr($name('stars')) . '">';
            for ($s = 5; $s >= 1; $s--) {
                printf(
                    '<option value="%1$d" %2$s>%1$d star%3$s</option>',
                    $s,
                    selected((string) ($row['stars'] ?? 5), (string) $s, false),
                    $s === 1 ? '' : 's'
                );
            }
            echo '</select>';
            printf(
                '<textarea placeholder="Review text" name="%s" rows="2" class="c767-repeater-input-wide">%s</textarea>',
                esc_attr($name('text')),
                esc_textarea($row['text'] ?? '')
            );
        } elseif ($kind === 'zones') {
            // This is the "what and where can be customized" control:
            // `key` becomes the placement's tab identity (must match a
            // key the 3D preview's zoneAnchors.js knows how to place, or
            // it falls back to a sensible front-facing default — see that
            // file's fuzzyAnchor()). The three checkboxes gate which tools
            // the frontend's Text/Art panels allow on this placement.
            printf(
                '<input type="text" placeholder="Zone key, e.g. front" name="%s" value="%s" style="max-width:140px;" />',
                esc_attr($name('key')),
                esc_attr($row['key'] ?? '')
            );
            printf(
                '<input type="text" placeholder="Label, e.g. Front" name="%s" value="%s" style="max-width:160px;" />',
                esc_attr($name('label')),
                esc_attr($row['label'] ?? '')
            );
            foreach (['allow_text' => 'Text', 'allow_logo' => 'Logo/art', 'allow_recolor' => 'Recolor'] as $flag => $flag_label) {
                printf(
                    '<label style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-weight:normal;"><input type="checkbox" name="%s" value="1" %s /> %s</label>',
                    esc_attr($name($flag)),
                    checked((string) ($row[$flag] ?? '1'), '1', false),
                    esc_html($flag_label)
                );
            }
        }

        echo '<button type="button" class="button-link c767-repeater-remove" aria-label="Remove row">&times;</button>';
        echo '</div>';
    }

    private static function print_repeater_script_once()
    {
        static $printed = false;
        if ($printed) {
            return;
        }
        $printed = true;
        ?>
        <style>
            .c767-repeater-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; padding: 10px; background: #f6f7f7; border: 1px solid #dcdcde; border-radius: 4px; }
            .c767-repeater-row input, .c767-repeater-row select, .c767-repeater-row textarea { flex: 1; min-width: 0; }
            .c767-repeater-input-wide { flex: 2; }
            .c767-repeater-remove { color: #b32d2e; font-size: 18px; line-height: 1; padding: 4px 8px !important; }
            .c767-repeater-add { margin-top: 4px; }
        </style>
        <script>
        (function () {
            function reindex(container) {
                var rows = container.querySelectorAll('.c767-repeater-rows > .c767-repeater-row');
                rows.forEach(function (row, i) {
                    row.querySelectorAll('[name]').forEach(function (el) {
                        el.name = el.name.replace(/\[[^\]]*\]\[/, '[' + i + '][');
                    });
                });
            }
            document.addEventListener('click', function (e) {
                if (e.target.classList.contains('c767-repeater-add')) {
                    var container = e.target.closest('.c767-repeater');
                    var rowsEl = container.querySelector('.c767-repeater-rows');
                    var tpl = document.getElementById(container.id + '-template');
                    var clone = tpl.content.cloneNode(true);
                    rowsEl.appendChild(clone);
                    reindex(container);
                }
                if (e.target.classList.contains('c767-repeater-remove')) {
                    var container = e.target.closest('.c767-repeater');
                    e.target.closest('.c767-repeater-row').remove();
                    reindex(container);
                }
            });
        })();
        </script>
        <?php
    }

    public static function render_listing_box($post)
    {
        self::render_fields_table($post, self::listing_fields());
    }

    public static function render_uniform_template_box($post)
    {
        self::render_fields_table($post, self::uniform_template_fields());
    }

    public static function render_product_type_box($post)
    {
        self::render_fields_table($post, self::product_type_fields());
    }

    public static function render_blog_box($post)
    {
        self::render_fields_table($post, self::blog_fields());
    }

    private static function save_fields($post_id, $fields)
    {
        if (!isset($_POST['c767_meta_nonce']) || !wp_verify_nonce($_POST['c767_meta_nonce'], 'c767_save_meta')) {
            return;
        }
        if (!current_user_can('edit_post', $post_id)) {
            return;
        }

        foreach ($fields as $key => $def) {
            $field = 'c767_' . $key;

            if (!empty($def['repeater'])) {
                $rows = isset($_POST[$field]) && is_array($_POST[$field]) ? wp_unslash($_POST[$field]) : [];
                $clean = [];
                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    if ($def['repeater'] === 'gallery') {
                        $url = esc_url_raw($row['url'] ?? '');
                        if ($url === '') {
                            continue;
                        }
                        $clean[] = ['url' => $url, 'alt' => sanitize_text_field($row['alt'] ?? '')];
                    } elseif ($def['repeater'] === 'reviews') {
                        $name = sanitize_text_field($row['name'] ?? '');
                        if ($name === '') {
                            continue;
                        }
                        $clean[] = [
                            'name' => $name,
                            'time' => sanitize_text_field($row['time'] ?? ''),
                            'stars' => max(1, min(5, (int) ($row['stars'] ?? 5))),
                            'text' => sanitize_textarea_field($row['text'] ?? ''),
                        ];
                    } elseif ($def['repeater'] === 'zones') {
                        $zone_key = sanitize_key($row['key'] ?? '');
                        if ($zone_key === '') {
                            continue;
                        }
                        $clean[] = [
                            'key' => $zone_key,
                            'label' => sanitize_text_field($row['label'] ?? '') ?: $zone_key,
                            'allow_text' => isset($row['allow_text']),
                            'allow_logo' => isset($row['allow_logo']),
                            'allow_recolor' => isset($row['allow_recolor']),
                        ];
                    }
                }
                update_post_meta($post_id, $key, wp_json_encode($clean));
                continue;
            }

            if ($def['type'] === 'boolean') {
                update_post_meta($post_id, $key, isset($_POST[$field]) ? '1' : '0');
                continue;
            }

            if (!isset($_POST[$field])) {
                continue;
            }
            $raw = wp_unslash($_POST[$field]);

            if ($def['type'] === 'array') {
                if (!empty($def['json'])) {
                    // Validate it's real JSON before saving; keep previous value otherwise.
                    $decoded = json_decode($raw, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        update_post_meta($post_id, $key, wp_json_encode($decoded));
                    }
                } else {
                    $lines = array_values(array_filter(array_map('trim', explode("\n", $raw))));
                    update_post_meta($post_id, $key, wp_json_encode($lines));
                }
            } else {
                update_post_meta($post_id, $key, sanitize_text_field($raw));
            }
        }
    }

    public static function save_listing_meta($post_id)
    {
        self::save_fields($post_id, self::listing_fields());
    }

    public static function save_uniform_template_meta($post_id)
    {
        self::save_fields($post_id, self::uniform_template_fields());
    }

    public static function save_product_type_meta($post_id)
    {
        self::save_fields($post_id, self::product_type_fields());
    }

    public static function save_blog_meta($post_id)
    {
        self::save_fields($post_id, self::blog_fields());
    }
}
