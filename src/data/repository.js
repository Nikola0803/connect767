import { isLiveApi } from "../lib/config";
import { wpClient, customClient } from "../lib/apiClient";
import {
  mapWcProduct,
  mapWcCategory,
  mapListingCpt,
  mapListingDetail,
  mapWpPost,
  mapProductTypeCpt,
  decodeEntities,
} from "../lib/mappers";
import { matchListingsLocally } from "../lib/matching";
import { allIndustries } from "./industries";

// Industry slugs from the canonical taxonomy. The Add Listing wizard submits
// an *industry* slug (e.g. "accounting-and-bookkeeping"); a plugin bug
// (fixed in connect767-cms 1.0.1) used to pass that raw slug to
// wp_set_object_terms(), which creates a brand-new TOP-LEVEL term when the
// industry term doesn't exist yet — which is how "accounting-and-bookkeeping"
// showed up as a major category on the directory page and in the homepage
// pills. The plugin now reparents those strays on upgrade, but this filter
// keeps them out of the top-level category UI regardless of backend state.
const industrySlugSet = new Set(allIndustries.map((i) => i.slug));

// Local fixtures — used until the WordPress/WooCommerce plugin is live.
import { products as localProducts, shopCategories as localShopCategories } from "./shop";
import {
  directoryListings as localListings,
  directoryCategories as localDirectoryCategories,
} from "./directory";
import { listingDetails as localListingDetails } from "./listingDetails";
import { productTypes as localProductTypes } from "./customizer";
import { listings as localFeaturedListings, categories as localHomeCategories } from "./content";
import { blogPosts as localBlogPosts, blogCategories as localBlogCategories, getRelatedPosts } from "./blog";

/**
 * Every function here returns a Promise and the same shape, whether the data
 * comes from local fixtures (today) or a live WordPress/WooCommerce REST API
 * (once VITE_WP_BASE_URL is set — see src/lib/config.js). Pages should always
 * go through this file rather than importing the fixture files directly, so
 * swapping the backend later is a one-file change.
 */

// ---------- Shop (WooCommerce `product`) ----------

export async function getProducts() {
  if (isLiveApi) {
    const wc = await customClient.get("/shop/products");
    return wc.map(mapWcProduct);
  }
  return localProducts;
}

export async function getProductBySlug(slug) {
  if (isLiveApi) {
    const wc = await customClient.get("/shop/products", { slug });
    return wc[0] ? mapWcProduct(wc[0]) : null;
  }
  return localProducts.find((p) => p.slug === slug) || null;
}

export async function getShopCategories() {
  if (isLiveApi) {
    const wc = await customClient.get("/shop/categories");
    return [
      { slug: "all", label: "All Products", icon: "ri-store-3-line" },
      // WooCommerce always has a built-in "Uncategorized" term that every
      // product falls into by default until it's actually assigned a real
      // category — showing it as its own filter pill next to real
      // categories reads as a broken/empty category to a shopper, so it's
      // excluded here the same way local fixtures never included it.
      ...wc.filter((c) => c.slug !== "uncategorized").map(mapWcCategory),
    ];
  }
  return localShopCategories;
}

/**
 * Headless WooCommerce checkout. Creates a real WooCommerce order server-side
 * (connect767/v1/checkout, see connect767-cms's class-woocommerce.php) and
 * returns a URL to WooCommerce's native "pay for order" page — payment
 * itself is handled by whatever gateways are configured in WooCommerce
 * (Stripe, PayPal, etc.), not reimplemented here.
 *
 * Without a live backend, there's no real order to create, so this throws —
 * callers should catch and show a "connect a backend to check out" message.
 */
export async function checkout(items, email) {
  if (!isLiveApi) {
    throw new Error(
      "Checkout needs a live WordPress/WooCommerce backend — set VITE_WP_BASE_URL to enable it."
    );
  }
  return customClient.post("/checkout", {
    items: items.map((item) => ({ slug: item.slug, qty: item.qty, variationId: item.variationId })),
    email,
  });
}

