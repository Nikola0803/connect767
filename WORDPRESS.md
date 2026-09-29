# WordPress + WooCommerce Integration

**Two companion plugins are built:**

- **`connect767-cms`** — content, REST API, self-contained JWT auth, AI matching,
  headless WooCommerce checkout, and a proper admin dashboard (content counts, a
  pending-listings review queue, direct links into everything).
- **`connect767-frontend`** — optional, separate concern. Upload the React app's
  `npm run build` output and it serves that as this WordPress site's actual
  front-end at the site's own domain (no separate hosting, no iframe), while
  `connect767-cms`'s REST API keeps working underneath it exactly the same way.

This document is both the spec `connect767-cms` was built against and a
reference for how the repos fit together.

This app runs standalone today (all data comes from local fixtures in
`src/data/*.js`) and switches over to `connect767-cms` with **zero component
changes** once `VITE_WP_BASE_URL` is set.

## HTML entities showing as literal text ("Accounting &amp; Bookkeeping")

A real, systemic bug affecting anything with special characters coming
from live WordPress data — but *not* the specific industry sub-filter
pills reported alongside it, which come from the frontend's own static
`industries.js` and were confirmed to have zero occurrences of this in
source (so that specific list, if still showing this, is the same
stale-build pattern as elsewhere in this file — worth separating the two).

The real bug: WordPress's REST API returns text fields (titles, term
names, tags) with HTML entities encoded — `"Accounting &amp; Bookkeeping"`
for a term literally named `"Accounting & Bookkeeping"`. That's correct
and expected for a classic PHP-templated theme, where the *browser's own
HTML parser* decodes entities while parsing the rendered page. A React
frontend doesn't get that for free — `{term.name}` inserts the string as
a plain text node, so an encoded `&amp;` displays as those five literal
characters, not `&`.

Fixed centrally in `mappers.js` (`decodeEntities()`, using a `<textarea>`
element's `innerHTML`/`.value` round-trip — safe against XSS even for a
maliciously-crafted string, since setting `innerHTML` on a textarea never
creates real child elements or fires embedded event handlers) and applied
everywhere a raw WP-sourced string reaches a component: product/listing
titles, category and tag names, blog post titles/excerpts/tags, review
author names and text, and embedded author name/bio. Verified directly —
fed the decoder `"Accounting &amp; Bookkeeping"`, `"Women&#8217;s Cotton
T-Shirt"`, and a mixed case with both named and bracket entities, and
confirmed all three decode correctly while a plain string with no
entities passes through unchanged.

## Setup

1. Install and activate `connect767-cms` on a WordPress site (WooCommerce
   optional, only needed for the shop).
2. In wp-admin, **Connect767** is now a top-level menu item — the dashboard
   shows live content counts and links into everything. Go to **Connect767 →
   Import Sample Content** — seeds the same 15 listings (3 are real,
   client-provided businesses — Kalinago Tours, Finance Focus Consultancy,
   Catherine Lewis; their images are bundled with the plugin under
   `assets/real-listings/`), 6 blog posts, 6 uniform templates, and 16
   products (if WooCommerce is active) the frontend already ships with
   locally, so nothing visually changes when you flip the switch.
3. Copy `.env.example` to `.env.local`, set `VITE_WP_BASE_URL` to that site's
   URL, restart the dev server.
4. *(Optional)* Install `connect767-frontend`, run `npm run build` in this repo,
   zip the contents of `dist/`, upload it under **Connect767 Frontend**, and
   flip on "SPA takeover" — the built app now serves directly from the
   WordPress site's own domain.

### "Registration/submissions don't show up in WordPress"

Two real causes, both now handled:

1. **No backend configured.** Without `VITE_WP_BASE_URL` set, `isLiveApi` is
   `false` and every write action (register, login, Add Listing, Uniform
   Studio quotes) **simulates success entirely client-side** — nothing is
   ever sent anywhere. This is intentional (lets the UI be built/tested
   without a backend) but was previously silent, which reads as "it worked"
   with no indication otherwise. Every one of those flows now shows a
   `DemoModeNotice` ("Demo mode — no backend connected...") right on the
   form when this is the case — if you don't see that notice, a backend
   *is* configured and something else is wrong.
2. **CORS preflight failures**, once a backend is configured. A `POST` with
   `Content-Type: application/json` from a different origin triggers a
   browser preflight `OPTIONS` request first — if that doesn't get an
   immediate `200` with the right `Access-Control-*` headers, the browser
   silently blocks the real request from ever being sent (shows as a
   generic "Failed to fetch" in the console, not a clear error). Fixed in
   `class-cors.php` with an early `init`-hook short-circuit that answers
   `OPTIONS` requests to `/wp-json/*` directly, rather than relying on
   WordPress's REST dispatch (`rest_pre_serve_request`) to fire reliably
   for preflight — the previous version worked for normal GET/POST
   responses but wasn't guaranteed to run early enough for preflight.

## Content management

`connect767-cms` isn't just CPT registration — **Connect767 → Dashboard** is a
real admin home screen: content counts per type, a pending-listings alert with
a one-click link to **Review Listings** (Approve publishes it, Reject trashes
it — see `class-listing-review.php`), and direct links into every content
type instead of expecting the admin to already know Listings/Quote
Requests/Products are separate stock WP screens.

