<?php
/**
 * Admin page: upload the React app's `npm run build` output as a zip
 * (zip the *contents* of the dist/ folder, so index.html sits at the zip
 * root) and extract it into this plugin's own dist/ folder. No path
 * rewriting happens here — the router (class-spa-router.php) serves any
 * real file in that folder directly at the same root-relative path it was
 * built with, so a plain `npm run build` output (default Vite base "/")
 * works with zero special configuration on the frontend's side.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767F_Uploader
{
    public static function init()
    {
        add_action('admin_menu', [__CLASS__, 'add_menu']);
        add_action('admin_post_c767f_upload_dist', [__CLASS__, 'handle_upload']);
        add_action('admin_post_c767f_toggle_takeover', [__CLASS__, 'handle_toggle']);
    }

    public static function add_menu()
    {
        add_menu_page(
            'Connect767 Frontend',
            'Connect767 Frontend',
            'manage_options',
            'connect767-frontend',
            [__CLASS__, 'render'],
            'dashicons-align-left',
            4
        );
    }

    private static function has_build()
    {
        return file_exists(C767F_DIST_DIR . 'index.html');
    }

    public static function render()
    {
        $has_build = self::has_build();
        $active = get_option('c767f_takeover_active');
        $uploaded_at = get_option('c767f_dist_uploaded_at');
        ?>
        <div class="wrap">
            <h1>Connect767 Frontend Loader</h1>
            <p class="description">Serves the built React app as this site's actual front-end —
                every non-admin, non-API URL renders the app, and React Router takes over from
                there.</p>

            <?php if (isset($_GET['uploaded'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Build uploaded and processed.</p></div>
            <?php elseif (isset($_GET['upload_error'])) : ?>
                <div class="notice notice-error is-dismissible"><p><?php echo esc_html(urldecode($_GET['upload_error'])); ?></p></div>
            <?php endif; ?>

            <h2>1. Upload the build</h2>
            <p>Run <code>npm run build</code> in the React app, then zip the <strong>contents</strong>
                of the <code>dist/</code> folder (so <code>index.html</code> is at the root of the
                zip, not inside a <code>dist/</code> subfolder) and upload it here.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data">
                <input type="hidden" name="action" value="c767f_upload_dist" />
                <?php wp_nonce_field('c767f_upload_dist'); ?>
                <input type="file" name="dist_zip" accept=".zip" required />
                <?php submit_button('Upload &amp; install build', 'primary', 'submit', false); ?>
            </form>

            <?php if ($has_build) : ?>
                <p style="margin-top:12px;">
                    ✅ A build is installed<?php echo $uploaded_at ? ' (uploaded ' . esc_html(human_time_diff($uploaded_at, current_time('timestamp'))) . ' ago)' : ''; ?>.
                    Assets are served directly from your site's root (e.g.
                    <code><?php echo esc_html(home_url('/assets/...')); ?></code>), exactly as
                    Vite built them.
                </p>
            <?php else : ?>
                <p style="margin-top:12px;">No build installed yet.</p>
            <?php endif; ?>

            <h2>2. Enable it</h2>
            <?php if (!$has_build) : ?>
                <p class="description">Upload a build first.</p>
            <?php else : ?>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <input type="hidden" name="action" value="c767f_toggle_takeover" />
                    <?php wp_nonce_field('c767f_toggle_takeover'); ?>
                    <input type="hidden" name="next_state" value="<?php echo $active ? '0' : '1'; ?>" />
                    <?php if ($active) : ?>
                        <p>🟢 <strong>SPA takeover is ON</strong> — this plugin is answering every
                            front-end request with the React app.</p>
                        <?php submit_button('Turn off (restore normal WordPress front-end)', 'secondary', 'submit', false); ?>
                    <?php else : ?>
                        <p>⚪ SPA takeover is off — WordPress's normal theme is still serving the
                            front-end.</p>
                        <?php submit_button('Turn on SPA takeover', 'primary', 'submit', false); ?>
                    <?php endif; ?>
                </form>
            <?php endif; ?>

            <h2>How it works</h2>
            <ul style="list-style:disc;padding-left:20px;">
                <li>Requests to <code>/wp-admin</code>, <code>/wp-json</code>, <code>/wp-login.php</code>,
                    <code>/xmlrpc.php</code>, and <code>/wp-content</code> are never touched — WordPress
                    handles those exactly as normal.</li>
                <li>Every other front-end URL (<code>/</code>, <code>/shop</code>,
                    <code>/listings/some-business</code>, anything) is answered with the app's
                    <code>index.html</code>, and React Router renders the right page client-side.</li>
                <li>Re-uploading a new build replaces the old one immediately — no need to
                    re-toggle takeover.</li>
            </ul>
        </div>
        <?php
    }

    public static function handle_upload()
    {
        if (!current_user_can('manage_options') || !check_admin_referer('c767f_upload_dist')) {
            wp_die('Not allowed.');
        }

        if (empty($_FILES['dist_zip']['tmp_name']) || $_FILES['dist_zip']['error'] !== UPLOAD_ERR_OK) {
            self::redirect_with_error('No file uploaded, or the upload failed.');
        }

        $file = $_FILES['dist_zip'];
        // Don't use wp_check_filetype() — it cross-references WordPress's
        // allowed-MIME list, and many hosts exclude application/zip from it
        // as a security policy, so it returns ext='' for a valid zip.
        // We own the destination (the plugin's own dist/ folder) and the
        // file goes straight to ZipArchive::open() which does its own
        // magic-byte validation, so a plain extension check is correct here.
        if (strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) !== 'zip') {
            self::redirect_with_error('Please upload a .zip file.');
        }

        if (!class_exists('ZipArchive')) {
            self::redirect_with_error('The PHP zip extension isn\'t available on this server, so uploaded builds can\'t be extracted.');
        }

        // Deliberately plain PHP here rather than WP_Filesystem()/unzip_file()
        // — this plugin only ever writes inside its own dist/ folder, which
        // it's guaranteed to own by virtue of being an active plugin, so
        // there's no scenario where FTP-style credentials are genuinely
        // needed. WP_Filesystem() can fall back to requesting FTP
        // credentials on some hosts even when direct writes would work
        // fine, which silently no-ops this exact upload with no visible
        // error — using plain PHP sidesteps that entirely.
        self::clear_directory(C767F_DIST_DIR);
        if (!file_exists(C767F_DIST_DIR)) {
            wp_mkdir_p(C767F_DIST_DIR);
        }

        $zip = new ZipArchive();
        $opened = $zip->open($file['tmp_name']);
        if ($opened !== true) {
            self::redirect_with_error('Could not open the uploaded zip (error code ' . $opened . ').');
        }
        $extracted = $zip->extractTo(C767F_DIST_DIR);
        $zip->close();
        if (!$extracted) {
            self::redirect_with_error('Could not extract the zip to the plugin\'s dist/ folder — check file permissions.');
        }

        // Some zip tools wrap contents in a top-level folder — if index.html
        // isn't at dist/index.html, look one level down and flatten it up.
        if (!file_exists(C767F_DIST_DIR . 'index.html')) {
            $entries = glob(C767F_DIST_DIR . '*', GLOB_ONLYDIR);
            if (count($entries) === 1 && file_exists($entries[0] . '/index.html')) {
                self::flatten_directory($entries[0], C767F_DIST_DIR);
            }
        }

        if (!file_exists(C767F_DIST_DIR . 'index.html')) {
            self::redirect_with_error('Extracted the zip, but no index.html was found. Make sure you zipped the contents of dist/, not the folder itself.');
        }

        // No path rewriting needed — the router (class-spa-router.php)
        // serves any real file in this folder directly at the same path it
        // was built with, so a stock `npm run build` output (default Vite
        // base "/") just works: HTML attributes, CSS @font-face url()s, and
        // JS-bundled string literals (e.g. an <img src="/uploads/...">)
        // all resolve correctly without needing individual rewriting.

        update_option('c767f_dist_uploaded_at', current_time('timestamp'));

        wp_safe_redirect(add_query_arg(['page' => 'connect767-frontend', 'uploaded' => '1'], admin_url('admin.php')));
        exit;
    }

    /** Recursively deletes everything inside a directory, in plain PHP. */
    private static function clear_directory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            if ($item->isDir()) {
                rmdir($item->getRealPath());
            } else {
                unlink($item->getRealPath());
            }
        }
    }

    private static function flatten_directory($from, $to)
    {
        foreach (glob($from . '/*') as $item) {
            $dest = $to . basename($item);
            if (is_dir($item)) {
                self::copy_directory($item, $dest);
            } else {
                copy($item, $dest);
            }
        }
        self::clear_directory($from);
        rmdir($from);
    }

    private static function copy_directory($from, $to)
    {
        if (!is_dir($to)) {
            mkdir($to, 0755, true);
        }
        foreach (glob($from . '/*') as $item) {
            $dest = $to . '/' . basename($item);
            if (is_dir($item)) {
                self::copy_directory($item, $dest);
            } else {
                copy($item, $dest);
            }
        }
    }

    private static function redirect_with_error($message)
    {
        wp_safe_redirect(add_query_arg(
            ['page' => 'connect767-frontend', 'upload_error' => urlencode($message)],
            admin_url('admin.php')
        ));
        exit;
    }

    public static function handle_toggle()
    {
        if (!current_user_can('manage_options') || !check_admin_referer('c767f_toggle_takeover')) {
            wp_die('Not allowed.');
        }
        $next = isset($_POST['next_state']) && $_POST['next_state'] === '1';
        update_option('c767f_takeover_active', $next);
        wp_safe_redirect(admin_url('admin.php?page=connect767-frontend'));
        exit;
    }
}
