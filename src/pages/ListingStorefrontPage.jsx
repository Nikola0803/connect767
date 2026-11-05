import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ListingProducts from "../components/ListingProducts";
import { listingOwnerMessagePath } from "../components/ListingProfile";
import { getListingBySlug, getListingProducts, getStorefrontReviews, getStorefrontSettings, recordStorefrontView, submitStorefrontReview } from "../data/repository";
import { useAsync } from "../hooks/useAsync";
import { ErrorState, Spinner } from "../components/ui/States";
import { arrangeStorefrontProducts } from "../lib/storefront";

const directPreviewStorefront = {
  listing: {
    id: "storefront-design-preview",
    slug: "james-local-fruits",
    title: "James Local Fruits",
    location: "Roseau, Dominica",
    industry: "Eat & Drink",
    category: "Eat & Drink",
    contact: {},
  },
  products: [
    {
      id: 91001,
      name: "Bananas",
      description: "Organic bananas · $15 per bunch",
      priceCents: 1500,
      imageUrl: "",
      fulfillmentMode: "pickup",
      stockStatus: "in_stock",
      active: true,
    },
    {
      id: 91002,
      name: "Mangoes",
      description: "Fresh local mangoes · $10 for 6",
      priceCents: 1000,
      imageUrl: "",
      fulfillmentMode: "pickup",
      stockStatus: "in_stock",
      active: true,
    },
  ],
  settings: {
    accentColor: "#0f6b4f",
    welcomeText: "Fresh local produce from Roseau, available for convenient local pickup.",
    shippingMessage: "Local pickup is available with each product.",
    policies: "Orders are prepared after confirmation. Pickup instructions are shared directly with the customer.",
    featuredProductIds: [],
    productOrder: [91001, 91002],
    productGrid: "auto",
    imageRatio: "square",
    cardCorners: "rounded",
    contentWidth: "standard",
    defaultTab: "products",
  },
  storefrontReviews: [],
};

function ProductSection({ eyebrow, title, products, slug, listingTitle, accentColor, id, layoutSettings, previewMode }) {
  if (!products.length) return null;
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-6 flex flex-col gap-3 border-b border-background-200/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>{eyebrow}</p>
          {title && <h2 className="mt-1.5 font-heading text-xl font-semibold tracking-[-0.02em] text-foreground-950 sm:text-2xl">{title}</h2>}
        </div>
        <p className="w-fit rounded-full border border-background-200 bg-background-100/70 px-3 py-1 text-[11px] font-medium text-foreground-500">{products.length} item{products.length === 1 ? "" : "s"}</p>
      </div>
      <ListingProducts slug={slug} listingTitle={listingTitle} fullStorefront initialProducts={products} layoutSettings={layoutSettings} previewMode={previewMode} />
    </section>
  );
}

