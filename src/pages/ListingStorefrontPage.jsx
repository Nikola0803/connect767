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
    <section id={id} className="scroll-mt-28">
      <div className="mb-7 flex flex-col gap-3 border-b border-background-200/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>{eyebrow}</p>
          <h2 className="mt-2 font-heading text-2xl font-medium tracking-[-0.02em] text-foreground-950 md:text-3xl">{title}</h2>
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
    <div className="min-h-screen bg-background-100/35 pt-16 md:pt-20">
      <StorefrontSeo listing={listing} products={products.all} slug={slug} coverUrl={settings.coverUrl} />
      <div className="px-4 py-5 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-2 text-[11px] font-medium tracking-wide text-foreground-500 font-label">
          <Link to="/listings" className="hover:text-foreground-800">Directory</Link><span className="text-background-400">/</span>
          <Link to={`/listings/${slug}`} className="max-w-56 truncate hover:text-foreground-800">{listing.title}</Link><span className="text-background-400">/</span><span className="font-medium text-foreground-800">Store</span>
        </div>
      </div>

      <main className="px-4 pb-16 md:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[30px] border border-background-200 bg-background-50 shadow-[0_18px_60px_rgba(29,45,38,0.06)]">
          <div className="relative h-52 overflow-hidden bg-background-200 sm:h-64 md:h-72">
            {settings.coverUrl ? <img src={settings.coverUrl} alt={`${listing.title} storefront`} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" style={imageCropStyle(settings.hasCustomCover ? settings.coverPosition : listing.coverPosition, settings.hasCustomCover ? settings.coverZoom : listing.coverZoom, "cover")} /> : <div className="flex h-full items-center justify-center bg-primary-50 text-5xl text-primary-300"><i className="ri-store-2-line" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground-950/25 via-transparent to-transparent" />
            <span className="absolute right-5 top-5 rounded-full bg-background-50/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-800 shadow-sm backdrop-blur">Connect767 Store</span>
          </div>

          <section className="px-5 sm:px-8 md:px-10">
            <div className="flex flex-col gap-5 border-b border-background-200 py-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="min-w-0">
                  <h1 className="truncate font-heading text-2xl font-semibold tracking-[-0.025em] text-foreground-950 sm:text-3xl">{listing.title}</h1>
                  <p className="mt-1.5 text-sm text-foreground-500">{[listing.location, listing.industry || listing.category].filter(Boolean).join(" · ")}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-800"><i className="ri-checkbox-circle-fill text-base" style={{ color: settings.accentColor }} /> Verified Business</p>
                </div>
            </div>
              <div className="flex flex-wrap gap-2">
                <Link to={messagePath} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-background-300 bg-background-50 px-4 text-xs font-semibold text-foreground-800 transition-colors hover:border-background-400"><i className="ri-chat-3-line" /> Message owner</Link>
                <Link to={`/listings/${slug}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold text-white" style={{ backgroundColor: settings.accentColor }}>View profile <i className="ri-arrow-right-up-line" /></Link>
              </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto border-b border-background-200 py-4 text-sm" aria-label="Business profile sections">
              <Link to={`/listings/${slug}`} className="whitespace-nowrap rounded-full px-4 py-2 text-foreground-600 hover:bg-background-100">Overview</Link>
              <a href="#store-products" className="whitespace-nowrap rounded-full px-5 py-2 font-semibold text-white" style={{ backgroundColor: settings.accentColor }}>Products</a>
              <Link to={`/listings/${slug}#services`} className="whitespace-nowrap rounded-full px-4 py-2 text-foreground-600 hover:bg-background-100">Services</Link>
              <Link to={`/listings/${slug}#reviews`} className="whitespace-nowrap rounded-full px-4 py-2 text-foreground-600 hover:bg-background-100">Reviews</Link>
              <Link to={messagePath} className="whitespace-nowrap rounded-full px-4 py-2 text-foreground-600 hover:bg-background-100">Contact</Link>
            </nav>

            <div className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Storefront</p>
                <h2 className="mt-2 font-heading text-3xl font-medium tracking-[-0.03em] text-foreground-950">{settings.headline}</h2>
                <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-foreground-600">{settings.welcomeText}</p>
              </div>
              <div className="grid gap-3 text-xs text-foreground-600">
                {[["ri-shield-check-line", "Secure checkout"], ["ri-truck-line", settings.shippingMessage], ["ri-shopping-bag-line", `${products.all.length} product${products.all.length === 1 ? "" : "s"}`]].map(([icon, text]) => <div key={text} className="flex items-center gap-2.5 rounded-xl bg-background-100/70 px-3 py-2.5"><i className={`${icon} text-base`} style={{ color: settings.accentColor }} /><span className="line-clamp-2">{text}</span></div>)}
              </div>
            </div>

            {settings.aboutText && <div className="border-t border-background-200 py-8"><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>About the store</p><p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-7 text-foreground-600">{settings.aboutText}</p></div>}

            <div id="store-products" className="scroll-mt-28 space-y-14 border-t border-background-200 py-10">
              <ProductSection eyebrow="Featured by the seller" title="Featured products" products={products.featured} slug={slug} listingTitle={listing.title} accentColor={settings.accentColor} />
              <ProductSection eyebrow={products.featured.length ? "More from the store" : "The collection"} title="Products" products={products.collection} slug={slug} listingTitle={listing.title} accentColor={settings.accentColor} />
            </div>

            {settings.policies && <div className="border-t border-background-200 py-9"><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: settings.accentColor }}>Store information</p><h2 className="mt-2 font-heading text-2xl font-medium text-foreground-950">Policies</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground-600">{settings.policies}</p></div>}
          </section>
        </div>
      </main>
    </div>
  );
}
