import ListingTierCards from "./ListingTierCards";

export default function Pricing() {
  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium mb-4">
            <i className="ri-price-tag-3-line" />
            Free &amp; Classified
          </div>
          <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight">
            Two ways to list. <span className="italic text-primary-700">Zero pressure.</span>
          </h2>
          <p className="mt-4 text-foreground-700 text-base md:text-lg font-light">
            Post free to test the waters. Upgrade to Classified for up to 15 listings, premium
            placement, and a spot on Trending Listings — one payment, a full year.
          </p>
        </div>

        <ListingTierCards className="mx-auto max-w-4xl" />
      </div>
    </section>
  );
}