Gallery and review fields on a listing use a proper add/remove-row editor
(`class-meta-fields.php`'s repeater renderer) rather than a raw JSON textarea
— still stores the same JSON under the hood, so the REST shape `mapListingDetail`
expects doesn't change.

## How the switch works

Every page reads data through `src/data/repository.js`, never by importing the
fixture files directly. Each repository function checks `isLiveApi` (true once
`VITE_WP_BASE_URL` is set — see `src/lib/config.js`) and either:

- calls the WordPress/WooCommerce REST API and runs the response through a mapper
  in `src/lib/mappers.js`, or
- returns the local fixture data.

Both branches resolve to the exact same shape, so components never know the
difference. **The plugin's job is to make the REST API return data that the
mappers can already understand** — see each mapper for the exact fields expected.

```
Page component
  → src/data/repository.js   (getProducts, getListings, getListingBySlug, ...)
    → isLiveApi ? wcClient/wpClient + mapper  : local fixture
```

## Content model → WordPress structure

| App concept | WordPress structure | Notes |
|---|---|---|
| Shop products | Native WooCommerce `product` CPT | Use WooCommerce as-is — don't reinvent it |
| Shop categories | Native WooCommerce product categories (`product_cat`) | |
| Directory listings | Custom Post Type `listing` | See field list below |
| Listing categories | Custom taxonomy `listing_category` (hierarchical) | 7 top-level categories (Services, Products, Rentals, Eat & Drink, Events, Fitness, Other) with 191 specific industries nested under them — see `src/data/industries.js` for the canonical list. Listings are tagged with both the parent category term and the specific industry term |
| Listing tier (Free/Featured/Classified) | ACF field on `listing`, **not** a taxonomy | It's a paid plan state, changes independently of content |
| Blog posts | Native WordPress `post` CPT | Use core `category` taxonomy for the post tag shown on cards |
| Uniform templates | Custom Post Type `uniform_template` | See field list below — new in this pass, not yet backed by real product photography |
| Users (shoppers vs. business owners) | Core `wp_users` + a custom role or user meta `account_type` | See Auth section |

### `listing` CPT — field list (ACF field group)

Register the CPT with REST support (`show_in_rest => true`) and add an ACF field
group (or plain post meta, exposed via `register_post_meta`) with:

| Field | Type | Maps to |
|---|---|---|
| `location` | text | `listing.location` |
| `price_tier` | select `$` / `$$` / `$$$` | `listing.price` |
| `tier` | select `Free` / `Featured` / `Classified` | `listing.badge` |
| `verified` | true/false | `listing.verified` |
| `rating` | number (0–5) | `listing.rating` |
| `review_count` | number | `listing.reviews` |
| `description` | textarea | falls back to post content if empty |
| `tags` | repeater/text list | chip list on the detail page |
| `amenities` | repeater/text list | detail page "Amenities" section |
| `hours` | repeater/text list | detail page "Hours" section, one line per row |
| `gallery` | gallery (array of `{url, alt}`) | detail page image gallery |
| `reviews` | repeater `{name, time, stars, text}` | detail page review list |
| `phone`, `email`, `website`, `address`, `instagram`, `facebook` | text/url | contact sidebar |
| `map_embed_url` | url | Google Maps `iframe` `src` on the detail page |
| `featured` | true/false | used by the homepage "Featured listings" query (`featured=true`) |

> **Implemented:** `location_country`, `location_region`, `location_city`, and
> `location_display` are real, separately-editable fields on the `listing` CPT
> (`class-meta-fields.php`) — `location_display` is what mappers.js reads as
> `acf.location` (aliased automatically), the other three exist for future
> country/state/city filtering UI. The directory page and AI Matching's
> location scoring (`src/lib/matching.js`) still only use the flattened
> display string today — wiring the filter UI to the structured fields is the
> next step, not yet done.

See `src/lib/mappers.js` → `mapListingCpt` / `mapListingDetail` for exactly how
these fields are read (it checks `acf.*` first, falls back to `meta.*`, so either
ACF or plain post meta works).

### `post` — field list (blog)

Core WordPress `post` needs no custom registration, just a couple of extra
fields for what the blog pages expect:

| Field | Type | Maps to |
|---|---|---|
| (core) `title`, `content`, `excerpt`, `date`, featured image | — | article body, hero, meta row |
| (core) `category` taxonomy | — | the colored tag chip on every post card |
| `reading_time` | number (minutes) | shown next to the date |
| `author_key` | text — one of `team`, `amara`, `marcus`, or a new key | which entry in `src/data/blog.js`'s `authors` map to render. **Once
  posts come from the backend, replace that local `authors` lookup with the
  real WP author (`_embedded.author`) instead** |
| `tags` | repeater/text list | tag chips at the end of the article |
| `body` | structured content (array of `{ type: "p" | "h2", text }`) — optional | `mapWpPost` falls back to rendering `post_content` as a single paragraph if this isn't set, so plain WP content still works without it |

### `uniform_template` CPT — field list

New in this pass (`/uniforms`) — register a lightweight CPT for the template
gallery so it's manageable from the backend instead of hardcoded. Note this
page was rebuilt as a full SVG-based product customizer (see the app README's
"Uniform Studio notes" for the technical breakdown) — the jersey is drawn,
not photographed, so template differentiation is a shape/default-collar
question more than a photography one now:

| Field | Type | Maps to |
|---|---|---|
| `sport` | taxonomy or select (`soccer`/`basketball`/`baseball`/`cricket`) | which sport tab the template appears under |
| `description` | text | one-line description on the template card |
| `default_collar` / `default_sleeve` | select | which collar/sleeve the customizer opens with when this template is chosen |

**Known gap:** template gallery cards now render with each template's own
default collar/sleeve (real shape differentiation), but there's still no
photorealistic product photography anywhere in the flow — it's entirely
vector. Worth adding photorealistic mockup rendering for order confirmations
even if the live editor stays vector-based (vector is what makes the live
customization genuinely real-time).

The customizer itself (collar/sleeve/colorway pickers, roster builder) is
static, client-side data (`collarOptions`, `sleeveOptions`, `zoneColorPalette`
in `src/data/uniforms.js`) — no CPT needed unless you want those configurable
per-template rather than global.

Pricing tiers and FAQ content on that page are also static fixtures for now
(`pricingTiers`, `faqs`) — reasonable candidates for ACF options pages or
simple CPTs if they'll change often.

**Quote requests:** the roster builder's "Request quote" button currently
just shows a local success message. Add
`POST connect767/v1/uniform-quotes` (body: template, collar, sleeve, color,
roster array) so these actually reach someone.

### `product_type` CPT — the Product Configurator's admin controls

Backs the Shop's Product Customizer (`/shop/customize`,
`src/pages/ProductCustomizerPage.jsx`) — a real-time 3D product configurator
(see `src/components/product-customizer/garment3d/`) with a genuine
rotate/zoom preview, not just a flat mockup. Every product it offers, and
exactly what can be customized on each one, is controlled from wp-admin's
**Product Configurator** menu rather than hardcoded in the frontend — before
this pass, `src/data/customizer.js` was the only source of truth and
required a code change to add a product or change what a customer could do
to it.