function StorefrontContactDetails({ listing, messagePath, accentColor }) {
  const contact = listing.contact || {};
  const address = contact.address || listing.location || "";
  const contactRows = [
    contact.phone && ["ri-phone-line", "Phone", contact.phone, `tel:${contact.phone.replace(/\s/g, "")}`],
    contact.websiteUrl && ["ri-global-line", "Website", contact.website || contact.websiteUrl, contact.websiteUrl],
    address && ["ri-map-pin-line", "Location", address, ""],
  ].filter(Boolean);
  const socialLinks = [
    ["Instagram", "ri-instagram-line", contact.instagram],
    ["Facebook", "ri-facebook-line", contact.facebook],
    ["YouTube", "ri-youtube-line", contact.youtube],
    ["X", "ri-twitter-x-line", contact.twitter],
    ["WhatsApp", "ri-whatsapp-line", contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/[^\d]/g, "")}` : ""],
  ].filter(([, , href]) => href);

  if (listing.contactHidden) {
    return (
      <div className="rounded-2xl border border-primary-200 bg-primary-50/45 p-5">
        <p className="text-sm font-semibold text-foreground-900">Contact details are private</p>
        <p className="mt-1 text-xs leading-6 text-foreground-600">This owner accepts secure messages through Connect767.</p>
        <Link to={messagePath} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-semibold text-white" style={{ backgroundColor: accentColor }}><i className="ri-chat-3-line" /> Message Listing Owner</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="overflow-hidden rounded-2xl border border-background-200">
        {contactRows.map(([icon, label, value, href]) => {
          const content = <><i className={`${icon} text-lg`} style={{ color: accentColor }} /><span><span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-400">{label}</span><span className="mt-0.5 block text-sm text-foreground-800">{value}</span></span></>;
          return href ? <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="flex items-center gap-3 border-b border-background-200 px-4 py-3.5 last:border-b-0 hover:bg-background-100/70">{content}</a> : <div key={label} className="flex items-center gap-3 border-b border-background-200 px-4 py-3.5 last:border-b-0">{content}</div>;
        })}
        {contactRows.length === 0 && <p className="px-4 py-5 text-sm text-foreground-500">Use Connect767 messaging to contact this owner.</p>}
      </div>
      <div className="flex flex-col justify-between rounded-2xl border border-background-200 bg-background-100/45 p-5">
        <div>
          <p className="text-sm font-semibold text-foreground-900">Contact this business</p>
          <p className="mt-1 text-xs leading-6 text-foreground-500">Send a private inquiry directly to the listing owner.</p>
          {socialLinks.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{socialLinks.map(([label, icon, href]) => <a key={label} aria-label={label} href={href} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full border border-background-200 bg-background-50 text-foreground-600 hover:text-primary-700"><i className={icon} /></a>)}</div>}
        </div>
        <Link to={messagePath} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-xs font-semibold text-white" style={{ backgroundColor: accentColor }}><i className="ri-chat-3-line" /> Message Listing Owner</Link>
      </div>
    </div>
  );
}

function StorefrontReviews({ listing, initialReviews, accentColor }) {
  const [reviews, setReviews] = useState(initialReviews || []);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!rating || !name.trim() || !text.trim()) {
      setMessage("Choose a rating and enter your name and review.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const review = await submitStorefrontReview(listing.slug, { rating, name: name.trim(), text: text.trim() });
      setReviews((items) => [review, ...items]);
      setRating(0);
      setName("");
      setText("");
      setMessage("Thank you. Your storefront review has been submitted.");
    } catch {
      setMessage("We couldn't submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 py-9 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Store reviews</p>
        <h2 className="mt-2 font-heading text-3xl font-medium tracking-[-0.03em] text-foreground-950">Customer experiences</h2>
        {reviews.length ? (
          <div className="mt-6 space-y-3">
            {reviews.map((review, index) => (
              <article key={review.id || `${review.name}-${index}`} className="rounded-2xl border border-background-200 bg-background-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground-900">{review.name}</p>
                  <p className="text-sm text-amber-500" aria-label={`${review.rating || review.stars} out of 5 stars`}>{"★".repeat(review.rating || review.stars || 0)}</p>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground-600">{review.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-background-300 bg-background-100/45 px-5 py-8 text-center">
            <i className="ri-star-smile-line text-2xl" style={{ color: accentColor }} />
            <p className="mt-2 text-sm font-semibold text-foreground-900">No storefront reviews yet</p>
            <p className="mt-1 text-xs text-foreground-500">Be the first customer to share an experience with this store.</p>
          </div>
        )}
      </section>

      <form onSubmit={submit} className="h-fit rounded-2xl border border-background-200 bg-background-100/45 p-5 sm:p-6">
        <h3 className="font-heading text-xl font-medium text-foreground-950">Write a store review</h3>
        <p className="mt-1 text-xs leading-6 text-foreground-500">Your review will appear on this storefront, not on the directory profile.</p>
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold text-foreground-800">Your rating</legend>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} star${star === 1 ? "" : "s"}`} className={`text-2xl ${star <= rating ? "text-amber-500" : "text-background-400"}`}><i className={star <= rating ? "ri-star-fill" : "ri-star-line"} /></button>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block text-xs font-semibold text-foreground-800" htmlFor="store-review-name">Your name</label>
        <input id="store-review-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="mt-2 h-11 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm outline-none focus:border-primary-400" placeholder="Your name" />
        <label className="mt-4 block text-xs font-semibold text-foreground-800" htmlFor="store-review-text">Your review</label>
        <textarea id="store-review-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={1200} rows={5} className="mt-2 w-full resize-y rounded-xl border border-background-300 bg-background-50 px-3 py-3 text-sm outline-none focus:border-primary-400" placeholder="Share your experience with this store…" />
        {message && <p className={`mt-3 text-xs ${message.startsWith("Thank") ? "text-primary-700" : "text-accent-700"}`}>{message}</p>}
        <button type="submit" disabled={submitting} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: accentColor }}>{submitting ? "Submitting…" : "Submit store review"}</button>
      </form>
    </div>
  );
}

