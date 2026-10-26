import { createListingSearchText } from "./listingSearch";
import { currentYearsExperience } from "./experience";
import { findCategory, findIndustry } from "../data/industries";
import { normalizeBookingType } from "./bookingTypes";

/**
 * Mappers between raw WordPress/WooCommerce REST API shapes and the flat
 * "view model" shapes the React components already consume. Keeping this
 * translation in one place means the UI never has to know or care whether
 * its data came from local fixtures or a live WP install — see
 * src/data/repository.js for where these get used.
 */

function stripHtml(html = "") {
  return decodeEntities(html.replace(/<[^>]*>/g, "").trim());
}

/**
 * HTML -> plain text, KEEPING the paragraph structure the author typed.
 *
 * `stripHtml()` is right for titles and excerpts, where markup is noise. It's
 * wrong for a body of writing: WordPress stores a listing description in
 * `post_content` and runs wpautop over it, so
 *
 *     line one
 *
 *     line two
 *
 * comes back as `<p>line one</p>\n<p>line two</p>`. Deleting the tags without
 * putting anything in their place leaves the two paragraphs stuck together on
 * consecutive lines — which is why a blank line typed into the description
 * box never survived to the public profile.
 *
 * Block-level ends become a blank line, <br> a single one, and runs of three
 * or more newlines are squeezed back to one blank line so a gap can't grow
 * every time a description is edited and re-saved.
 */
