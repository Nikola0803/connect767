# Connect767 — React/Vite rebuild

A pixel-accurate React + Vite recreation of the Connect767 site, built directly from the saved
production HTML (readdy.cc export): same Tailwind v4 design tokens (oklch color scales), same
fonts (Fraunces / Manrope / Inter), same copy, same Remix Icon iconography, and the same image
URLs — architected to plug into a headless WordPress + WooCommerce backend with no component
rewrites, **and now actually connected to one**: `connect767-cms`, a companion WordPress plugin
(CPTs, REST API, self-contained JWT auth, AI matching, headless WooCommerce checkout, and a
one-click sample content importer). See **[WORDPRESS.md](./WORDPRESS.md)** for the full
integration details and setup steps.

## Pages

- `/` — Homepage (hero with an inline "Try our AI Matching" prompt under the trending tags,
  a featured-listings carousel right below the hero, categories, how it works, pricing,
  testimonial, blog, partner marquee — the Uniform Studio teaser now lives on `/shop` instead)
- `/match` — AI Matching (3-step quiz → ranked results with match %, à la truckdriverjobs.co's
  "Get Matched")
- `/shop` — Shop (promo banner, category filters, sort, product grid, functional cart drawer,
  Uniform Studio cross-sell teaser)
- `/shop/:slug` — Product detail
- `/shop/customize` — Product Customizer: a real-time 3D product configurator (rotate/zoom
  preview of the actual garment, not a flat mockup) for admin-managed products (t-shirt, hoodie,
  socks, cap out of the box). Precise placement stays on a flat 2D editor; toggle to "3D Preview"
  to see the live design mapped onto a rotating model. What products exist and what can be
  customized where (text/logo/recolor, per placement) is controlled entirely from wp-admin's
  Product Configurator screen — see `WORDPRESS.md`'s `product_type` CPT section — not hardcoded.
- `/listings` — Directory (search, category/tier/price filters, sort, Google Maps embed,
  grid/list view toggle, pagination, deep-linkable via `?category=`)
- `/listings/:slug` — Listing detail (image gallery, description, amenities, hours, reviews,
  contact sidebar with map)
- `/listings/submit` — Add Listing (4-step wizard: tier, business info, contact & media, review)
- `/blog` — Blog index (search, category filter, pagination)
- `/blog/:slug` — Full article (author, tags, related posts)
- `/uniforms` — Uniform Studio (sport tabs, template gallery, interactive customizer with a live
  roster builder, pricing tiers, FAQ)
- `/about` — About Connect767 (mission, vision, management team, services)
- `/help` — Help Center (shipping, returns, featured listings, FAQ)
- `/privacy` — Privacy Policy
- `/auth/login`, `/auth/register` — Auth
- `*` — 404

Routing is handled with `react-router-dom`. The header automatically switches between its
transparent (homepage, over the hero image) and solid/bordered (interior pages) styling based on
the current route, matching the source site exactly, highlights the active nav item, and shows an
account menu once signed in.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Architecture

**Data flows through one layer, everywhere.** No page imports fixture data directly — every page
calls `src/data/repository.js`, which returns local fixture data today and will call the
WordPress/WooCommerce REST API once a backend is configured (`VITE_WP_BASE_URL` in `.env.local`),
with zero changes needed in any component. See `WORDPRESS.md` for the full plan, including the
exact CPT/ACF field list the companion plugin needs to expose.