function StorefrontSeo({ listing, products, slug, coverUrl }) {
  useEffect(() => {
    const viewKey = `connect767-storefront-view:${slug}`;
    if (!window.sessionStorage.getItem(viewKey)) {
      window.sessionStorage.setItem(viewKey, "1");
      recordStorefrontView(slug).catch(() => undefined);
    }

    const canonical = `https://connect767.com/listings/${slug}/shop`;
    const title = `${listing.title} Store | Connect767`;
    const description = `Shop products from ${listing.title} on Connect767. View secure checkout, shipping and local pickup options.`;
    document.title = title;
    const descriptionMeta = document.head.querySelector('meta[name="description"]');
    descriptionMeta?.setAttribute("content", description);

    const script = document.createElement("script");
    script.id = "connect767-storefront-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Store",
      name: `${listing.title} Store`,
      url: canonical,
      image: coverUrl || listing.image || undefined,
      description,
      address: listing.location || undefined,
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: `${listing.title} products`,
        itemListElement: products.map((product) => ({
          "@type": "OfferCatalog",
          name: product.name,
          itemListElement: [{
            "@type": "Product",
            name: product.name,
            description: product.description || undefined,
            image: product.image || undefined,
            sku: product.sku || undefined,
            aggregateRating: product.reviewCount > 0 ? {
              "@type": "AggregateRating",
              ratingValue: product.reviewAverage,
              reviewCount: product.reviewCount,
            } : undefined,
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: (Number(product.priceCents || 0) / 100).toFixed(2),
              availability: product.stockStatus === "sold_out"
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
              url: canonical,
            },
          }],
        })),
      },
    });
    document.head.querySelector("#connect767-storefront-schema")?.remove();
    document.head.appendChild(script);
    return () => script.remove();
  }, [coverUrl, listing, products, slug]);

  return null;
}

