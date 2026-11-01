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
    <div className="bg-background-50 pt-16 md:pt-20">
      <div className="px-4 py-5 md:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center gap-2 text-[11px] font-medium tracking-wide text-foreground-500 font-label">
          <Link to="/listings" className="hover:text-foreground-800">Directory</Link>
          <span className="text-background-400">/</span>
          <Link to={`/listings/${slug}`} className="max-w-56 truncate hover:text-foreground-800">{listing.title}</Link>
          <span className="text-background-400">/</span>
          <span className="font-medium text-foreground-800">Store</span>
        </div>
      </div>

      <section className="px-4 pb-8 md:px-8 md:pb-12 lg:px-12">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[28px] border border-background-200/80 bg-background-100/60 lg:grid-cols-[minmax(0,0.88fr)_minmax(460px,1.12fr)]">
          <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:py-16 lg:px-14 lg:py-20">
            <div className="mb-7 flex items-center gap-3">
              {listing.logo ? (
                <img
                  src={listing.logo}
                  alt={`${listing.title} logo`}
                  className="h-11 w-11 rounded-full border border-background-200 bg-background-50 object-cover"
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-900 font-heading text-lg text-background-50">
                  {listing.title?.charAt(0) || "C"}
                </span>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">Connect767 Store</p>
                <p className="mt-1 text-xs text-foreground-500">Sold by {listing.title}</p>
              </div>
            </div>

            <h1 className="max-w-xl font-heading text-[2.65rem] font-light leading-[1.02] tracking-[-0.04em] text-foreground-950 sm:text-5xl lg:text-[3.6rem]">
              Shop {listing.title}
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-foreground-600 md:text-base">
              A curated selection from this Connect767 business, available through secure checkout.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#store-products"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary-900 px-5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-800"
              >
                Browse products <i className="ri-arrow-down-line" />
              </a>
              <Link
                to={messagePath}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-background-300 bg-background-50 px-5 text-sm font-semibold text-foreground-800 transition-colors hover:border-background-400"
              >
                <i className="ri-chat-3-line" /> Message owner
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground-500">
              {listing.location && <span className="inline-flex items-center gap-1.5"><i className="ri-map-pin-line" />{listing.location}</span>}
              <span className="inline-flex items-center gap-1.5"><i className="ri-shopping-bag-line" />{products.length} product{products.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="relative min-h-[310px] overflow-hidden bg-background-200 sm:min-h-[420px] lg:min-h-full">
            {cover ? (
              <img
                src={cover}
                alt={`${listing.title} storefront`}
                className="absolute inset-0 h-full w-full object-cover"
                style={imageCropStyle(listing.coverPosition, listing.coverZoom, "cover")}
              />
            ) : (
              <div className="flex h-full min-h-[310px] items-center justify-center bg-primary-50 text-5xl text-primary-300 sm:min-h-[420px]">
                <i className="ri-store-2-line" />
              </div>
            )}
            <Link
              to={`/listings/${slug}`}
              className="absolute bottom-5 right-5 inline-flex h-10 items-center gap-2 rounded-full bg-background-50/95 px-4 text-xs font-semibold text-foreground-900 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              View profile <i className="ri-arrow-right-up-line" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-background-200/70 bg-background-50 px-4 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 py-6 sm:grid-cols-3">
          {[
            ["ri-shield-check-line", "Secure checkout", "Protected payment processing"],
            ["ri-store-2-line", "Local seller", `Fulfilled by ${listing.title}`],
            ["ri-chat-3-line", "Direct support", "Message the owner anytime"],
          ].map(([icon, title, detail]) => (
            <div key={title} className="flex items-center gap-3 sm:justify-center">
              <i className={`${icon} text-lg text-primary-700`} />
              <div><p className="text-xs font-semibold text-foreground-900">{title}</p><p className="mt-0.5 text-[11px] text-foreground-500">{detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <main id="store-products" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 md:px-8 md:py-20 lg:px-12">
        <div className="mb-10 flex flex-col gap-3 border-b border-background-200/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">The collection</p>
            <h2 className="mt-2 font-heading text-3xl font-light tracking-[-0.02em] text-foreground-950 md:text-4xl">Products</h2>
          </div>
          <p className="text-xs text-foreground-500">{products.length} item{products.length === 1 ? "" : "s"} available</p>
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