```
src/
  components/
    ui/          Shared primitives — Button, FormField (Input/Select/Textarea),
                  TierBadge, StarRating, States (Spinner/Skeleton/Empty/Error).
                  Every page/form uses these instead of one-off styling.
    uniform-studio/  The Uniform Studio's customizer engine — JerseyGraphic (SVG jersey
                  with colorable zones), JerseyStage (canvas + print-area guide
                  + export ref), DraggableLayer (move/rotate/resize/inline-edit),
                  FloatingToolbar (contextual per-layer editing), StudioPanels
                  (Design/Text/Logo/Layers/Roster side panels).
    product-customizer/  The Product Configurator (`/shop/customize`) — flat 2D editor
                  (ProductStage/ProductDraggableLayer, same drag/resize/rotate physics
                  as Uniform Studio) plus garment3d/ for the real-time 3D preview
                  (Product3DStage, GarmentModel, DesignPlane, DesignCapture,
                  zoneAnchors) built on react-three-fiber. Simplified to a 4-tab rail
                  (Product/Text/Art/Order) — Quick Designs, Saved Designs, Premium
                  clipart, and Fill patterns were demo padding and were removed.
    ...           Header, Footer, ProductCard, DirectoryListingCard, CartDrawer,
                  PromoBanner, AuthLayout, BlogPostCard, and the homepage section
                  components.
  pages/          One component per route.
  data/
    repository.js   The single data-access layer every page calls.
    shop.js, directory.js, listingDetails.js, content.js   Local fixtures
                    (today's data source; shape mirrors what the WP/WC REST
                    API will return).
  lib/
    config.js      Reads VITE_WP_BASE_URL / WooCommerce keys; isLiveApi flag.
    apiClient.js    Thin fetch wrapper for wp/v2, wc/v3, and the custom
                    connect767/v1 namespace; stores the auth token.
    mappers.js      WP/WooCommerce REST shape → the flat view-model shape
                    components already expect.
    color.js        Hex color → fabric-style gradient shading (highlight/base/
                    shadow) for the Uniform Studio's jersey graphic.
    authClient.js   login()/register()/logout() — simulated locally, ready
                    for a real JWT endpoint (see WORDPRESS.md).
  hooks/
    useAsync.js     Loading/error/data state for any repository call.
    useAuth.js      Reactive auth state (email, isAuthenticated) for the header.
    useDraggableLayer.js  Pointer-based drag-to-move / drag-to-resize for the
                    Uniform Studio's text and logo layers.
  index.css         Tailwind v4 theme — exact color tokens + fonts from the source site.
  App.jsx           Router + shared layout (Header / Footer).
```

## Auth

`/auth/login` and `/auth/register` both render a single `AuthPage.jsx` with a Sign In / Sign Up
tab switcher — not two separate pages. Switching tabs updates the URL (so it's still
bookmarkable/shareable) without a full page reload. Registration is business-only — Connect767
doesn't have a separate shopper/customer account type, so there's no account-type picker; every
signup lands on the Add Listing wizard afterward. Shop checkout stays guest (no account needed to
buy).

The header's top-right nav is intentionally minimal: **Add Listing** and **List Your Business**
only — no separate "Sign in" link, since the auth page's tab switcher covers that. Once logged
in, both are replaced by an account menu (email + Add a listing + Sign out).

Wiring this to a real backend just means pointing `authClient.js` at the endpoints documented in
`WORDPRESS.md` — no UI changes required.

## Shop page notes

- **Empty by design** — all 16 placeholder products were removed; `src/data/shop.js`'s `products`
  array is intentionally `[]` until real products are added (same pattern used for the 3 real
  listings — see "Real listings" below). The empty state renders cleanly, no crash.
- Category filters and the sort dropdown are fully functional (client-side filtering/sorting).
- "Add to cart" is wired to a real (in-memory) cart with a working drawer, quantity merging,
  remove, and subtotal — the source export only showed the drawer's empty state, so this fills
  in the natural next step.
- "Checkout" calls `connect767/v1/checkout` (via `checkout()` in `repository.js`), which creates a
  real WooCommerce order and redirects to WooCommerce's own hosted payment page — no custom
  payment processing was built, deliberately. Without a connected backend, it shows a clear
  "requires a live backend" message instead of pretending to work.
- Product categories (`apparel`, `home`, `outdoor`, etc.) were inferred from each product's tags
  since the static export didn't expose the underlying category field — adjust in
  `src/data/shop.js` if you have the real mapping. In the WooCommerce version this becomes a real
  product category, no guessing required.
- `/shop/:slug` product detail page is a new addition (not in the original export) since the
  product cards already linked there — built to match the shop's visual language.
- Content is constrained to `max-w-7xl` like every other page — it wasn't originally, so on wide
  screens the grid stretched edge-to-edge instead of matching the homepage's width.