/**
 * Embedded Stripe checkout — collects card details directly in the React
 * app (via Stripe's own Payment Element, see CheckoutPage.jsx) instead of
 * redirecting to WooCommerce's separate hosted page. `checkout()` above
 * still exists as the fallback for anyone who hasn't configured Stripe
 * yet, or for other payment methods.
 */
export async function getCheckoutConfig() {
  if (!isLiveApi) return { stripeEnabled: false, stripePublishableKey: "" };
  return customClient.get("/checkout/config");
}

export async function createPaymentIntent(items, email) {
  return customClient.post("/checkout/intent", {
    items: items.map((item) => ({ slug: item.slug, qty: item.qty, variationId: item.variationId })),
    email,
  });
}

export async function confirmOrder(orderId) {
  return customClient.post("/checkout/confirm", { orderId });
}

/**
 * PayPal's counterpart to createPaymentIntent()/confirmOrder() above — same
 * cart -> WooCommerce order building server-side (class-paypal-checkout.php's
 * create_order()), just paid via PayPal's Smart Buttons (PaypalButton.jsx)
 * instead of Stripe's embedded Payment Element. Was never called from
 * CheckoutPage.jsx even though the backend route has existed all along,
 * which is why PayPal never showed up on Shop checkout.
 */
export async function createCartPaypalOrder(items, email) {
  return customClient.post("/checkout/paypal/order", {
    items: items.map((item) => ({ slug: item.slug, qty: item.qty, variationId: item.variationId })),
    email,
  });
}

export async function captureCartPaypalOrder(orderId) {
  return customClient.post("/checkout/paypal/capture", { orderId });
}

// ---------- Directory (WordPress `listing` CPT) ----------

export async function getListings() {
  if (isLiveApi) {
    const wp = await wpClient.get("/listing", { per_page: 100, _embed: 1, status: "publish" });
    return wp.map(mapListingCpt);
  }
  return localListings;
}

export async function getListingBySlug(slug) {
  if (isLiveApi) {
    const wp = await wpClient.get("/listing", { slug, _embed: 1 });
    return wp[0] ? mapListingDetail(wp[0]) : null;
  }
  return localListingDetails[slug] || null;
}

/**
 * `listing_category` is hierarchical — 7 top-level categories (Services,
 * Products, Rentals, Eat & Drink, Events, Fitness, Other) with ~190 more
 * specific industries nested underneath each one (see src/data/industries.js
 * for the same taxonomy mirrored locally). Without `parent: 0`, WP returns
 * every term in the taxonomy — parents and children all flattened into one
 * alphabetically-sorted list — so `per_page: 50` filled up entirely with
 * child industries (their names sort earlier than most of the parents') and
 * the actual top-level categories never made it into the response at all.
 * That's what showed up as the category row not loading / a giant flat pile
 * of unrelated pills instead of the intended 7 categories.
 */
export async function getDirectoryCategories() {
  if (isLiveApi) {
    const wp = await wpClient.get("/listing_category", { per_page: 50, parent: 0 });
    return [
      { slug: "all", label: "All Categories", icon: "ri-apps-2-line" },
      // Drop industry slugs that ended up at the top level (see
      // industrySlugSet above) — they belong under a parent category, not
      // next to Services/Products/Rentals in the main filter.
      ...wp
        .filter((t) => !industrySlugSet.has(t.slug))
        .map((t) => ({ slug: t.slug, label: decodeEntities(t.name), icon: t.acf?.icon })),
    ];
  }
  return localDirectoryCategories;
}

/**
 * Ranks listings against a few quiz answers ("AI Job Matching"-style flow —
 * see src/lib/matching.js for the scoring itself). Returns listings sorted
 * by matchScore, each with a `matchScore` (0–99) attached.
 */
export async function matchListings(criteria) {
  if (isLiveApi) {
    return customClient.post("/match", criteria);
  }
  const listings = await getListings();
  return matchListingsLocally(listings, criteria);
}

// ---------- Homepage ----------

