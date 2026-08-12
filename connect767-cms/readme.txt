=== Connect767 CMS ===
Contributors: connect767
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
License: GPLv2 or later

Content management, REST API, auth, and WooCommerce checkout bridge for the
Connect767 headless React frontend.

== Description ==

This plugin is the backend for the Connect767 React app (see the frontend
repo's WORDPRESS.md for the full architecture this was built against). It:

* Registers the `listing` CPT (the directory) and `uniform_template` CPT
  (the Uniform Studio's gallery), plus `listing_category` and
  `uniform_sport` taxonomies.
* Ships a proper **Connect767 admin dashboard** — live content counts, a
  pending-listings review queue (Approve/Reject), and direct links into
  every content type. Not just stock WP post-list screens.
* Row-based editors for gallery images and reviews (add/remove rows in the
  post editor) instead of raw JSON textareas.
* Exposes all the fields the frontend expects under a synthetic `acf` REST
  field — no ACF plugin required (though it steps back automatically if you
  install real ACF Pro with matching field names later).
* Adds structured location fields (`location_country` / `location_region` /
  `location_city` / `location_display`) so filtering by country/state/city
  is possible from day one.
* Ships a self-contained JWT auth implementation (`connect767/v1/auth/*`) —
  no third-party JWT plugin needed.
* Adds a server-side AI Matching endpoint (`connect767/v1/match`) that
  mirrors the frontend's local scoring algorithm exactly.
* Adds authenticated listing submission (`connect767/v1/listings`) and
  Uniform Studio quote requests (`connect767/v1/uniform-quotes`).
* Bridges headless checkout to WooCommerce (`connect767/v1/checkout`) —
  creates a real WooCommerce order and hands off to WooCommerce's own
  hosted payment page, rather than reimplementing payment processing.
* Includes a one-click sample content importer (Connect767 menu in
  wp-admin) seeded from the exact same data the React app ships with
  locally, so the two stay in sync during development.

== Installation ==

1. Upload the `connect767-cms` folder to `/wp-content/plugins/`.
2. Activate the plugin through the "Plugins" menu in WordPress.
3. (Optional, for shop/checkout) Install and activate WooCommerce first.
4. Go to **Connect767** in the admin sidebar — the dashboard shows live
   content counts and everything you can manage.
5. Under **Connect767 → Import Sample Content**, click **Import sample
   content**.
6. In the React app, copy `.env.example` to `.env.local` and set
   `VITE_WP_BASE_URL` to this site's URL.
7. Restart the frontend dev server. It now reads from this backend instead
   of local fixtures.

Pairs with the separate **Connect767 Frontend Loader** plugin if you want
WordPress to serve the built React app directly at this site's domain
instead of hosting it elsewhere — entirely optional, this plugin's REST API
works the same either way.

== CORS ==

By default, only `http://localhost:5173` and `http://localhost:4173` (Vite's
dev and preview ports) are allowed to call the REST API with credentials.
Add your production frontend origin via the `c767_allowed_origins` filter,
e.g. in a small mu-plugin or your theme's `functions.php`:

    add_filter('c767_allowed_origins', function ($origins) {
        $origins[] = 'https://app.connect767.com';
        return $origins;
    });

== Payments ==

This plugin does not process payments itself. `/connect767/v1/checkout`
creates a WooCommerce order and returns WooCommerce's own checkout payment
URL — configure your payment gateways (Stripe, PayPal, etc.) in WooCommerce
as normal under WooCommerce → Settings → Payments.

== Uninstall notes ==

This plugin does not delete any content on deactivation or uninstall.
Listings, uniform templates, and quote requests remain in the database as
regular posts.
