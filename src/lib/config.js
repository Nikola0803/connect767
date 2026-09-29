/**
 * Central config for connecting this app to the Connect767 CMS plugin
 * (WordPress + WooCommerce backend). Until VITE_WP_BASE_URL is set, none of
 * these need to be configured — the data repository (src/data/repository.js)
 * falls back to local fixture data automatically. Once the plugin is live,
 * set this in a `.env.local` file (see .env.example) and the app switches
 * over with no component changes.
 */

const env = import.meta.env;

// The production backend. Hardcoded as a fallback because the deploy flow
// (deploy.bat -> GitHub -> VPS `npm run build`) gitignores .env/.env.local,
// so production builds on the VPS have NO env vars at all. That's exactly
// what shipped to connect767.com: a bundle with isLiveApi=false, which
// silently regressed the whole site to demo/fixture mode — empty shop,
// DemoModeNotice on Add Listing, and the old fixture categories on the
// home page and directory. With this fallback, a production build always
// talks to the real backend even when no .env file exists at build time;
// VITE_WP_BASE_URL still overrides it when set (e.g. a staging backend).
const PROD_WP_BASE_URL = "https://admin.connect767.com";

export const config = {
  // Base URL of the WordPress install, e.g. https://cms.connect767.com
  wpBaseUrl: env.VITE_WP_BASE_URL || (env.PROD ? PROD_WP_BASE_URL : ""),

  // WordPress REST API (wp/v2) — used for the `listing` and `post` CPTs
  get wpApiUrl() {
    return this.wpBaseUrl ? `${this.wpBaseUrl}/wp-json/wp/v2` : "";
  },

  // connect767/v1 — the CMS plugin's own namespace: self-contained JWT auth
  // (no third-party JWT plugin needed), AI matching, listing submissions,
  // uniform quotes, headless WooCommerce checkout, and a server-side
  // shop products/categories proxy (class-woocommerce.php's
  // list_products()/list_categories()) — reads WooCommerce data with
  // wc_get_products() on the server, so no WooCommerce REST consumer
  // key/secret ever needs to exist in this client-side bundle at all.
  get customApiUrl() {
    return this.wpBaseUrl ? `${this.wpBaseUrl}/wp-json/connect767/v1` : "";
  },
};

// True once a real backend is configured; false means "use local fixtures."
export const isLiveApi = Boolean(config.wpBaseUrl);
