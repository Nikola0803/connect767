import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ListingProducts from "../components/ListingProducts";
import { listingOwnerMessagePath } from "../components/ListingProfile";
import { getListingBySlug, getListingProducts, getStorefrontSettings, recordStorefrontView } from "../data/repository";
import { useAsync } from "../hooks/useAsync";
import { ErrorState, Spinner } from "../components/ui/States";
import { imageCropStyle } from "../lib/imagePosition";
import { arrangeStorefrontProducts } from "../lib/storefront";

function ProductSection({ eyebrow, title, products, slug, listingTitle, accentColor, id }) {
  if (!products.length) return null;
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-10 flex flex-col gap-3 border-b border-background-200/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>{eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl font-light tracking-[-0.02em] text-foreground-950 md:text-4xl">{title}</h2>
        </div>
        <p className="text-xs text-foreground-500">{products.length} item{products.length === 1 ? "" : "s"}</p>
      </div>
      <ListingProducts slug={slug} listingTitle={listingTitle} fullStorefront initialProducts={products} />
    </section>
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
  const { data, loading, error, reload } = useAsync(async () => {
    const [listing, products, settings] = await Promise.all([
      getListingBySlug(slug),
      getListingProducts(slug),
      getStorefrontSettings(slug).catch(() => null),
    ]);
    return { listing, products: products || [], settings };
  }, [slug]);

  if (loading) return <Spinner className="min-h-[60vh] pt-16 md:pt-20" />;
  if (error) return <div className="pt-16 md:pt-20"><ErrorState message="Couldn't load this storefront." onRetry={reload} /></div>;

  const listing = data?.listing;
  if (!listing) {
    return <div className="px-4 py-24 pt-28 text-center md:px-8"><h1 className="font-heading text-3xl text-foreground-950">Listing not found</h1><Link to="/listings" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">Back to directory <i className="ri-arrow-right-line" /></Link></div>;
  }

  const rawProducts = data?.products || [];
  if (rawProducts.length === 0) {
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
    hasCustomCover: false,
  };
  const settings = { ...defaults, ...(data?.settings || {}) };
  const products = arrangeStorefrontProducts(rawProducts, settings);
  const messagePath = listingOwnerMessagePath(listing);

  return (
    <div className="bg-background-50 pt-16 md:pt-20">
      <StorefrontSeo listing={listing} products={products.all} slug={slug} coverUrl={settings.coverUrl} />
      <div className="px-4 py-5 md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center gap-2 text-[11px] font-medium tracking-wide text-foreground-500 font-label">
          <Link to="/listings" className="hover:text-foreground-800">Directory</Link><span className="text-background-400">/</span>
          <Link to={`/listings/${slug}`} className="max-w-56 truncate hover:text-foreground-800">{listing.title}</Link><span className="text-background-400">/</span><span className="font-medium text-foreground-800">Store</span>
        </div>
      </div>

      <section className="px-4 pb-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[28px] border border-background-200/80 bg-background-100/60 lg:grid-cols-[minmax(0,0.88fr)_minmax(460px,1.12fr)]">
          <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:py-16 lg:px-14 lg:py-20">
            <div className="mb-7 flex items-center gap-3">
              {settings.logoUrl ? <img src={settings.logoUrl} alt={`${listing.title} logo`} className="h-11 w-11 rounded-full border border-background-200 bg-background-50 object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full font-heading text-lg text-white" style={{ backgroundColor: settings.accentColor }}>{listing.title?.charAt(0) || "C"}</span>}
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Connect767 Store</p><p className="mt-1 text-xs text-foreground-500">Sold by {listing.title}</p></div>
            </div>
            <h1 className="max-w-xl font-heading text-[2.65rem] font-light leading-[1.02] tracking-[-0.04em] text-foreground-950 sm:text-5xl lg:text-[3.6rem]">{settings.headline}</h1>
            <p className="mt-5 max-w-lg whitespace-pre-line text-sm leading-7 text-foreground-600 md:text-base">{settings.welcomeText}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#store-products" className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: settings.accentColor }}>Browse products <i className="ri-arrow-down-line" /></a>
              <Link to={messagePath} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-background-300 bg-background-50 px-5 text-sm font-semibold text-foreground-800 transition-colors hover:border-background-400"><i className="ri-chat-3-line" /> Message owner</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-500">{listing.location && <span className="inline-flex items-center gap-1.5"><i className="ri-map-pin-line" />{listing.location}</span>}<span className="inline-flex items-center gap-1.5"><i className="ri-shopping-bag-line" />{products.all.length} product{products.all.length === 1 ? "" : "s"}</span></div>
          </div>
          <div className="relative min-h-[310px] overflow-hidden bg-background-200 sm:min-h-[420px] lg:min-h-full">
            {settings.coverUrl ? <img src={settings.coverUrl} alt={`${listing.title} storefront`} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" style={imageCropStyle(settings.hasCustomCover ? settings.coverPosition : listing.coverPosition, settings.hasCustomCover ? settings.coverZoom : listing.coverZoom, "cover")} /> : <div className="flex h-full min-h-[310px] items-center justify-center bg-primary-50 text-5xl text-primary-300 sm:min-h-[420px]"><i className="ri-store-2-line" /></div>}
            <Link to={`/listings/${slug}`} className="absolute bottom-5 right-5 inline-flex h-10 items-center gap-2 rounded-full bg-background-50/95 px-4 text-xs font-semibold text-foreground-900 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5">View profile <i className="ri-arrow-right-up-line" /></Link>
          </div>
        </div>
      </section>

      <section className="border-y border-background-200/70 bg-background-50 px-4 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 py-6 sm:grid-cols-3">
          {[["ri-shield-check-line", "Secure checkout", "Protected payment processing"], ["ri-truck-line", "Delivery options", settings.shippingMessage], ["ri-chat-3-line", "Direct support", "Message the owner anytime"]].map(([icon, title, detail]) => <div key={title} className="flex items-center gap-3 sm:justify-center"><i className={`${icon} text-lg`} style={{ color: settings.accentColor }} /><div><p className="text-xs font-semibold text-foreground-900">{title}</p><p className="mt-0.5 line-clamp-2 text-[11px] text-foreground-500">{detail}</p></div></div>)}
        </div>
      </section>

      {settings.aboutText && <section className="mx-auto max-w-4xl px-4 py-14 text-center md:px-8 md:py-20"><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>About the store</p><h2 className="mt-3 font-heading text-3xl font-light text-foreground-950">Meet {listing.title}</h2><p className="mx-auto mt-5 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground-600 md:text-base">{settings.aboutText}</p></section>}

      <main id="store-products" className="mx-auto max-w-7xl scroll-mt-24 space-y-16 px-4 py-14 md:px-8 md:py-20 lg:px-12">
        <ProductSection eyebrow="Featured by the seller" title="Featured products" products={products.featured} slug={slug} listingTitle={listing.title} accentColor={settings.accentColor} />
        <ProductSection eyebrow={products.featured.length ? "More from the store" : "The collection"} title="Products" products={products.collection} slug={slug} listingTitle={listing.title} accentColor={settings.accentColor} />
      </main>

      {settings.policies && <section className="border-t border-background-200/70 bg-background-100/40 px-4 py-12 md:px-8"><div className="mx-auto max-w-4xl"><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Store information</p><h2 className="mt-2 font-heading text-2xl font-light text-foreground-950">Policies</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground-600">{settings.policies}</p></div></section>}
    </div>
  );
}