function htmlToText(html = "") {
  const withBreaks = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(withBreaks)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * WordPress's REST API returns text fields (titles, term names, etc.)
 * with HTML entities encoded — e.g. "Accounting &amp; Bookkeeping" for a
 * term literally named "Accounting & Bookkeeping". That's correct and
 * normal for a classic PHP-templated theme, where the browser's own HTML
 * parser decodes entities as it parses the page. React doesn't do that —
 * `{term.name}` inserts the string as a plain text node, so an encoded
 * "&amp;" shows up on screen exactly as those 5 literal characters, not
 * as "&". Every WP-sourced string needs this before display.
 *
 * Uses a <textarea> rather than a <div> for the decode: setting
 * `.innerHTML` on a textarea never creates real child elements or fires
 * embedded event handlers (the browser treats everything inside as
 * literal text), so this can't become an XSS vector even for a
 * maliciously-crafted string, unlike a div.innerHTML approach would risk.
 */
export function decodeEntities(str = "") {
  if (typeof document === "undefined" || !str) return str;
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

function firstTerm(wpPost, taxonomy) {
  const terms = wpPost?._embedded?.["wp:term"]?.flat() || [];
  return terms.find((t) => t.taxonomy === taxonomy);
}

/**
 * WordPress boolean meta -> real boolean.
 *
 * These flags are stored as the STRINGS '1' and '0' (see class-meta-fields.php
 * and class-rest-listings.php), and `Boolean("0")` is `true` in JavaScript. A
 * plain Boolean() cast therefore read every switched-OFF flag as ON — so a
 * business that had deliberately turned bookings off would still show the
 * booking form, and every listing would render the verified checkmark.
 */
function isTruthyMeta(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "number") return value !== 0;
  const v = String(value).trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "no";
}

function featuredImage(wpPost) {
  const media = wpPost?._embedded?.["wp:featuredmedia"]?.[0];
  return media?.source_url || media?.media_details?.sizes?.large?.source_url || "";
}

/** WooCommerce `product` -> shop ProductCard view model */
export function mapWcProduct(wc) {
  return {
    id: wc.id,
    slug: wc.slug,
    title: decodeEntities(wc.name),
    category: decodeEntities(wc.categories?.[0]?.name || ""),
    categorySlug: wc.categories?.[0]?.slug || "",
    price: parseFloat(wc.price || wc.regular_price || 0),
    originalPrice: wc.on_sale && wc.regular_price ? parseFloat(wc.regular_price) : null,
    rating: wc.average_rating || "0",
    reviews: `(${wc.rating_count ?? 0})`,
    tags: (wc.tags || []).map((t) => decodeEntities(t.name)),
    image: wc.images?.[0]?.src || "",
    inStock: wc.stock_status ? wc.stock_status === "instock" : true,
    // Variable products (the normal WooCommerce setup for apparel — Size,
    // Color, etc.) — `attributes` drives the picker UI, `variations` is
    // matched against the current picks to find price/stock/image/id for
    // the exact SKU actually being ordered. Simple products just won't
    // have either of these, and the detail page treats that as "no picker
    // needed."
    type: wc.type || "simple",
    purchasable: wc.purchasable !== false,
    attributes: wc.attributes || [],
    variations: (wc.variations || []).map((v) => ({
      id: v.id,
      // Raw WC variation attribute keys look like `attribute_pa_size` (or
      // `attribute_size` for a custom, non-global attribute) with
      // slugified lowercase values (e.g. "small") — normalized here to
      // bare lowercase attribute names so matching against the picker's
      // selected labels is a simple case-insensitive compare, regardless
      // of whether an attribute happens to be global or custom.
      attributes: Object.fromEntries(
        Object.entries(v.attributes || {}).map(([key, value]) => [
          key.replace(/^attribute_/, "").replace(/^pa_/, "").toLowerCase(),
          String(value).toLowerCase(),
        ])
      ),
      price: parseFloat(v.price || v.regular_price || 0),
      regularPrice: v.regular_price ? parseFloat(v.regular_price) : null,
      onSale: Boolean(v.on_sale),
      inStock: v.stock_status ? v.stock_status === "instock" : true,
      purchasable: v.purchasable !== false,
      image: v.image || null,
    })),
  };
}

/** WooCommerce product category -> shop filter pill */
export function mapWcCategory(wc) {
  return {
    slug: wc.slug,
    label: decodeEntities(wc.name),
    icon: wc.acf?.icon || "ri-price-tag-3-line", // set via ACF on the term, falls back to a default
  };
}

/** WordPress `listing` CPT -> directory card view model */
export function mapListingCpt(wp) {
  const acf = wp.acf || wp.meta || {};
  // A listing carries up to two listing_category terms: the top-level
  // category (parent === 0, e.g. "services") and the industry under it
  // (parent !== 0, e.g. "accounting-and-bookkeeping"). firstTerm() grabbed
  // whichever came first in the embed, so categorySlug could end up being
  // the industry slug — and DirectoryPage's top-level filter
  // (`l.categorySlug === category`) would then never match the listing.
  // Split them explicitly instead.
  const hierarchyTerms = Array.isArray(wp?.listing_category_hierarchy)
    ? wp.listing_category_hierarchy
    : [];
  const embeddedTerms = wp?._embedded?.["wp:term"]?.flat() || [];
  const allCatTerms = (hierarchyTerms.length ? hierarchyTerms : embeddedTerms).filter(
    (t) => t.taxonomy === "listing_category"
  );
  const categoryTerm = allCatTerms.find((t) => !t.parent) || allCatTerms[0];
  const industryTerm = allCatTerms.find((t) => t.parent);
  const parentCategorySlug =
    findIndustry(industryTerm?.slug)?.categorySlug ||
    findIndustry(acf.category_slug)?.categorySlug ||
    findCategory(categoryTerm?.slug)?.slug ||
    findCategory(acf.category_slug)?.slug ||
    "";

  const title = stripHtml(wp.title?.rendered || wp.title || "");
  const category = decodeEntities(acf.category_label || categoryTerm?.name || "");
  const yearsExperience = currentYearsExperience(
    acf.years_experience,
    acf.years_experience_as_of_year,
  );
  const publicProfile = {
    title,
    slug: wp.slug,
    description: acf.description || htmlToText(wp.content?.rendered || ""),
    category,
    categorySlug: categoryTerm?.slug || acf.category_slug || "",
    parentCategorySlug,
    industry: industryTerm
      ? { name: decodeEntities(industryTerm.name), slug: industryTerm.slug }
      : null,
    priceTier: acf.price_tier || "$",
    tier: acf.tier || "Free",
    verified: isTruthyMeta(acf.verified) ? "verified" : "",
    rating: acf.rating || "0",
    reviewCount: acf.review_count ?? 0,
    location: {
      display: acf.location || acf.location_display || "",
      country: acf.location_country || "",
      region: acf.location_region || "",
      city: acf.location_city || "",
      address: acf.address || "",
    },
    education: acf.education || "",
    degreeType: acf.degree_type || "",
    experienceLevel: acf.experience_level || "",
    yearsExperience,
    tags: acf.tags || [],
    amenities: acf.amenities || [],
    hours: acf.hours || [],
    gallery: acf.gallery || [],
    reviews: acf.reviews || [],
    contact: {
      phone: acf.phone || "",
      email: acf.email || "",
      website: acf.website || "",
      instagram: acf.instagram || "",
      facebook: acf.facebook || "",
      youtube: acf.youtube || "",
      twitter: acf.twitter || "",
      whatsapp: acf.whatsapp || "",
    },
    attributes: [
      isTruthyMeta(acf.verified) ? "verified" : "",
      isTruthyMeta(acf.featured) ? "featured" : "",
      isTruthyMeta(acf.booking_enabled) ? "booking available accepts bookings" : "",
    ],
    map: acf.map_embed_url || "",
    media: {
      logo: acf.logo || "",
      fallbackImage: acf.fallback_image || "",
      featuredImage: featuredImage(wp),
    },
  };

  return {
    id: wp.id,
    slug: wp.slug,
    title,
    category,
    categorySlug: categoryTerm?.slug || acf.category_slug || "",
    parentCategorySlug,
    // Powers DirectoryPage's industry sub-filter (`l.industrySlug ===
    // industry`) — this was never populated before, so the sub-filter
    // silently matched nothing on live data.
    industrySlug: industryTerm?.slug || "",
    industryLabel: industryTerm ? decodeEntities(industryTerm.name) : "",
    description: acf.description || htmlToText(wp.content?.rendered || ""),
    logo: acf.logo || "",
    tags: (acf.tags || []).map((tag) => decodeEntities(tag)),
    amenities: (acf.amenities || []).map((amenity) => decodeEntities(amenity)),
    price: acf.price_tier || "$",
    location: acf.location || "",
    badge: acf.tier || "Free",
    badgeIcon:
      acf.tier === "Classified"
        ? "ri-vip-crown-line"
        : acf.tier === "Featured"
        ? "ri-star-line"
        : "ri-price-tag-3-line",
    verified: isTruthyMeta(acf.verified),
    // Backed by the CMS's `booking_enabled` meta (class-meta-fields.php) and
    // class-rest-bookings.php, both of which already existed — the frontend
    // simply never read or wrote it, so the owner had no way to turn bookings
    // on despite it being advertised as a Classified feature.
    bookingEnabled: isTruthyMeta(acf.booking_enabled),
    bookingType: normalizeBookingType(acf.booking_type),
    bookingPriceCents: Math.max(0, Number(acf.booking_price_cents) || 0),
    bookingDurationMinutes: Math.max(15, Number(acf.booking_duration_minutes) || 30),
    rating: acf.rating || "0",
    reviews: `(${acf.review_count ?? 0})`,
    // The cover photo IS the WordPress featured image — class-rest-listings.php
    // stores the uploaded `coverPhoto` with set_post_thumbnail(), not as a
    // meta field (which is also why it has no URL row in wp-admin next to
    // logo/gallery; it's in the Featured image box). It therefore has to win
    // over the gallery here: the old order put gallery first, so the moment a
    // listing had any gallery image the owner's chosen cover was silently
    // discarded everywhere — cards, profile hero, and the edit form's prefill.
    coverPhoto: featuredImage(wp),
    image: featuredImage(wp) || acf.gallery?.[0]?.url || acf.fallback_image || "",
    // Owner-set credentials — shown as small badges on both the directory
    // card (DirectoryListingCard.jsx) and the full profile
    // (ListingProfile.jsx). Optional: an empty string just means the
    // badge doesn't render.
    // `education` (degree level) and `experience_level` are the original
    // free-text pair. `degree_type` and `years_experience` were added
    // alongside them rather than replacing them, so listings created before
    // the split keep rendering exactly as they did — ListingProfile falls
    // back to experienceLevel whenever yearsExperience is absent.
    education: acf.education || "",
    degreeType: acf.degree_type || "",
    experienceLevel: acf.experience_level || "",
    yearsExperience,
    // Crop anchor + zoom the owner picked in AddListingPage.jsx's
    // PositionPicker — see src/lib/imagePosition.js's imageCropStyle(),
    // applied wherever these images render (cards, full profile).
    logoPosition: acf.logo_position || "center",
    logoZoom: Number(acf.logo_zoom) || 1,
    // A top-biased fallback keeps faces visible on portrait photography.
    // Any crop selected by the listing owner still takes precedence.
    coverPosition: acf.cover_position || "top",
    coverZoom: Number(acf.cover_zoom) || 1,
    // Older listings may not have a saved fit preference. Default those to
    // "contain" so their complete cover photo is visible on cards and the
    // full profile; an explicit owner-selected crop remains respected.
    coverFit: acf.cover_fit === "cover" ? "cover" : "contain",
    // Precomputed from every public, user-visible profile value so the
    // directory can search details that are not rendered on its cards.
    searchText: createListingSearchText(publicProfile),
  };
}

/** WordPress `listing` CPT -> full listing detail view model */
export function mapListingDetail(wp) {
  const base = mapListingCpt(wp);
  const acf = wp.acf || wp.meta || {};
  const hasContactInfo = Boolean(
    acf.phone ||
      acf.email ||
      acf.website ||
      acf.address ||
      acf.instagram ||
      acf.facebook ||
      acf.youtube ||
      acf.twitter ||
      acf.whatsapp
  );

  return {
    ...base,
    logo: acf.logo || "",
    categoryPath: base.categorySlug,
    categoryLabel: base.category,
    description: acf.description || htmlToText(wp.content?.rendered || ""),
    tags: (acf.tags || []).map((t) => decodeEntities(t)),
    amenities: acf.amenities || [],
    hours: acf.hours || [],
    // Cover photo leads the gallery so it's the hero image on the profile,
    // with the owner's uploaded gallery behind it. Without this the profile
    // showed gallery[0] as the main image and the cover never appeared at all.
    gallery: [
      ...(base.coverPhoto ? [{ alt: `${base.title} cover photo`, src: base.coverPhoto }] : []),
      ...(acf.gallery || []).map((img) => ({ alt: img.alt || base.title, src: img.url })),
    ],
    reviews: (acf.reviews || []).map((r) => ({
      initial: r.name?.[0]?.toUpperCase() || "?",
      name: decodeEntities(r.name),
      time: r.time,
      stars: Number(r.stars) || 5,
      text: decodeEntities(r.text),
    })),
    contact: hasContactInfo
      ? {
          phone: acf.phone || "",
          email: acf.email || "",
          website: acf.website || "",
          websiteUrl: acf.website
            ? acf.website.startsWith("http")
              ? acf.website
              : `https://${acf.website}`
            : "",
          address: acf.address || "",
          instagram: acf.instagram || "",
          facebook: acf.facebook || "",
          youtube: acf.youtube || "",
          twitter: acf.twitter || "",
          // Not a URL — ListingProfile.jsx builds the wa.me chat link
          // itself from a plain phone number, same as `phone`'s tel: link.
          whatsapp: acf.whatsapp || "",
        }
      : null,
    mapEmbedUrl: acf.map_embed_url || null,
  };
}

/** WordPress core `post` -> homepage/blog card view model */
export function mapWpPost(wp, { detail = false } = {}) {
  const category = firstTerm(wp, "category");
  const acf = wp.acf || wp.meta || {};

  const base = {
    id: wp.id,
    slug: wp.slug,
    tag: decodeEntities(category?.name || "Journal"),
    categorySlug: category?.slug || "",
    date: new Date(wp.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    readTime: acf.reading_time ? `${acf.reading_time} min read` : "5 min read",
    title: stripHtml(wp.title?.rendered || ""),
    excerpt: stripHtml(wp.excerpt?.rendered || ""),
    image: featuredImage(wp) || acf.fallback_image || "",
  };

  if (!detail) return base;

  return {
    ...base,
    author: acf.author_key || "team",
    // Real WordPress author data (name/avatar/bio), present when the post
    // was fetched with _embed=1 — preferred over the local `authors` lookup
    // in blog.js whenever the author isn't one of the three built-in
    // personas (team/amara/marcus). See BlogPostPage.jsx.
    wpAuthor: mapEmbeddedAuthor(wp),
    tags: (acf.tags || []).map((t) => decodeEntities(t)),
    // Checks length explicitly rather than just `acf.body || fallback` —
    // an empty array is truthy in JS, so a naive `||` fallback would never
    // trigger for a post that simply never had the structured-body field
    // filled in (the normal case for anything written through wp-admin's
    // regular editor). See class-meta-fields.php's build_acf_object() for
    // the matching backend-side fix — this is the defense-in-depth half.
    body: acf.body?.length ? acf.body : [{ type: "p", text: stripHtml(wp.content?.rendered || "") }],
  };
}

/**
 * WordPress `product_type` CPT -> the Product Customizer's config shape
 * (src/data/customizer.js's `productTypes` entries) — this is the
 * admin-managed replacement for what used to be hardcoded in that file.
 * An admin controls every field here from wp-admin (see class-meta-fields.php's
 * product_type_fields()): base price, icon, an optional 3D model URL, the
 * garment color palette, printing techniques, and — most importantly —
 * the `zones` repeater, which is literally "what and where can be
 * customized" for this product (a zone's key/label become a placement tab;
 * allow_text/allow_logo/allow_recolor gate which tools apply there).
 */
export function mapProductTypeCpt(wp) {
  const acf = wp.acf || wp.meta || {};
  const zones = Array.isArray(acf.zones) ? acf.zones : [];

  return {
    id: wp.id,
    slug: wp.slug,
    label: stripHtml(wp.title?.rendered || wp.title || ""),
    icon: acf.icon || "ri-t-shirt-line",
    basePrice: acf.base_price ? Number(acf.base_price) : 0,
    modelUrl: acf.model_url || null,
    colorPalette: acf.color_palette?.length ? acf.color_palette : null,
    techniques: acf.techniques?.length ? acf.techniques : null,
    placements: zones.length
      ? zones.map((z) => ({
          key: z.key,
          label: z.label || z.key,
          allowText: z.allow_text !== false,
          allowLogo: z.allow_logo !== false,
          allowRecolor: z.allow_recolor !== false,
        }))
      : [{ key: "front", label: "Front", allowText: true, allowLogo: true, allowRecolor: true }],
  };
}

function mapEmbeddedAuthor(wp) {
  const author = wp._embedded?.author?.[0];
  if (!author) return null;
  const avatarSizes = author.avatar_urls || {};
  const avatar = avatarSizes["96"] || avatarSizes["48"] || avatarSizes["24"] || "";
  return {
    name: decodeEntities(author.name || ""),
    role: decodeEntities(author.description || ""),
    avatar,
  };
}