export async function getFeaturedListings() {
  if (isLiveApi) {
    const wp = await wpClient.get("/listing", { per_page: 6, featured: true, _embed: 1 });
    return wp.map(mapListingCpt);
  }
  return localFeaturedListings;
}

export async function getHomeCategories() {
  if (isLiveApi) {
    // Same `parent: 0` fix as getDirectoryCategories() above — without it
    // this returned whichever 8 terms (parent categories or individual
    // industries) happened to have the highest post counts, not the 7
    // top-level categories the homepage's "Trending" pills expect.
    const wp = await wpClient.get("/listing_category", {
      per_page: 8,
      parent: 0,
      orderby: "count",
      order: "desc",
    });
    // `href` is required by Hero.jsx's trending pills and Categories.jsx's
    // "Browse by category" grid (both do `/listings${cat.href}`) — without
    // it every category link resolved to the literal string
    // "/listingsundefined" instead of "/listings?category=<slug>".
    return wp.filter((t) => !industrySlugSet.has(t.slug)).map((t) => ({
      name: decodeEntities(t.name),
      count: `${t.count} listings`,
      icon: t.acf?.icon,
      href: `?category=${t.slug}`,
    }));
  }
  return localHomeCategories;
}

// ---------- Blog (WordPress `post`) ----------

export async function getBlogPosts() {
  if (isLiveApi) {
    const wp = await wpClient.get("/posts", { per_page: 100, _embed: 1 });
    return wp.map(mapWpPost);
  }
  return localBlogPosts;
}

export async function getBlogCategories() {
  if (isLiveApi) {
    const wp = await wpClient.get("/categories", { per_page: 20 });
    return [
      { slug: "all", label: "All Posts", icon: "ri-apps-line" },
      // Real WP category terms don't carry an icon of their own — fall
      // back to a generic tag icon rather than leaving the pill's icon
      // slot empty, so the live-data pills still match the fixture ones
      // visually (see BlogPage.jsx / src/data/blog.js).
      ...wp.map((c) => ({ slug: c.slug, label: c.name, icon: "ri-price-tag-3-line" })),
    ];
  }
  return localBlogCategories;
}

export async function getBlogPostBySlug(slug) {
  if (isLiveApi) {
    const wp = await wpClient.get("/posts", { slug, _embed: 1 });
    return wp[0] ? mapWpPost(wp[0], { detail: true }) : null;
  }
  return localBlogPosts.find((p) => p.slug === slug) || null;
}

export async function getRelatedBlogPosts(post, limit = 3) {
  if (isLiveApi) {
    const wp = await wpClient.get("/posts", {
      categories: post.categoryId,
      exclude: post.id,
      per_page: limit,
      _embed: 1,
    });
    return wp.map(mapWpPost);
  }
  return getRelatedPosts(post, limit);
}

// ---------- Write endpoints (auth / submissions) ----------

/**
 * Add Listing wizard submission. Requires auth — see connect767-cms's
 * class-rest-listings.php, which creates the listing as `pending` for
 * moderation rather than publishing directly.
 *
 * Builds real multipart/form-data (not JSON) whenever any files are
 * present, so the logo/cover photo/gallery images actually reach the
 * server as binary uploads — class-rest-listings.php stores them in the
 * WordPress Media Library via media_handle_upload()/media_handle_sideload().
 */
export async function submitListing(form) {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { id: "local-preview", status: "pending" };
  }

  const payload = new FormData();
  const textFields = [
    "businessName",
    "category",
    "priceTier",
    "description",
    "tags",
    "location",
    "phone",
    "email",
    "website",
    "instagram",
    "facebook",
    "youtube",
    "twitter",
    "whatsapp",
    "education",
    "experienceLevel",
    "tier",
    "logoPosition",
    "logoZoom",
    "coverPosition",
    "coverZoom",
  ];
  textFields.forEach((key) => {
    if (form[key]) payload.append(key, form[key]);
  });

  if (form.logoFile) payload.append("logo", form.logoFile);
  if (form.photoFile) payload.append("coverPhoto", form.photoFile);
  (form.galleryFiles || []).forEach((file) => payload.append("gallery[]", file));

  return customClient.post("/listings", payload);
}