| Field | Type | Maps to |
|---|---|---|
| Title | text | product label (e.g. "T-Shirt") shown in the Product panel |
| `base_price` | number | per-unit USD price, drives the bulk-pricing calculation |
| `icon` | text (Remix Icon class) | icon on the product picker button |
| `model_url` | text, optional | a `.glb`/`.gltf` URL for the 3D preview. Leave blank and `GarmentModel.jsx` renders a built-in placeholder shape (procedural geometry, correctly proportioned but not photoreal) for that product's slug — set this once real 3D-scanned or modeled garment assets exist |
| `color_palette` | text, one hex per line, optional | overrides the shop's default color swatch grid for this product only |
| `techniques` | JSON array, optional | overrides the default DTG/DTFlex/Embroidery technique list for this product only |
| `zones` | repeater | **this is "what and where can be customized."** Each row: `key` (must be URL/slug-safe — matches a placement key the 3D preview's `zoneAnchors.js` knows how to position, or it falls back to a sensible default), `label` (shown on the placement tab), and three checkboxes — Text, Logo/art, Recolor — gating which tools the Text/Art panels allow on that specific placement (e.g. turn off Text for an inside-label zone, or Logo for a sleeve) |

Post slug must match the product's `slug` used throughout the frontend
(`tshirt`, `hoodie`, `socks`, `cap` for the four built-ins — add new slugs
freely, the frontend has no hardcoded list). Order products in wp-admin's
list view (drag to reorder, via the CPT's page-attributes support) to
control the order they appear in the Product panel — the frontend requests
`orderby=menu_order`.

Until at least one `product_type` post exists, or while no backend is
configured (`VITE_WP_BASE_URL` unset), the customizer falls back to
`src/data/customizer.js`'s fixtures, which mirror this exact shape — so
`getProductTypes()` in `repository.js` never needs the frontend to know
which source it got.

### WooCommerce product categories → shop filter icons

The shop category pills need an icon (Remix Icon class name, e.g.
`ri-t-shirt-line`). Add an ACF field `icon` to the `product_cat` taxonomy term, or
hardcode a slug→icon map in the plugin's REST response filter if that's simpler.

## REST endpoints the app calls

All under the standard WP/WooCommerce namespaces — no custom routes needed for
reads:

- `GET /wp-json/wp/v2/listing?per_page=100&_embed=1` — directory
- `GET /wp-json/wp/v2/listing?slug={slug}&_embed=1` — single listing detail
- `GET /wp-json/wp/v2/listing?featured=true` — homepage featured listings
  *(requires a small `pre_get_posts`/REST filter in the plugin to support the
  `featured` query var against the ACF field)*
- `GET /wp-json/wp/v2/listing_category` — directory category filter pills
- `GET /wp-json/wp/v2/product_type?per_page=50&orderby=menu_order` — the
  Product Configurator's admin-managed product list (see the `product_type`
  CPT section above) — powers `/shop/customize`'s Product panel and its
  per-zone customization rules
- `GET /wp-json/wp/v2/posts?per_page=100&_embed=1` — blog index (`/blog`)
- `GET /wp-json/wp/v2/posts?slug={slug}&_embed=1` — single article (`/blog/:slug`)
- `GET /wp-json/wp/v2/posts?categories={id}&exclude={id}&per_page=3` — related posts
- `GET /wp-json/wp/v2/categories` — blog category filter pills
- `GET /wp-json/wc/v3/products?per_page=100` — shop grid
- `GET /wp-json/wc/v3/products?slug={slug}` — single product
- `GET /wp-json/wc/v3/products/categories` — shop filter pills

Custom namespace `connect767/v1`, implemented in `connect767-cms`:

- `POST /connect767/v1/auth/register` — wraps `wp_insert_user()`; body
  `{ name, email, password, accountType }`; returns `{ token, user }`. Sets
  `c767_account_type` user meta to `customer` or `business` from
  `accountType` so business-only features (e.g. "Add Listing") can be gated
  later.
- `POST /connect767/v1/auth/login` — body `{ email, password }`; returns
  `{ token, user }`.
- `GET /connect767/v1/auth/me` — Bearer token required; returns `{ user }`.
- `POST /connect767/v1/match` — the "AI Matching" quiz results
  (`src/pages/MatchPage.jsx`, `src/lib/matching.js`). Body:
  `{ categorySlug, priceTiers: string[], location, priority }` where
  `priority` is one of `rating` / `value` / `location` / `top-tier`. Returns
  listings in the same shape as `GET /wp/v2/listing` (post-mapping), each
  with an added `matchScore` (0–99), pre-sorted highest first. Server-side
  scoring (`class-rest-match.php`) mirrors `src/lib/matching.js`'s weighted
  heuristic line-for-line so ranking behavior doesn't change between local
  fixtures and the live backend — swap in a real ranking model whenever
  that's ready; the response shape is what matters, not the ranking method.
- `POST /connect767/v1/listings` — authenticated write endpoint for the
  "Add Listing" wizard (`src/pages/AddListingPage.jsx`). Creates the listing
  as `pending` rather than writing directly to `wp/v2/listing`, so
  submissions go through moderation before appearing in the public
  directory.
- `POST /connect767/v1/uniform-quotes` — the Uniform Studio's roster/quote
  request (`src/pages/UniformStudioPage.jsx`). Body: `{ template, collar,
  sleeve, colors: { body, sleeve, trim, panel }, layers: [{ type, view, x, y,
  size, rotation, text?, color?, fontFamily?, src? }], roster: [{ name,
  number, size }], previewImage }` — `layers` is the full drag/rotate/resize
  state per front/back view (including per-layer font for text), and
  `previewImage` is the base64 PNG already generated client-side (via
  `html-to-image`) so there's a visual reference without needing to
  re-render the design server-side. Stores as a private `uniform_quote` post
  and emails the site admin.
- `POST /connect767/v1/checkout` — headless WooCommerce checkout. Body:
  `{ items: [{ slug, qty }], email }`; returns
  `{ orderId, checkoutUrl, total }`. Creates a real WooCommerce order and
  hands off to its native payment page.

## Auth

Implemented — `connect767-cms` ships its own self-contained JWT (HS256, no
external library, no third-party plugin dependency):

- `POST /connect767/v1/auth/register` — wraps `wp_insert_user()`, sets
  `c767_account_type` user meta from `accountType`
- `POST /connect767/v1/auth/login` — verifies against core `wp_authenticate()`,
  issues a token
- `GET /connect767/v1/auth/me` — resolves the current user from a Bearer token

See the plugin's `includes/class-jwt.php` and `includes/class-rest-auth.php`.
The signing secret derives from WordPress's own `AUTH_KEY`/`AUTH_SALT` unless
`C767_JWT_SECRET` is defined in `wp-config.php`.

The React app stores the token in `localStorage` (`src/lib/apiClient.js`) and
sends it as `Authorization: Bearer <token>` on every request automatically —
`connect767/v1/listings` and any future authenticated write endpoints validate
this same token via `C767_REST_Auth::user_from_request()`.

**Security note:** WooCommerce consumer key/secret (`src/lib/config.js`) should
only be used for local development directly from the browser. In production,
proxy authenticated WooCommerce calls (orders, customer-specific data) through
the `connect767/v1` namespace so the keys never ship in the client bundle.

## Checkout

Implemented — `POST /connect767/v1/checkout` (see the plugin's
`includes/class-woocommerce.php`) takes the cart items from
`CartDrawer.jsx`, creates a real WooCommerce order via `wc_create_order()`,
and returns `order->get_checkout_payment_url()`. The frontend redirects the
browser there — WooCommerce's own hosted payment page handles whatever
gateways are configured (Stripe, PayPal, etc.). No custom payment processing
was built, deliberately; WooCommerce already solves that well.

**Was 404ing at the exact payment step** — a real bug in
`connect767-frontend`, not in this checkout logic. `get_checkout_payment_url()`
correctly returns a real URL like
`/checkout/order-pay/1480/?pay_for_order=true&key=...`, but the SPA
takeover's reserved-path list only ever excluded WordPress's own core
paths (`/wp-admin`, `/wp-json`, etc.) — never WooCommerce's `/cart`,
`/checkout`, or `/my-account`. So the moment checkout redirected there,
the SPA router swallowed it and served the React app instead, which has
no route for `/checkout/*` — a 404 at the exact moment of paying, on
every single real order.

Fixed in `class-spa-router.php`: now reads WooCommerce's *actual
configured* page URLs via `wc_get_page_permalink()` rather than assuming
the default `/cart`/`/checkout`/`/my-account` slugs, so this keeps working
correctly even if those pages are renamed in WooCommerce → Settings →
Advanced. Verified against the exact URL from the bug report
(`/checkout/order-pay/1480/`) plus a simulated custom-slug site
(`/secure-payment/order-pay/...`) — both now correctly excluded from the
SPA takeover and left for WordPress/WooCommerce to render natively.

### Stripe & PayPal

No code changes needed here — this is the payoff of redirecting to
WooCommerce's own native payment page instead of building custom payment
UI. Whatever gateways are installed and enabled in WooCommerce
automatically show up on that same page once the 404 fix above is
deployed:

1. **Stripe**: install the official, free **WooCommerce Stripe Gateway**
   plugin (or **WooCommerce Payments**, if available in your region) from
   the WordPress plugin directory, then add your real Stripe API keys
   under WooCommerce → Settings → Payments.
2. **PayPal**: install the official, free **WooCommerce PayPal Payments**
   plugin (the current, supported one — not the older, deprecated "PayPal
   Standard" that used to ship in WooCommerce core), connect your real
   PayPal business account under the same Payments settings screen.

Once both are enabled there, they appear as options on the order-pay page
with zero involvement from this codebase.

## Cart didn't survive a page refresh — real bug, fixed

The cart context (`useCart.jsx`) was pure in-memory React state with
nothing backing it — a completely normal, basic e-commerce expectation
(your cart survives a refresh) that was silently broken. Fixed with
localStorage persistence: reads on mount, writes on every change, fails
open to an empty cart rather than crashing if localStorage is unavailable
(private browsing, etc.). Verified directly: added an item, reloaded the
page, confirmed both the header's cart count and the drawer's contents
survived intact. Also now clears the cart once an order is actually
created (checkout） rather than leaving completed-order items sitting
there indefinitely.

## Embedded Stripe checkout — no more leaving the site to pay

The redirect to WooCommerce's own hosted checkout page was a real,
reasonable architectural choice (avoids reinventing payment security) but
a legitimate UX complaint — jumping from the polished React app to a
full-page-reload WordPress page, even styled to match, still feels like
leaving the site. Built the real fix instead of more CSS: **Stripe's own
Payment Element embedded directly in the React app**, so card payment
happens without ever navigating away.

**How it works**: `/checkout` (a real in-app page, not WooCommerce's) →
`POST /connect767/v1/checkout/intent` creates a real pending WooCommerce
order plus a matching Stripe PaymentIntent for the exact total → Stripe's
`<PaymentElement>` collects card details in Stripe's own secure iframe
(raw card numbers never touch this server or the React app's code, same
PCI-compliance model as any Stripe integration) → on submit,
`stripe.confirmPayment()` → **`POST /connect767/v1/checkout/confirm`
verifies the payment status directly with Stripe server-side** before
ever marking the WooCommerce order as paid — the frontend's own claim
that payment succeeded is never trusted alone.

**Setup required** (real API keys, can't be done for you): Connect767 →
Payment Settings in wp-admin, add your Stripe publishable + secret keys
(Stripe dashboard → Developers → API keys; test-mode keys work identically
while setting up). Until these are set, checkout automatically falls back
to the WooCommerce redirect — nothing breaks, it just isn't embedded yet.

**PayPal** deliberately still uses the WooCommerce redirect — install &
configure the official **WooCommerce PayPal Payments** plugin there. This
one's arguably fine as-is: PayPal's own popup/redirect is the pattern
shoppers already recognize and expect, unlike a bare WordPress page for
card entry.

Verified the backend logic with mocks matching Stripe's real API shapes
— confirmed the order amount converts to cents correctly (`$25.00` →
`2500`, Stripe's required smallest-unit format), confirmed the currency
code is lowercased as Stripe requires, and confirmed `confirm_order()`
genuinely calls Stripe's real verification endpoint rather than trusting
the client. Frontend tested end-to-end in demo mode: add to cart → cart
survives a refresh → checkout page shows the order summary and correctly
falls back to WooCommerce's redirect path with a clear "card payment
isn't set up yet" message, since no real Stripe keys exist in this
sandbox to test a real charge against.

### Checkout looked completely unbranded ("basic default Woo")

Expected, once the 404 fix above actually let this page render for the
first time — not a regression. WooCommerce's cart/checkout/my-account
pages render through whatever WordPress theme is active on the *backend*,
completely separate from the React frontend's Tailwind build. Nothing had
ever styled them, since the headless architecture's whole premise is that
the React app owns all the styling — these pages just weren't visible
before (they 404'd), so the fact that they're bare was always true, only
now seen for the first time.

Fixed with a real, scoped stylesheet
(`assets/css/woocommerce-branding.css` + `class-checkout-branding.php`),
loaded *only* on `is_cart()`/`is_checkout()`/`is_account_page()` so it can
never leak anywhere else on the WordPress install:

- Same brand fonts (Fraunces headings, Manrope body) and same colors as
  the React app — converted from the exact same oklch values in
  `src/index.css`, not approximated.
- Branded buttons, form fields, order-review tables, and notices.
- A simple header bar linking back to the shop, so landing on checkout
  from the React app doesn't feel like arriving at a separate, abandoned
  site with no way back.

This is real brand styling applied to WooCommerce's own layout, not a
pixel-perfect recreation of the React app's design — doing that would
mean rebuilding WooCommerce's templates in PHP, a much bigger, separate
undertaking. Verified the enqueue/render logic with mocks of WooCommerce's
own page-detection functions (`is_cart()`, etc.) — confirms both the
stylesheet and the header bar load correctly on cart/checkout pages and
stay off everywhere else.

### Multivendor marketplace (planned, not built yet)

Not built now since this was flagged as a later step, but worth noting:
the checkout endpoint's use of core WooCommerce functions
(`wc_create_order()`, `$order->add_product()`) is the same foundation all
three major WooCommerce multivendor plugins build on —
**Dokan**, **WC Vendors**, and **WCFM Marketplace** — each hooks into
standard WooCommerce orders/products to handle vendor splitting and
payouts, rather than requiring a different order-creation approach. That
means adding one of these later shouldn't require reworking this checkout
flow. Whichever one gets chosen, the main integration work at that point
will be on the *listing* side — letting an approved business owner list
their own products as a "vendor" rather than everything being a single
shop-wide catalog — not the checkout/payment plumbing itself.

## `connect767-frontend`: fonts/images 404-as-HTML bug (fixed)

If Remix Icon fonts fail to load with browser console errors like
`OTS parsing error: invalid sfntVersion` after deploying via
`connect767-frontend`, that was a real architectural bug, now fixed — not a
build issue on the frontend's side.

**Root cause:** the plugin's original approach rewrote root-absolute asset
references (`src="/assets/..."`) inside `index.html` only, after upload.
That never touched two things Vite also emits absolute `/assets/...`
references in: the compiled CSS file's `@font-face { src: url(...) }`
declarations, and any `public/`-sourced path baked into the JS bundle as a
string literal (like the real listings' `<img src="/uploads/...">`). Since
those un-rewritten paths weren't excluded from the SPA's catch-all router,
every request to them was answered with `index.html` (HTML) instead of the
real font/image binary — decoding `<!DOCTYPE html>`'s first bytes as a font
file is exactly what produces "invalid sfntVersion" in the browser console.

**Fix:** rebuilt the router entirely. It no longer rewrites anything. On
every request, it first checks whether a real file exists at that exact
path inside the uploaded `dist/` folder — if so, it serves that file
directly with the correct `Content-Type` (a real static-file lookup table)
and long-lived caching, exactly like `nginx`'s `try_files $uri $uri/
/index.html;` or `serve -s`. Only when no matching file exists does it fall
back to `index.html` for React Router. This means a plain `npm run build`
(default Vite `base: "/"`) now works with zero special handling — every
asset reference, wherever it lives (HTML, CSS, or JS), resolves correctly
because it's served from the real path it was built with.

Also fixed while tracking this down: the upload handler depended on
`WP_Filesystem()`, which can silently fail (no visible error, upload just
does nothing) on hosts where WordPress can't definitively confirm direct
filesystem access and would otherwise prompt for FTP credentials — not
appropriate here since the plugin only ever writes inside its own `dist/`
folder, which it's guaranteed to own. Now uses plain PHP (`ZipArchive`)
instead. **Practical note:** a full built app (with all of Remix Icon's
font formats bundled) is close to 6MB — if uploads fail with no error
shown, check your host's `upload_max_filesize`/`post_max_size` PHP
settings; many hosts default to 2MB.

All of this was verified against a real, running WordPress instance (core +
the official SQLite integration, installed locally since MySQL isn't
available in this environment) — installed both plugins for real, uploaded
an actual `npm run build` output through the real upload endpoint, and
fetched the exact previously-broken font URL: confirmed it now returns
`Content-Type: font/woff2`, exactly 189,216 bytes (byte-for-byte matching
the real file), starting with the real WOFF2 magic number — not
`<!DOCTYPE html>`. Real SPA routes (`/shop`, `/listings/kalinago-tours`)
still correctly fall back to `index.html`, and `/wp-admin`, `/wp-json`
remain untouched.

## Variation picker crashed the whole page white — real bug, found and fixed

`n.toLowerCase is not a function` the moment anyone picked a size/color.
Root cause: `WC_Product_Attribute::get_options()` behaves differently
depending on attribute type — for a **global** attribute (`pa_size`,
`pa_color`, etc. — the standard, default way WooCommerce sites set up
Size/Color, via Products → Attributes), it returns raw **term IDs**
(numbers), not the label strings ("Small", "Medium," etc.) I assumed.
Only custom, non-taxonomy attributes get real strings directly. A number
doesn't have `.toLowerCase()`, so `matchVariation()`'s comparison threw
the instant a real selection was made, and with no error boundary
anywhere in the app, that took the entire page down to blank white.

Fixed on both sides:
- `class-woocommerce.php` now checks `$attribute->is_taxonomy()` and, when
  true, resolves each term ID to its actual name via `get_term()` before
  ever sending it to the frontend. Verified with a mock matching
  WooCommerce's real behavior (`get_options()` returning `[12, 13, 14]`)
  and confirmed it now correctly resolves to `["Small", "Medium", "Large"]`.
- `matchVariation()` in `ProductDetailPage.jsx` now explicitly coerces
  with `String(value)` before comparing, so even an unexpected non-string
  value can never crash the page again — worst case, a variation just
  doesn't match, rather than a blank screen. Verified directly: fed it a
  raw number (simulating the old broken response) and confirmed no crash.
- **Added a real error boundary** (`ErrorBoundary.jsx`, wrapping the routed
  page content in `App.jsx`, keyed by pathname so navigating away from a
  broken page always recovers). This is the part that should have existed
  regardless of this specific bug — one uncaught error anywhere in the
  render tree taking down the *entire* app to a blank white screen with no
  way to recover except a hard refresh is a severe failure mode on its
  own, independent of what caused it. Now any future surprise like this
  shows a real "Something went wrong, reload" message instead.

## Blog card images "don't all show" — confirmed working correctly, not a new bug

Checked every image on the blog listing directly rather than assuming:
the 3 real spotlight posts' images (bundled locally, no third-party
dependency) load correctly every time. The remaining older posts, which
still use `readdy.ai` stock photography, correctly show the branded
fallback placeholder — same known, already-documented limitation as
elsewhere in this file (see the WooCommerce products / real content
sections above), not a new or blog-specific bug. If a live site is
showing raw broken-image icons rather than the styled placeholder for
those, that's the same stale-build pattern as everything else in this
file.

## Blog posts showing no content — a real bug, found and fixed

If a post was ever created through wp-admin's normal editor (not this
plugin's custom "Structured body" meta box — the expected way for anyone
just writing a blog post normally), it would render with a **completely
empty body**. Root cause: `build_acf_object()` in `class-meta-fields.php`
returned `body: []` (empty array) for any array-type field with nothing
stored, rather than `null` — and an empty array is *truthy* in
JavaScript, so the frontend's `acf.body || fallback` never fell through to
the post's real `content.rendered`, even though that real content was
sitting right there in the same REST response.

Fixed on both sides: the backend now returns `null` (not `[]`) for an
unset structured-body field, and the frontend now checks
`acf.body?.length` explicitly rather than relying on truthiness, so this
can't silently break again even if some other field ever has the same
shape. Verified against a real WordPress instance — inserted a post via
`wp_insert_post()` with only `post_content` set (exactly what wp-admin's
normal editor produces), confirmed the REST response's `acf.body` is now
`null`, and confirmed the frontend mapper correctly falls back to
rendering the real paragraph content instead of nothing.

## Industry pill list — too long, unsorted-looking, possible duplicates

The specific list pasted (Services category showing 50+ pills with
duplicates like "Apartments," "Boats," and "Culinary Arts" appearing
twice, and no "View more" cutoff) doesn't match anything in the current
source — checked both `industries.js` and the plugin's
`category-taxonomy.json` directly for duplicate labels and found zero in
either. The "View more" cutoff (14 shown, then a button) is also already
in the current `DirectoryPage.jsx`. This is the same stale-build pattern
as everything else in this doc — what was pasted predates both of these.

Added a defensive de-dup by label when rendering the industry pills
regardless, as cheap insurance against a stale WordPress import ever
having created a genuine duplicate term — so even if that happens, the UI
itself can't show the same label twice.

## Product Customizer v4 — rebuilt against real Printful screenshots

After a Printful screenshot was provided directly, rebuilt against it
rather than my own judgment of what "easier to use" meant — the earlier
3-tab simplification (v3) was a real miss; Printful's own rail has 8
working destinations, not 3, and that's not incidental complexity, it's
real functionality:

- **Rail expanded to match**: Product, Uploads, Text, Clipart, Quick
  Designs, Saved, Premium, Fill, plus Order — each a genuinely working
  tool, not a decorative icon copied from the screenshot.
- **Real per-placement views**, not just front/back — T-Shirt and Hoodie
  now have Front, Back, Left sleeve, Right sleeve, and (T-Shirt only)
  Inside Label as independently-designable placements, matching Printful's
  own tab structure exactly. New `SleevePanel`/`InsideLabelPanel` mockups
  in `ProductGraphic.jsx` for the placements that aren't just the full
  garment.
- **Printing technique selector** (DTG / DTFlex / Embroidery) — a real
  configuration dimension that didn't exist before, included in the
  submitted order payload.
- **Direct upload-on-canvas** — the dashed print-safe-area guide is now
  itself a dropzone with "Upload or drop your design here," matching the
  reference screenshot exactly, not just a side-panel-only action.
- **Uploads library** — every image you upload stays available all
  session so the same logo can go on the front, back, and a sleeve without
  re-uploading it three times.
- **Quick Designs** (one-click starter layouts) and **Saved Designs**
  (session-based save/reload) — both real, working panels now, not just
  rail icons.
- **Fill** — solid/stripe/dot pattern behind the print area.
- **Expanded color grid** (30+ swatches) and **top/bottom bars** matching
  the reference (breadcrumb + undo/redo/close up top, sticky
  thumbnail+price+CTA bar at the bottom).
- Kept the v3 usability fixes that were genuinely good ideas regardless of
  Printful parity — the persistent layer strip and auto-edit-on-add for
  text — since removing working improvements just to match a screenshot
  more literally wouldn't have been a real improvement either.

## Product variations completely missing from individual product pages

A real, separate gap from the customizer work — found while investigating
this report: the WooCommerce proxy (`class-woocommerce.php`) only ever
returned simple-product data, even for a normal variable product (the
standard WooCommerce setup for apparel — Size/Color attributes with
per-combination price/stock/image). `ProductDetailPage.jsx` had no picker
UI at all, and its "Add to Cart" button had **no `onClick` handler
whatsoever** — a second, silent bug found while fixing the first.

Also found the cart itself was entirely local `useState` inside
`ShopPage.jsx` — invisible to the Header and to the product detail page,
so "add to cart" from an individual product page had nothing to add to
even before the missing handler. Fixed properly rather than patched:

- `format_product()` now detects `is_type('variable')` and fetches real
  attributes (`wc_attribute_label()`) and variations
  (`get_available_variations()`-equivalent via `get_children()` +
  `wc_get_product()`), each with its own price/stock/image/purchasability.
- **Cart lifted into a real shared context** (`useCart.jsx`) — works
  identically from the Shop grid, an individual product page, and shows a
  live count in the Header on every page, not just Shop.
- `ProductDetailPage.jsx` renders a size/color picker for any product with
  attributes, updates price/image/stock live as you pick, and requires a
  complete, in-stock, purchasable selection before enabling Add to Cart.
- Checkout (`class-woocommerce.php`'s `checkout()`) now adds the specific
  ordered **variation**, not the parent product — ordering the parent
  directly would either silently order the wrong size/color or fail
  outright, since a variable product itself generally isn't purchasable.

Verified the PHP against a realistic mock of WooCommerce's actual
`WC_Product_Variable`/`WC_Product_Variation` methods (couldn't install
real WooCommerce in this sandbox — its GitHub repo is the full development
monorepo, not an installable build). Verified the frontend by temporarily
adding one variable test product to local fixtures, confirming size/color
selection, live price/stock updates, and cart correctness — including
catching a real bug this way: the button *displayed* "Add to cart" once a
valid selection was made, but stayed genuinely disabled, because
purchasability was being read from the (correctly non-purchasable)
variable parent instead of the matched variation. Fixed, re-verified, and
the test product was removed before packaging — no dummy data shipped.

## Product Customizer v3 — the interaction model itself was the problem

After the v2 visual/feature pass, feedback was that it still wasn't easy
to use — correctly diagnosed as a structural problem, not something more
features or polish would fix:

- **Rail cut from 6 destinations to 3** (Design / Add / Order). Text,
  Artwork, and Clipart were three separate top-level tabs for what's really
  one task — "add something to my design" — now one "Add" tool with pill
  sub-tabs (`AddContentPanel` in `CustomizerPanels.jsx`).
- **Persistent layer strip** (`LayerStrip.jsx`) — always visible directly
  above the canvas, in every tool, not hidden behind a "Layers" tab you had
  to navigate to and lose your place. Click a chip to select, click its ×
  to remove, without ever leaving whatever you're doing. This was the
  single biggest fix — "hard to manage" in the feedback was almost
  entirely this.
- **New text starts empty and already in edit mode** — click "Add text
  layer" and you can type immediately. Previously it added a placeholder
  layer you then had to discover you could double-click to rename, which
  is exactly the kind of hidden-gesture friction that makes a tool feel
  hard to use even when the underlying capability is fine.
- **A visible pencil button** on any selected text layer, as a discoverable
  alternative to the double-click gesture, which stays available for those
  who already know it.
- **Empty-state hint** in the layer strip ("Nothing on this side yet —
  add text, artwork, or clipart...") instead of a blank ambiguous canvas.

Verified all of it directly rather than assuming the restructure worked:
confirmed the rail actually shows 3 items, confirmed a fresh text layer
renders as an editable `<input>` immediately (not a static span requiring
a hidden double-click), confirmed typed text appears and shows up in the
layer strip without switching tools, confirmed the strip stays visible
after switching to the Design tool, and confirmed both the pencil button
and the strip's own delete button work. Re-confirmed the Uniform Studio is
still completely unaffected (it never shared these components to begin
with, post-v2).

## Product Customizer v2 — premium redesign + real feature set

Reworked after feedback that the first version's dark workspace didn't fit
and needed to feel more like a serious design tool, not just more
features:

**Visual**: the black workspace background is gone — replaced with a
soft, layered light gradient (cream → secondary → primary tints), a
frosted-glass floating toolbar (`backdrop-blur`, translucent white)
instead of a solid dark bar, elevated cards with soft ambient shadows
instead of flat panels, and a glowing/scaling active state on selected
buttons instead of a flat color swap.

**New, genuinely functional features** (not just visual — each tested):
- **Undo/redo** — full history stack, toolbar buttons and Ctrl+Z/Ctrl+Shift+Z.
  Found and fixed a real bug while building this: calling `setHistory`
  from inside a `setLayers` updater function double-pushed history under
  React StrictMode's intentional double-invocation of updaters, corrupting
  the undo stack. Fixed by computing the next state once, then setting
  layers and history as separate, sibling calls — verified with a real
  add → add → undo → undo → redo → redo sequence.
- **Keyboard shortcuts** — Delete/Backspace removes the selected layer,
  arrow keys nudge position by 1%, Ctrl+D duplicates, all correctly
  ignored while a text input has focus (so typing "Delete" in a size field
  doesn't wipe a layer).
- **Clipart library** — 20 built-in colorable icons (stars, hearts,
  trophies, etc.) that drop onto the design as full layers — draggable,
  resizable, rotatable, recolorable exactly like uploaded artwork or text.
- **Text effects** — bold, italic, outline, drop shadow, and curved text
  (via SVG `textPath`), all live-editable from the floating toolbar.
- **Layer opacity** — a slider on every layer type.
- **Mirror to other side** — one click copies every layer on the current
  view to the other view (front↔back), for anything meant to print the
  same on both sides.
- **Alignment grid toggle** and **zoom reset** (click the zoom percentage).
- **Live bulk-pricing calculator** — quantity-based discount tiers
  (12+/25+/50+) computed and displayed in real time in the Order panel,
  factored into the submitted `estimatedTotal`.

Verified end-to-end again after the rewrite: all of the above interacted
with directly (not just rendered) — added/removed layers via keyboard,
confirmed undo/redo actually restores the right state at each step,
confirmed bold text actually changes computed `font-weight`, confirmed
arrow-key nudging actually moves the element's bounding box, confirmed
Ctrl+D actually adds a second layer to the panel. Also re-confirmed the
Uniform Studio (`/uniforms`) is completely unaffected — it uses its own
forked copy of the layer/toolbar components now (`ProductDraggableLayer.jsx`,
`ProductFloatingToolbar.jsx`), so none of this could regress it even in
principle, and a live drag-and-drop test on the Uniform Studio after all
these changes confirms that directly.

## Product Customizer — Printful-style shop customizer

`/shop/customize` (linked from a "Design your own gear" CTA on `/shop`) —
a full drag/resize/rotate product designer for T-Shirts, Hoodies, Socks,
and Caps, matching the same feature set as the existing Uniform Studio
(`/uniforms`) since it's genuinely the same underlying interaction system,
just applied to shop apparel instead of team jerseys:

- Product type + base color selection, with the same dynamic-recolor
  technique as the Uniform Studio's jerseys (`fabricShades()` — one hex
  becomes a highlight/base/shadow gradient, so any color previews instantly
  without needing separate product photos per color)
- Front/back view toggle where it makes sense (T-Shirt, Hoodie); single
  view for Socks and Cap
- Upload artwork (PNG/SVG) or add text — both fully draggable, resizable,
  and rotatable, with a floating contextual toolbar (font, color, size,
  layer ordering) — this is the exact same `DraggableLayer.jsx` and
  `FloatingToolbar.jsx` the Uniform Studio uses, reused directly rather
  than rebuilt, since the interaction logic was already 100% generic (no
  jersey-specific code in either component)
- Layers panel, zoom, PNG export
- "Request order" — quantity, sizes, contact email — submits to a new
  `POST /connect767/v1/product-quotes` endpoint (mirrors
  `class-rest-uniform-quotes.php`'s pattern exactly), storing the full
  design as a private `product_quote` post and emailing the admin. New
  admin menu: **Custom Orders**.

New files: `src/data/customizer.js` (product catalog), `src/components/product-customizer/`
(`ProductGraphic.jsx` — the 4 SVG mockups, `ProductStage.jsx`, `CustomizerPanels.jsx`),
`src/pages/ProductCustomizerPage.jsx`. Backend: `class-rest-product-quotes.php`,
plus the `product_quote` CPT in `class-post-types.php`.

Verified end-to-end against a real WordPress instance: submitted an order
through the actual REST endpoint and confirmed it landed as a genuine
private post with the complete design payload (product type, color,
quantity, sizes, layers) intact in the database — not just a 200 response.

**Scope note**: this is a real, functional MVP of the same caliber as the
Uniform Studio, not a full Printful clone — 4 product types (a reasonable
starting set covering "socks, sportswear" as asked) rather than Printful's
full catalog, and single-color garments (no fabric patterns/textures).
Adding more product types is mostly a matter of drawing another SVG shape
in `ProductGraphic.jsx` and adding an entry to `productTypes` in
`customizer.js` — the drag/resize/rotate/layers/order machinery already
supports any product type without changes.

## Shop shows no products / "must show real WooCommerce products"

Two things going on here, both addressed:

1. **Same root cause as everything else in this section** — if the shop is
   empty, check the demo-mode notice first. Local fixtures deliberately
   ship with an empty `products` array (all 16 placeholders were removed;
   see "Real content only" below), so with no backend connected, an empty
   shop is the *correct* behavior, not a bug.
2. **A real fix, not just a config issue**: shop products/categories used
   to call WooCommerce's REST API (`wc/v3`) directly from the browser,
   which requires a consumer key/secret — and those were being read from
   `VITE_WC_CONSUMER_KEY`/`VITE_WC_CONSUMER_SECRET`, baked into the public
   JS bundle same as any other Vite env var. That's fine for local dev,
   inappropriate for a real production site (anyone can read a WooCommerce
   API secret out of the built bundle in devtools) — flagged as a known
   issue in an earlier pass but never fixed until now.

   Replaced entirely with a server-side proxy: `GET /connect767/v1/shop/products`
   and `/shop/categories` in `class-woocommerce.php`, using WooCommerce's own
   `wc_get_products()` — no REST credentials involved at all, since it's
   running inside WordPress already. Response is pre-shaped to match what
   `wc/v3` would have returned, so `mapWcProduct`/`mapWcCategory` in
   `mappers.js` didn't need to change. `VITE_WC_CONSUMER_KEY`/`_SECRET` are
   gone from `.env.example`, `config.js`, and `apiClient.js` — there's
   nothing sensitive to configure or accidentally expose anymore.

   Verified the data transformation with realistic mocks of WooCommerce's
   actual `WC_Product` methods (`get_price()`, `get_regular_price()`,
   `is_on_sale()`, etc.) and confirmed the output flows correctly through
   the real `mapWcProduct()` end-to-end — couldn't spin up a full
   WooCommerce install in this sandbox (unlike WordPress core, WooCommerce's
   GitHub repo is the full development monorepo, not an installable build,
   and WordPress.org's plugin directory isn't reachable from here), so this
   is verified via mocked-but-accurate method signatures rather than a live
   store — worth a smoke test against your actual WooCommerce catalog after
   deploying.

## Add Listing wizard's Preview step — confirmed 100% identical, not just similar

The Preview step doesn't build a lookalike mockup — it renders the exact
same `ListingProfile.jsx` component the real `/listings/:slug` page uses,
fed with the form's current data instead of fetched data (see
`AddListingPage.jsx`'s `buildPreviewData()`). Confirmed this is genuinely
the same component rendering, not just visually close: filled out the
wizard to match Kalinago Tours' real data and compared the rendered DOM
directly against the actual `/listings/kalinago-tours` page — the
`ListingProfile`-owned elements (its `<h1>`, its Save button) come out with
byte-for-byte identical CSS class strings on both pages, which wouldn't be
possible unless it's the same component tree. If a deployed site shows a
different-looking preview, that's a stale build — rebuild and redeploy the
frontend (see the CORS/demo-mode troubleshooting above for the redeploy steps).

## "Frontend shows real listings, wp-admin shows nothing/old content"

This has a real, mundane cause worth understanding rather than a bug to
chase: **the deployed frontend and wp-admin can genuinely be looking at two
different data sources**, and they'll look identical on the surface because
the 3 real listings were mirrored into both places on purpose.

- If `VITE_WP_BASE_URL` isn't set in the frontend's build environment, the
  app runs entirely on its own bundled local fixtures (`src/data/*.js`) —
  it never talks to WordPress at all, in either direction. It'll show the 3
  real listings correctly (they're baked into the fixtures too), which
  makes it *look* connected even when it isn't.
- Meanwhile wp-admin only shows what's actually been imported there. If the
  importer was never run (or was run before this plugin's data was trimmed
  down to real content), wp-admin's Listings screen will be empty or show
  stale placeholder content — completely independent of whatever the
  frontend happens to be displaying.

**To confirm which situation this is:** open the frontend and try
registering an account or submitting a listing. If a "Demo mode — no
backend connected" notice appears on the form, the frontend isn't talking
to WordPress at all, and nothing you do there will ever appear in
wp-admin — check the deployed build's `VITE_WP_BASE_URL`. If that notice
doesn't appear, the frontend is genuinely connected, and the fix is
simpler: go to **Connect767 → Import Sample Content**, click **Import
sample content** if you haven't, and **Remove outdated sample content** if
old placeholder listings are still showing (see above).

## Account dashboard

Registered business owners now have somewhere to land besides the Add
Listing wizard — **`/dashboard`**, linked from the header's account menu
(desktop dropdown and mobile menu both). Shows every listing the logged-in
user has ever submitted, including ones still `pending` review, via a new
authenticated endpoint: `GET /connect767/v1/listings/mine` (see
`class-rest-listings.php`) — filters by `post_author`, matching the
already-correct behavior of `submit()` setting `post_author` to the
authenticated user. Redirects to `/auth/login` if not authenticated, and
back to `/dashboard` afterward.

Verified against a real WordPress instance: registered a user, submitted a
listing through the real endpoint, and confirmed `/listings/mine` correctly
returned it — including the category term resolving to the real,
properly-capitalized taxonomy term ("Restaurants") once the taxonomy was
seeded first, not a garbage duplicate.

**Also fixed while building this**: `useAuth.js` had a stale comment
reading "a real JWT would be decoded here instead once the plugin is
live" — and it really was still just decoding the *local fake-token*
format, which would have silently shown garbled/missing user info for
anyone actually logged in against a real backend (this plugin's real JWT
payload only carries `user_id`, not email — there was nothing correct to
decode client-side). Login/register responses already include the full
user object; that's now cached directly (`c767_auth_user` in
localStorage) instead of trying to decode the token.

## Real content only — dummy listings and products removed

**If the live directory still shows old dummy listings after this change**,
that's expected and has a real cause: the importer only ever *adds*
content — it never removed the 12 old placeholder listings that a prior
import run already created, since they're just gone from the fixture data
now, not flagged for deletion anywhere. Fixed with a real cleanup tool:
**Connect767 → Import Sample Content → "Remove outdated sample content"**
finds anything previously imported (tagged `c767_seed_slug`) whose slug
isn't in the *current* fixture data and moves it to trash — verified
against a real WordPress instance by manually inserting two stale dummy
listings (simulating exactly this scenario), running the cleanup, and
confirming the REST API dropped back to exactly the 3 real listings
afterward. Anything created manually (no seed marker) is never touched.

**Image mix-up caught and fixed**: Catherine Lewis's listing briefly had a
second gallery photo (`catherine-lewis-2.jpg`, from the original upload
batch's `IMG_9863`) that was actually a photo of Luana Laurent (Finance
Focus) — the same "assumed adjacent files belong together" mistake as the
earlier `Final_Logo.png` mix-up, which turned out to be the Kalinago Tours
logo. Confirmed by direct visual comparison (same green wall, same plant,
same tablet, same outfit as Luana's bio photo) rather than assumption this
time. Replaced with the verified-correct second photo — the one embedded
directly inside Catherine Lewis's own YMCA award docx — and deleted the
wrong file entirely so it can't get reused by mistake.

All placeholder/dummy content has been removed from the frontend fixtures
(and this plugin's importer data mirrors it):

- **Directory**: only the 3 real, client-provided listings remain (Kalinago
  Tours, Finance Focus Consultancy, Catherine Lewis). All 12 dummy
  businesses from the original source export are gone.
- **Shop**: all 16 dummy products removed — the shop is intentionally empty
  until real products are provided. `ShopPage.jsx`'s existing empty-state
  handles this gracefully (no crash, no fake data).
- **Homepage testimonial removed entirely** rather than left showing a
  fabricated quote — it was attributed to "Amara Joseph, Owner, Cocoa Palm
  Bistro," a person and business that don't exist. Fabricated social proof
  is worse than none; the section is gone until a real testimonial exists.
- **Known remaining reference**: one blog post ("How to write a listing
  that gets clicked") uses Cocoa Palm Bistro as an illustrative writing
  example in its prose, and the "amara" author persona's bio still
  references it. Left as-is since this is editorial/instructional content,
  not a displayed fake listing — but worth knowing about if going fully
  real-content-only extends to blog copy too.
- The importer (`class-importer.php`) and its admin page copy now reflect
  these real counts. Re-running the importer on an existing install is
  still safe (idempotent) and won't resurrect removed dummy content, since
  it only ever creates content matching current fixture data, never deletes.

## What's built vs. what's left

Built, in `connect767-cms`:
- `listing` + `uniform_template` CPTs, `listing_category` + `uniform_sport`
  taxonomies, structured location fields (country/region/city)
- Synthetic `acf` REST field for both (works without the real ACF plugin)
- Self-contained JWT auth (register/login/me)
- Server-side AI Matching (`/match`) mirroring `src/lib/matching.js` exactly
- Authenticated listing submission (`/listings`, creates as `pending`)
- Uniform Studio quote requests (`/uniform-quotes`, emails admin)
- Headless WooCommerce checkout bridge (`/checkout`)
- CORS handling for the separately-hosted frontend
- One-click sample content importer matching the frontend's local fixtures
- Admin dashboard with content counts and a pending-listings review queue
  (Approve/Reject)
- Row-based repeater editor for gallery/reviews fields (no more raw JSON)
- Optional `connect767-frontend` plugin to serve the built React app directly
  from the WordPress site's own domain
- `listing_category` terms expose an `acf.icon` field (Remix Icon class) via
  REST, matching the pattern already used for WooCommerce `product_cat` —
  editable on the term screen or set automatically by the importer
- Real WordPress author data (name/avatar/bio via `_embed=1`) is used for
  blog post bylines in live mode, falling back to the local
  team/amara/marcus personas only when a post's `author_key` matches one of
  those three or no embedded author is present

Frontend-side connection audit (found while investigating "doesn't fully
connect"): two components — the homepage's category grid and the shop
teaser's category pills — were importing static fixture data directly
instead of going through `repository.js`, meaning they'd never reflect
WordPress data even with a backend connected. Both now correctly call
`getHomeCategories()` / `getShopCategories()` and switch on `isLiveApi` like
every other page. Also added a global broken-image fallback
(`src/lib/imageFallback.js`) — every stock image in the frontend fixtures
points at `readdy.ai`'s search-image endpoint, a third-party API this app
doesn't control; any image that fails to load anywhere in the app now shows
a branded placeholder instead of the browser's broken-image icon, whatever
the cause.

**Backend verified against a real, running WordPress instance** (not just
code review) — installed WordPress core + the SQLite database integration
locally, activated `connect767-cms` for real, ran the importer, and hit the
actual REST endpoints. This caught two real bugs static analysis had missed:

1. **Garbage taxonomy terms.** `term_exists()`/`wp_insert_term()` return
   term IDs as numeric strings (straight from the DB layer). `wp_set_object_terms()`
   does a strict `is_int()` check to decide whether a value is a term ID or a
   term name/slug to look up — an uncast numeric string silently fell into
   the "treat as a name" branch and **created a garbage new top-level term**
   literally named after the ID (e.g. a term named `"185"`) instead of
   reusing the real term. Fixed in `class-importer.php` by explicitly
   `(int)`-casting every term ID before it's used.
2. **Category/industry name collision.** The source spreadsheet has
   "Fitness" as both one of the 7 top-level categories *and* — after
   correcting the "Fitneess" typo — an industry under "Events". A
   parent-blind `term_exists( $name, $taxonomy )` lookup (no parent
   argument) found the wrong "Fitness" term and nested the entire top-level
   Fitness category as a child of Events instead of creating its own
   top-level term. Fixed by passing an explicit `$parent` argument through
   `ensure_term()` so a category and an industry that happen to share a
   name under a different parent are no longer conflated.

Both confirmed fixed against a from-scratch install: 198 `listing_category`
terms (7 + 191, exactly as expected), zero garbage numeric-named terms, all
7 top-level categories present including a correctly-independent Fitness,
and Events keeps its own legitimate "Fitness" industry as a separate term.
Also re-verified registration end-to-end this way — `POST
/connect767/v1/auth/register` returns a real JWT and the user genuinely
appears in `wp-admin/users.php` in a completely separate session query, plus
the CORS preflight fix returns the correct `Access-Control-*` headers for a
real cross-origin `OPTIONS` request.

Still open:
- Real product/listing photography — the importer points at the same
  `readdy.ai` placeholder URLs the frontend fixtures already use (via a
  `fallback_image` meta field), not downloaded into the media library. The
  image fallback above keeps this from ever looking broken, but it's still
  a placeholder, not a real photo
- Rate limiting / spam protection on the public write endpoints
  (`/uniform-quotes`, `/auth/register`) before this goes to production traffic

## Environment variables

See `.env.example`. Nothing needs to be set for local development — the app runs
entirely on fixtures until `VITE_WP_BASE_URL` is present.