- The Uniform Studio teaser section ("Kit up the whole squad — in one window") lives here now,
  not on the homepage — a shop-adjacent cross-sell for custom uniforms made more sense next to
  physical products than as a homepage section.

## Category & industry taxonomy

- `src/data/industries.js` is the canonical source: **7 top-level categories** (Services,
  Products, Rentals, Eat & Drink, Events, Fitness, Other) with **191 specific industries** nested
  under them, generated directly from the client's spreadsheet (`New_website_categories.xlsx`) —
  not invented. A few obvious typos in the source were corrected ("Immegration" → "Immigration",
  "Dacing" → "Dancing", "Fitneess" → "Fitness"). `Other` had no industries listed in the source
  spreadsheet, so it gets a single generic "General" entry rather than an empty dropdown group.
- This is the *second* taxonomy revision — an earlier pass built a 26-category / 145-industry
  structure from an earlier version of the client's spreadsheet. When the client sent an updated
  spreadsheet with a simpler 7-category structure, `industries.js` was regenerated from scratch
  and every consumer re-pointed at it: the directory's category filter (progressive-disclosure
  industry sub-filter once you pick a category), the Add Listing wizard's industry picker
  (grouped `<optgroup>` dropdown, 191 options), the homepage's category grid (now shows all 7,
  not a curated subset), and the WordPress plugin's `listing_category` taxonomy (hierarchical —
  see `WORDPRESS.md`).
- All 15 seed listings (12 original + 3 real client-provided ones — see below) carry both a
  `categorySlug` and `industrySlug` under the current taxonomy (e.g. Cocoa Palm Bistro → Eat &
  Drink → Restaurants).

## Real listings

Three listings are real, client-provided content — not readdy.ai stock photography or invented
copy — sourced from documents and photos the client sent directly:

- **Kalinago Tours** (`kalinago-tours`) — a real tour operator based in Dominica's Kalinago
  Territory. Copy, logo, and photo are straight from the client's brand materials.
- **Finance Focus Consultancy** (`finance-focus-consultancy`) — Luana Laurent's financial
  consulting practice in Roseau. Bio, logo, and photo sourced from her official bio PDF.
- **Catherine Lewis** (`catherine-lewis`) — a Dominica-born Con Edison director recognized as a
  YMCA Black Achiever in Industry; sourced from a public press release. This one's a genuine test
  of the "Featured Professional" package type from `Different_Packages_for_Listing.docx` — an
  individual, not a business, with no logo, phone, or email, just a professional profile.

Their images live in `public/uploads/` (served locally by Vite) — the `connect767-cms` plugin
bundles the same files under `assets/real-listings/` and resolves the frontend's `/uploads/...`
paths to that bundled location at import time (see `class-importer.php`'s
`resolve_image_url()`), since a separate WordPress install can't reach the React app's own
`public/` folder.

Building these real profiles surfaced two real bugs in `ListingDetailPage.jsx` that every
previous listing's complete data had been masking: the Amenities/Hours sections rendered an empty
heading with nothing underneath when a listing had none, and the contact card rendered broken
`tel:`/`mailto:`/website links when phone, email, or website were blank (Kalinago Tours has no
phone/email, Catherine Lewis has none of the three). Both are now conditionally rendered, with a
"Visit Website" fallback CTA when there's a site but no phone/email.

## Content pages