/**
 * Edit an existing listing — AddListingPage.jsx reuses the submission
 * wizard in "edit mode" (route /listings/:slug/edit) rather than a
 * separate form. Hits connect767/v1/listings/{id} (POST, not PUT/PATCH —
 * see class-rest-listings.php's update() docblock for why: PHP only
 * populates $_FILES for POST, so a replaced logo/cover photo needs it).
 */
export async function updateListing(id, form) {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { id, status: "pending" };
  }

  const payload = new FormData();
  const textFields = [
    "businessName",
    "category",
    "priceTier",
    "description",
    "tags",
    "location",
    "phone",
    "email",
    "website",
    "instagram",
    "facebook",
    "youtube",
    "twitter",
    "whatsapp",
    "education",
    "experienceLevel",
    "logoPosition",
    "logoZoom",
    "coverPosition",
    "coverZoom",
  ];
  textFields.forEach((key) => {
    if (form[key]) payload.append(key, form[key]);
  });

  if (form.logoFile) payload.append("logo", form.logoFile);
  if (form.photoFile) payload.append("coverPhoto", form.photoFile);
  (form.galleryFiles || []).forEach((file) => payload.append("gallery[]", file));

  return customClient.post(`/listings/${id}`, payload);
}

/**
 * Powers the account dashboard (DashboardPage.jsx). In local/demo mode
 * there's no backend to have actually persisted a prior submission to, so
 * this always returns an empty list rather than fabricating fake "your
 * listings" data — the dashboard shows an explanatory empty state instead.
 */
export async function getMyListings() {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [];
  }
  return customClient.get("/listings/mine");
}

// ---------- Vendor marketplace ("Buy" cards on a Classified listing) ----------
// See connect767-cms's class-rest-vendor-products.php for the matching
// backend routes. These were previously imported by ListingProducts.jsx
// (the public storefront) and VendorProductsPanel.jsx (the dashboard's
// "Products & services" tab) but never actually defined here, which meant
// every call — including the dashboard's own "Active"/"Hidden" toggle — hit
// a `TypeError: ... is not a function` at runtime and silently failed. That
// TypeError happening inside getListingProducts()'s uncaught call (nothing
// wraps the call itself in try/catch, only the resulting promise) is also
// why the "Buy" section — and the PayPal button inside it — never rendered
// at all on a listing profile: the products fetch never got the chance to
// resolve or reject, it just threw.

/** Public "Buy" cards on a listing's profile — only ever active products. */
export async function getListingProducts(slug) {
  if (!isLiveApi) return [];
  return customClient.get(`/listings/${slug}/products`);
}

/** Dashboard "Products & services" — every product the current user owns, active or not. */
export async function getMyVendorProducts() {
  if (!isLiveApi) return [];
  return customClient.get("/vendor-products/mine");
}

export async function createVendorProduct(form) {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { id: `local-preview-${Date.now()}` };
  }
  const payload = new FormData();
  payload.append("listingId", form.listingId);
  payload.append("name", form.name);
  payload.append("priceCents", form.priceCents);
  if (form.description) payload.append("description", form.description);
  if (form.imageFile) payload.append("image", form.imageFile);
  return customClient.post("/vendor-products", payload);
}

/** Also used for the dashboard's quick "Active"/"Hidden" toggle (just sends `active`). */
export async function updateVendorProduct(id, form) {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { id, ...form };
  }
  const payload = new FormData();
  if (form.name !== undefined) payload.append("name", form.name);
  if (form.priceCents !== undefined) payload.append("priceCents", form.priceCents);
  if (form.description !== undefined) payload.append("description", form.description);
  if (form.active !== undefined) payload.append("active", form.active ? "1" : "0");
  if (form.imageFile) payload.append("image", form.imageFile);
  return customClient.post(`/vendor-products/${id}`, payload);
}

export async function deleteVendorProduct(id) {
  if (!isLiveApi) return { id, deleted: true };
  return customClient.del(`/vendor-products/${id}`);
}