export default function ListingStorefrontPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const designPreview = searchParams.get("designPreview") === "1";
  const previewKey = searchParams.get("previewKey") || "";
  const directoryCardPreview = import.meta.env.DEV && designPreview && searchParams.get("surface") === "directory";
  let previewPayload = null;
  if (designPreview && typeof window !== "undefined") {
    try {
      const keyedPayload = previewKey
        ? window.localStorage.getItem(`connect767-storefront-preview:${previewKey}`)
        : null;
      const legacyPayload = window.sessionStorage.getItem(`connect767-storefront-preview:${slug}`);
      previewPayload = JSON.parse(keyedPayload || legacyPayload || "null");
      const isExpired = previewPayload?.createdAt && Date.now() - Number(previewPayload.createdAt) > 60 * 60 * 1000;
      const wrongListing = previewPayload?.listing?.slug && previewPayload.listing.slug !== slug;
      if (isExpired || wrongListing) previewPayload = null;
    } catch {
      previewPayload = null;
    }
  }
  const [activeTab, setActiveTab] = useState(["overview", "products", "reviews", "contact"].includes(requestedTab) ? requestedTab : "products");
  const { data, loading, error, reload } = useAsync(async () => {
    if (designPreview && previewPayload?.listing) {
      return {
        listing: previewPayload.listing,
        products: previewPayload.products || [],
        settings: previewPayload.settings || null,
        storefrontReviews: [],
      };
    }
    if (import.meta.env.DEV && designPreview && slug === directPreviewStorefront.listing.slug) {
      return directPreviewStorefront;
    }
    const [listing, products, settings, storefrontReviews] = await Promise.all([
      getListingBySlug(slug),
      getListingProducts(slug),
      getStorefrontSettings(slug).catch(() => null),
      getStorefrontReviews(slug).catch(() => []),
    ]);
    return { listing, products: products || [], settings, storefrontReviews };
  }, [slug, designPreview, previewKey, searchParams.get("revision")]);

  const previewSettings = previewPayload?.settings || null;
  const previewDefaultTab = previewSettings?.defaultTab || "";

  useEffect(() => {
    if (["overview", "products", "reviews", "contact"].includes(requestedTab)) {
      setActiveTab(requestedTab);
      return;
    }
    const preferredTab = previewDefaultTab || data?.settings?.defaultTab;
    if (["overview", "products"].includes(preferredTab)) setActiveTab(preferredTab);
  }, [data?.settings?.defaultTab, previewDefaultTab, requestedTab, slug]);

  if (loading) return <Spinner className="min-h-[60vh] pt-16 md:pt-20" />;
  if (error) return <div className="pt-16 md:pt-20"><ErrorState message="Couldn't load this storefront." onRetry={reload} /></div>;

  const listing = data?.listing;
  if (!listing) {
    return <div className="px-4 py-24 pt-28 text-center md:px-8"><h1 className="font-heading text-3xl text-foreground-950">Listing not found</h1><Link to="/listings" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">Back to directory <i className="ri-arrow-right-line" /></Link></div>;
  }

  const rawProducts = data?.products || [];
  if (rawProducts.length === 0 && !designPreview) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 pt-32 text-center md:px-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-2xl text-primary-700"><i className="ri-store-3-line" /></span>
        <h1 className="mt-5 font-heading text-3xl text-foreground-950">Storefront not available</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-600">{listing.title} does not currently have any products available for sale.</p>
        <Link to={`/listings/${slug}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-background-50 hover:bg-primary-700">Return to profile <i className="ri-arrow-right-line" /></Link>
      </div>
    );
  }

  const defaults = {
    coverUrl: listing.gallery?.[0]?.src || listing.image || "",
    coverPosition: listing.coverPosition || "center",
    coverZoom: listing.coverZoom || 1,
    logoUrl: listing.logo || "",
    headline: `Shop ${listing.title}`,
    welcomeText: "A curated selection from this Connect767 business, available through secure checkout.",
    accentColor: "#0f6b4f",
    aboutText: "",
    shippingMessage: "Shipping and local pickup options are shown with each product.",
    policies: "",
    featuredProductIds: [],
    productOrder: [],
    productGrid: "auto",
    imageRatio: "square",
    cardCorners: "rounded",
    contentWidth: "standard",
    defaultTab: "products",
    hasCustomCover: false,
  };
  const settings = { ...defaults, ...(data?.settings || {}), ...(previewSettings || {}) };
  const products = arrangeStorefrontProducts(rawProducts, settings);
  const messagePath = listingOwnerMessagePath(listing);
  const widthClass = settings.contentWidth === "wide" ? "max-w-7xl" : "max-w-6xl";
  return (
    <div className="min-h-screen bg-background-100/35 pt-16 md:pt-20">
      {!designPreview && <StorefrontSeo listing={listing} products={products.all} slug={slug} coverUrl={settings.coverUrl} />}
      {designPreview && <div className="sticky top-16 z-30 border-b border-primary-200 bg-primary-50 px-4 py-2 text-center text-xs font-semibold text-primary-800 md:top-20"><i className="ri-eye-line mr-1.5" /> Draft preview — purchases are disabled</div>}
      <div className="px-4 py-5 md:px-8">
        <div className={`mx-auto flex ${widthClass} items-center gap-2 text-[11px] font-medium tracking-wide text-foreground-500 font-label`}>
          <Link to="/listings" className="hover:text-foreground-800">Directory</Link><span className="text-background-400">/</span>
          <Link to={`/listings/${slug}`} className="max-w-56 truncate hover:text-foreground-800">{listing.title}</Link><span className="text-background-400">/</span><span className="font-medium text-foreground-800">Store</span>
        </div>
      </div>

      <main className="px-4 pb-16 md:px-8">
        <div className={`mx-auto ${widthClass} overflow-hidden rounded-[30px] border border-background-200 bg-background-50 shadow-[0_18px_60px_rgba(29,45,38,0.06)]`}>
          <section className="px-5 sm:px-8 md:px-10">
            <div className="flex flex-col gap-5 border-b border-background-200 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="min-w-0">
                  <h1 className="truncate font-heading text-xl font-semibold tracking-[-0.02em] text-foreground-950 sm:text-2xl">{listing.title}</h1>
                  <p className="mt-1 text-xs leading-5 text-foreground-500 sm:text-sm">{[listing.location, listing.industry || listing.category].filter(Boolean).join(" · ")}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-background-200 bg-background-100/70 px-2.5 py-1 text-[11px] font-semibold text-foreground-800"><i className="ri-checkbox-circle-fill text-sm" style={{ color: settings.accentColor }} /> Verified Business</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={messagePath} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-background-300 bg-background-50 px-4 text-xs font-semibold text-foreground-800 transition-colors hover:border-background-400"><i className="ri-chat-3-line" /> Message owner</Link>
                <Link to={`/listings/${slug}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-white" style={{ backgroundColor: settings.accentColor }}>View profile <i className="ri-arrow-right-up-line" /></Link>
              </div>
            </div>

            <nav className="flex gap-1.5 overflow-x-auto border-b border-background-200 py-3.5 text-[13px]" aria-label="Business profile sections">
              <button type="button" onClick={() => setActiveTab("overview")} className={`whitespace-nowrap rounded-full px-4 py-2 transition-colors ${activeTab === "overview" ? "font-semibold text-white shadow-sm" : "text-foreground-600 hover:bg-background-100"}`} style={activeTab === "overview" ? { backgroundColor: settings.accentColor } : undefined}>Overview</button>
              <button type="button" onClick={() => setActiveTab("products")} className={`whitespace-nowrap rounded-full px-4 py-2 transition-colors ${activeTab === "products" ? "font-semibold text-white shadow-sm" : "text-foreground-600 hover:bg-background-100"}`} style={activeTab === "products" ? { backgroundColor: settings.accentColor } : undefined}>Products</button>
              <button type="button" onClick={() => setActiveTab("reviews")} className={`whitespace-nowrap rounded-full px-4 py-2 transition-colors ${activeTab === "reviews" ? "font-semibold text-white shadow-sm" : "text-foreground-600 hover:bg-background-100"}`} style={activeTab === "reviews" ? { backgroundColor: settings.accentColor } : undefined}>Reviews</button>
              <button type="button" onClick={() => setActiveTab("contact")} className={`whitespace-nowrap rounded-full px-4 py-2 transition-colors ${activeTab === "contact" ? "font-semibold text-white shadow-sm" : "text-foreground-600 hover:bg-background-100"}`} style={activeTab === "contact" ? { backgroundColor: settings.accentColor } : undefined}>Contact</button>
            </nav>

            {activeTab === "overview" && (
              <div id="store-overview" className="scroll-mt-28">
                <div className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Storefront</p>
                    <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground-600">{settings.welcomeText}</p>
                  </div>
                  <div className="grid gap-3 text-xs text-foreground-600">
                    {[["ri-shield-check-line", "Secure checkout"], ["ri-truck-line", settings.shippingMessage], ["ri-shopping-bag-line", `${products.all.length} product${products.all.length === 1 ? "" : "s"}`]].map(([icon, text]) => <div key={text} className="flex items-center gap-2.5 rounded-xl bg-background-100/70 px-3 py-2.5"><i className={`${icon} text-base`} style={{ color: settings.accentColor }} /><span className="line-clamp-2">{text}</span></div>)}
                  </div>
                </div>

                <div className="border-t border-background-200 py-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Store Policy</p>
                  <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-7 text-foreground-600">{settings.policies || "Store policy information has not been added yet."}</p>
                </div>
              </div>
            )}

            {activeTab === "products" && (
              <div id="store-products" className="scroll-mt-28 space-y-12 py-8">
                {directoryCardPreview ? (
                  <ListingProducts slug={slug} listingTitle={listing.title} initialProducts={products.all} layoutSettings={settings} previewMode />
                ) : (
                  <>
                    <ProductSection eyebrow="Featured by the seller" products={products.featured} slug={slug} listingTitle={listing.title} accentColor={settings.accentColor} layoutSettings={settings} previewMode={designPreview} />
                    <ProductSection eyebrow={products.featured.length ? "More from the store" : "The collection"} title="Products" products={products.collection} slug={slug} listingTitle={listing.title} accentColor={settings.accentColor} layoutSettings={settings} previewMode={designPreview} />
                  </>
                )}
                {designPreview && products.all.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-background-300 bg-background-100/45 px-5 py-12 text-center">
                    <i className="ri-shopping-bag-3-line text-3xl" style={{ color: settings.accentColor }} />
                    <p className="mt-3 text-sm font-semibold text-foreground-900">Your products will appear here</p>
                    <p className="mt-1 text-xs text-foreground-500">Add a product to see its final card design in this storefront preview.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reviews" && <StorefrontReviews listing={listing} initialReviews={data.storefrontReviews} accentColor={settings.accentColor} />}

            {activeTab === "contact" && (
              <div className="py-9">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Contact</p>
                <h2 className="mt-2 font-heading text-3xl font-medium tracking-[-0.03em] text-foreground-950">Contact {listing.title}</h2>
                <div className="mt-6"><StorefrontContactDetails listing={listing} messagePath={messagePath} accentColor={settings.accentColor} /></div>
              </div>
            )}

          </section>
        </div>
      </main>
    </div>
  );
}