- `/about`, `/help`, and `/privacy` use real copy provided by the client (mission/vision, the
  founder and CTO's actual bios, shipping/returns policy, FAQ, and the privacy policy) — not
  placeholder text. Previously these were `#anchor` links in the footer that went nowhere.
- Reference screenshots included with that content showed real example listings using Dominica's
  actual parish-level locations (Saint George, Saint David, Saint Andrew, Saint John, etc.) — this
  lines up with the `location_region` field already added to the `listing` CPT (see
  `WORDPRESS.md`), confirming that's the right level of granularity for the "region" field once
  real listings start coming in.

## Directory page notes

- Search, category pills, tier/price filters, sort, and the grid/list toggle are all fully
  functional against the real listing data, and the category filter is deep-linkable
  (`/listings?category=eats` from the homepage category grid).
- The source export's directory page showed "30 listings found" with pagination for 3 pages, but
  only page 1 (the 12 listings actually rendered in the saved HTML) was captured — pages 2–3 were
  never in the DOM to extract. Those 12 real businesses are reproduced exactly (names, categories,
  prices, ratings, locations, tier badges, images). Pagination is wired up and will activate
  automatically once more listings are added to `src/data/directory.js` — if you can export pages
  2 and 3 the same way, send them over and I'll fill in the rest.
- The Google Maps embed uses the exact `iframe` URL from the source (no API key required for the
  basic embed format).

## Listing detail page notes

- `src/data/listingDetails.js` holds full profile content (gallery, description, tags, amenities,
  hours, reviews, contact info, map) keyed by slug. Only **Cocoa Palm Bistro** has real data —
  it's the one detail page that was in the export you sent.
- Every other listing in the directory still links to `/listings/:slug` and renders — it just
  falls back to the summary data already in `directory.js` (image, rating, category, location)
  with a placeholder description and no reviews/contact card, rather than a broken page. Send
  more detail-page exports the same way and I'll add them to `listingDetails.js`.
- The image gallery, thumbnail switching, and star ratings are fully functional.

## Add Listing wizard notes

- The saved export only captured **Step 1 (Choose Tier)** — steps 2–4 are client-side state in
  the original app and were never in the static DOM, so there was no markup to extract for
  Business Info, Contact & Media, or Review.
- Step 1 is reproduced exactly. Steps 2–4 are newly designed using the shared UI kit
  (`components/ui/FormField.jsx`, `Button.jsx`) so they're visually identical to every other form
  in the app — not one-off styling.
- The whole flow is functional: tier selection, field validation gating "Continue," a live Review
  step summarizing everything entered (using the same `TierBadge` shown everywhere else), and a
  success state on submit. Submits to `connect767/v1/listings` (via `submitListing()` in
  `repository.js`) once a backend is connected — creates the listing as `pending` for moderation.
  Without a backend, it simulates success so the flow is fully testable offline.
- Contact & Media step has two separate uploads — a circular logo/profile picture and a
  wide cover photo — each with a real live preview (`URL.createObjectURL`), not just a filename.
- **Known gap:** the Review step is still a text summary table, not a full visual preview
  matching the actual `/listings/:slug` page layout. Worth building if business owners want to
  see exactly what their public profile will look like before submitting.

## Blog notes

- Full pages, not from the original export (only 3 homepage teaser cards existed before) —
  `/blog` and `/blog/:slug` are new, designed to match the rest of the site.
- 6 full articles with real body copy, across 4 categories (Playbook, Shop, Uniforms, Community)
  — search, category filtering, and pagination on the index are all functional.
- Article content in `src/data/blog.js` is original editorial writing in the site's voice, not
  extracted from a real source — expected to be replaced by real WordPress posts once the backend
  is live (see `WORDPRESS.md` for the exact `post` fields expected, including the optional
  structured `body` field for rich content blocks).

## Uniform Studio notes

- `/uniforms` is a professional-grade product customizer — modeled on how tools like Printful's
  and Canva's actually work.
- **Visual quality**: the jersey is drawn with the same technique real dynamic-mockup tools use
  (Placeit, Smartmockups, and Printful's own simple color-swap previews) — a shading map recolored
  per zone via gradients, not a flat vector fill and not a static photo. Concretely
  (`src/components/uniform-studio/JerseyGraphic.jsx`, `src/lib/color.js`):
  - Smooth curved silhouette (quadratic bezier paths) instead of straight polygon edges.
  - Each zone (body/sleeve/trim/panel) gets a highlight → base → shadow gradient computed live
    from its selected hex color, not a flat fill — this is what makes it read as fabric rather
    than clip art.
  - A soft drop shadow under the whole garment, ambient occlusion under the collar, and subtle
    fold-highlight strokes for depth.
  - Collar/sleeve options still genuinely change the SVG path (V-neck cuts a real notch, long
    sleeves are a different shape, sleeveless removes the sleeve) — not a filter over one image.
  - **Honest limit**: this is still a vector illustration, not a photograph or a 3D render. True
    Printful-level fidelity needs either real product photography per variant or a 3D rendering
    pipeline — both need assets/infrastructure outside what's buildable in this environment. This
    is the closest achievable approximation using the same recoloring technique the industry
    actually uses for dynamic previews.
- **Workspace chrome**: dark neutral tool rail, gray canvas backdrop, product centered on a white
  card, print-safe-area dashed guide — deliberately distinct from the marketing-page styling
  around it, the way real design software reads differently from the page hosting it.
- **A real floating contextual toolbar** appears above the canvas the moment you select a layer —
  font family, color swatches, size stepper, rotation reset, bring-forward/send-back, duplicate,
  delete (`FloatingToolbar.jsx`).
- **Drag to move, drag the black handle to rotate, drag the green handle to resize**, with
  snap-to-center alignment guides (a thin accent line appears and the layer locks to center when
  you drag close, both axes independently) — built on a custom pointer-drag hook
  (`src/hooks/useDraggableLayer.js`).
- **Double-click any text layer to edit its content inline**, right on the canvas.
- **Three real font choices** (Athletic/Oswald, Clean/Manrope, Classic/Fraunces), independent per
  text layer.
- **Duplicate layer**, front/back view thumbnails (accurate live previews reflecting current
  colors, not static icons), zoom controls.
- **PNG export** (`html-to-image`) — "Download PNG" captures the current design, and a preview
  thumbnail renders on the quote-request success screen.
- **Roster builder** (name/number/size, add/remove) lives in its own tool tab — crossing 12
  players surfaces Team Kit pricing inline.
- Sport tabs (deep-linkable via `?sport=`) and the template gallery are unchanged in spirit, but
  **each template now has its own default collar/sleeve** (`src/data/uniforms.js`), so the
  gallery cards genuinely look different from each other.
- "Request quote" submits to `connect767/v1/uniform-quotes` (via `submitUniformQuote()` in
  `repository.js`) once a backend is connected — the payload includes the full layer state
  (position, rotation, size, color, font per text/logo layer on both views) plus the exported PNG
  preview. Without a backend, it simulates success so the flow is fully testable offline.

## AI Matching notes

- `/match` is a new feature (not from the original export) — modeled on truckdriverjobs.co's "Try
  our AI Job Matching" flow: a few quick questions, then every listing ranked by a match
  percentage instead of a flat list. On the homepage it's a compact prompt inside the hero search
  card, right below the "Trending" tags (`src/components/Hero.jsx`) — not a separate section.
- The 3 steps: category, budget + location, and what matters most (highest rated / best value /
  closest / top-tier only) — the last one changes how heavily each factor is weighted.
- The scoring itself (`src/lib/matching.js`) is a transparent, documented weighted heuristic, not
  a live ML model — but it's built as a drop-in for one. `matchListings()` in the repository
  calls it locally today and will call `POST connect767/v1/match` once the backend exists (see
  `WORDPRESS.md`), returning the exact same shape either way, so `MatchPage.jsx` doesn't change.
- Location matching is currently a loose substring match against the flattened `location` string
  — flagged in `WORDPRESS.md` as one of the reasons to move to structured country/region/city
  fields on the `listing` CPT.

## Notes

- Images are loaded from the original `readdy.ai/api/search-image` URLs used by the source site.
  If you'd rather self-host them, drop replacement files in `public/` and update the relevant
  `src/data/*.js` fixture.
- Icons use the `remixicon` npm package (same icon set as the source site).
- Colors are defined as CSS custom properties in `src/index.css` under `@theme`, matching the
  original site's exact `oklch()` palette (background / primary / accent / secondary / foreground
  scales) — primary is the original green. A blue (`#0077B5`) variant was tried at one point and
  reverted back to green.
- Every card component (directory listings, shop products, blog posts, the homepage's featured
  carousel) is fully clickable — the whole card is a `<Link>`, not just the title — with inner
  interactive elements (Add to Cart, save/heart buttons) using `stopPropagation` so they don't
  trigger navigation.