/** Dashboard "Sales" — read-only, for manual payout bookkeeping. */
export async function getMyVendorOrders() {
  if (!isLiveApi) return [];
  return customClient.get("/vendor-orders/mine");
}

/** Card payment for a vendor product — see PaypalButton's sibling Stripe path in ListingProducts.jsx. */
export async function createVendorProductCheckout(productId, { name, email }) {
  if (!isLiveApi) {
    throw new Error("Checkout needs a live WordPress backend — set VITE_WP_BASE_URL to enable it.");
  }
  return customClient.post(`/vendor-products/${productId}/checkout`, { name, email });
}

export async function confirmVendorOrder(orderId) {
  if (!isLiveApi) return { status: "paid", orderId };
  return customClient.post(`/vendor-orders/${orderId}/confirm`, {});
}

/** PayPal's counterpart to createVendorProductCheckout() — see PaypalButton.jsx. */
export async function createVendorProductPaypalOrder(productId, { name, email }) {
  if (!isLiveApi) {
    throw new Error("Checkout needs a live WordPress backend — set VITE_WP_BASE_URL to enable it.");
  }
  return customClient.post(`/vendor-products/${productId}/paypal-order`, { name, email });
}

export async function captureVendorProductPaypalOrder(orderId) {
  if (!isLiveApi) return { status: "paid", orderId };
  return customClient.post(`/vendor-orders/${orderId}/paypal-capture`, {});
}

// ---------- Classified listing fee ($40/yr — embedded Stripe + PayPal) ----------
// See connect767-cms's class-stripe-listing-checkout.php. The backend side
// of this was fully built (embedded PaymentIntent + PayPal order, same
// pattern as the vendor marketplace above) but AddListingPage.jsx never
// actually called any of it — every Classified submission went out with
// `payment_status: 'unpaid'` and no way to pay, silently falling back to
// "we'll follow up about billing." These four calls are what
// AddListingPage.jsx's payment step (after a Classified submission) uses.

export async function createListingPaymentIntent(listingId) {
  if (!isLiveApi) {
    throw new Error("Payment needs a live WordPress backend — set VITE_WP_BASE_URL to enable it.");
  }
  return customClient.post("/listings/payment-intent", { listingId });
}

export async function confirmListingPayment(listingId) {
  if (!isLiveApi) return { status: "paid", listingId };
  return customClient.post("/listings/payment-confirm", { listingId });
}

export async function createListingPaypalOrder(listingId) {
  if (!isLiveApi) {
    throw new Error("Payment needs a live WordPress backend — set VITE_WP_BASE_URL to enable it.");
  }
  return customClient.post("/listings/paypal-order", { listingId });
}

export async function captureListingPaypalOrder(listingId) {
  if (!isLiveApi) return { status: "paid", listingId };
  return customClient.post("/listings/paypal-capture", { listingId });
}

/** Uniform Studio "Request quote" submission. */
export async function submitUniformQuote(payload) {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { id: "local-preview" };
  }
  return customClient.post("/uniform-quotes", payload);
}

/**
 * The Product Customizer's per-product config — what products exist, what
 * each one costs, its optional 3D model, and (most importantly) its
 * customizable zones, all admin-managed in wp-admin's Product Configurator
 * screen (the `product_type` CPT — see connect767-cms's class-post-types.php
 * and class-meta-fields.php). Falls back to data/customizer.js's fixtures
 * — which mirror the same shape — until a backend is connected, so
 * ProductCustomizerPage never needs to know which source it got.
 */
export async function getProductTypes() {
  if (isLiveApi) {
    const wp = await wpClient.get("/product_type", { per_page: 50, orderby: "menu_order" });
    const mapped = wp.map(mapProductTypeCpt);
    return mapped.length ? mapped : localProductTypes;
  }
  return localProductTypes;
}

/** Shop Product Customizer "Request order" submission. */
export async function submitProductCustomOrder(payload) {
  if (!isLiveApi) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { id: "local-preview" };
  }
  return customClient.post("/product-quotes", payload);
}
