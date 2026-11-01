import { Link, useParams } from "react-router-dom";
import ListingProducts from "../components/ListingProducts";
import { listingOwnerMessagePath } from "../components/ListingProfile";
import { getListingBySlug, getListingProducts } from "../data/repository";
import { useAsync } from "../hooks/useAsync";
import { ErrorState, Spinner } from "../components/ui/States";
import { imageCropStyle } from "../lib/imagePosition";

export default function ListingStorefrontPage() {
  const { slug } = useParams();
  const { data, loading, error, reload } = useAsync(async () => {
    const [listing, products] = await Promise.all([
      getListingBySlug(slug),
      getListingProducts(slug),
    ]);
    return { listing, products: products || [] };
  }, [slug]);

  if (loading) return <Spinner className="min-h-[60vh] pt-16 md:pt-20" />;

  if (error) {
    return (
      <div className="pt-16 md:pt-20">
        <ErrorState message="Couldn't load this storefront." onRetry={reload} />
      </div>
    );
  }

  const listing = data?.listing;
  const products = data?.products || [];

  if (!listing) {
    return (
      <div className="px-4 py-24 pt-28 text-center md:px-8">
        <h1 className="font-heading text-3xl text-foreground-950">Listing not found</h1>
        <Link to="/listings" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
          Back to directory <i className="ri-arrow-right-line" />
        </Link>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 pt-32 text-center md:px-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-2xl text-primary-700">
          <i className="ri-store-3-line" />
        </span>
        <h1 className="mt-5 font-heading text-3xl text-foreground-950">Storefront not available</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-600">
          {listing.title} does not currently have any products available for sale.
        </p>
        <Link
          to={`/listings/${slug}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-background-50 hover:bg-primary-700"
        >
          Return to profile <i className="ri-arrow-right-line" />
        </Link>
      </div>
    );
  }

  const cover = listing.gallery?.[0]?.src || listing.image || "";
  const messagePath = listingOwnerMessagePath(listing);

  return (
    <div className="pt-16 md:pt-20">
      <div className="border-b border-background-200/70 bg-background-50 px-4 py-4 md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center gap-2 text-xs text-foreground-500 font-label">
          <Link to="/listings" className="hover:text-foreground-800">Directory</Link>
          <i className="ri-arrow-right-s-line" />
          <Link to={`/listings/${slug}`} className="max-w-56 truncate hover:text-foreground-800">{listing.title}</Link>
          <i className="ri-arrow-right-s-line" />
          <span className="font-medium text-foreground-800">Storefront</span>
        </div>
      </div>

      <section className="relative overflow-hidden bg-primary-950 text-background-50">
        {cover && (
          <>
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-20"
              style={imageCropStyle(listing.coverPosition, listing.coverZoom, "cover")}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-950 via-primary-950/95 to-primary-950/70" />
          </>
        )}
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end lg:px-12">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-background-50/15 bg-background-50/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-100">
              <i className="ri-shield-check-fill text-accent-400" />
              Listing-owner storefront
            </div>
            <h1 className="font-heading text-4xl font-medium tracking-[-0.035em] md:text-5xl">
              Shop {listing.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-background-200 md:text-base">
              Purchase directly from this Connect767 listing through secure checkout.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-background-200">
              {listing.location && <span className="inline-flex items-center gap-1.5"><i className="ri-map-pin-line" />{listing.location}</span>}
              <span className="inline-flex items-center gap-1.5"><i className="ri-shopping-bag-3-line" />{products.length} product{products.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              to={messagePath}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent-500 px-5 text-sm font-bold text-background-50 hover:bg-accent-600"
            >
              <i className="ri-chat-3-line text-lg" /> Message Listing Owner
            </Link>
            <Link
              to={`/listings/${slug}`}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-background-50/20 bg-background-50/5 px-5 text-sm font-semibold text-background-50 hover:bg-background-50/10"
            >
              View business profile <i className="ri-arrow-right-up-line" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-background-200 bg-background-50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
          {[
            ["ri-shield-check-line", "Secure checkout", "Protected payments"],
            ["ri-truck-line", "Seller fulfillment", "Delivery details per item"],
            ["ri-refresh-line", "Clear policies", "Terms shown before purchase"],
            ["ri-customer-service-2-line", "Direct support", "Message the listing owner"],
          ].map(([icon, title, detail]) => (
            <div key={title} className="flex items-start gap-3 border-r border-background-200 px-4 py-5 last:border-r-0 md:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700"><i className={icon} /></span>
              <div><p className="text-xs font-bold text-foreground-900">{title}</p><p className="mt-0.5 text-[11px] leading-snug text-foreground-500">{detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14 lg:px-12">
        <div className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Shop this listing</p>
          <h2 className="mt-2 font-heading text-3xl font-light text-foreground-950 md:text-4xl">Products for sale</h2>
          <p className="mt-2 text-sm text-foreground-500">Available products published by {listing.title}.</p>
        </div>
        <ListingProducts
          slug={slug}
          listingTitle={listing.title}
          fullStorefront
          initialProducts={products}
        />
      </main>
    </div>
  );
}
