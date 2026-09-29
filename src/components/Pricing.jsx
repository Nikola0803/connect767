import { Link } from "react-router-dom";

const freeFeatures = [
  "Booking module enabled",
  "Pricing module enabled",
  "One listing",
  "24/7 support",
];

const proFeatures = [
  "Booking module enabled",
  "Pricing module enabled",
  "Up to 15 listings",
  "Featured on premium website location (up to 3 months)",
  "Biography highlight (provided by client)",
  "Featured on \"Trending Listings\"",
  "Shared across all Connect767 social media handles",
  "24/7 support",
];

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto">
          {/* Free tier */}
          <div className="relative rounded-2xl p-8 md:p-10 border transition-colors bg-background-100/60 border-background-200/70 text-foreground-950 hover:border-primary-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-2xl font-medium text-foreground-950">Free Listing</h3>
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-background-50 text-primary-700 border border-background-200/70">
                <i className="ri-price-tag-3-line text-lg" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-heading text-5xl font-light text-foreground-950">$0</span>
              <span className="text-sm font-label text-foreground-600">forever</span>
            </div>
            <p className="text-sm font-label mb-8 text-foreground-600">Best for testing the waters</p>
            <ul className="space-y-3 mb-10">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <i className="ri-check-line text-xs" />
                  </span>
                  <span className="font-label text-foreground-800">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-md text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors bg-foreground-950 text-background-50 hover:bg-foreground-800"
              to="/listings/submit?tier=free"
            >
              Start free
              <i className="ri-arrow-right-line" />
            </Link>
          </div>

          {/* Classified tier */}
          <div className="relative rounded-2xl p-8 md:p-10 border transition-colors bg-primary-950 text-background-50 border-primary-950">
            <span className="absolute -top-3 right-6 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold uppercase tracking-wider">
              <i className="ri-vip-crown-line" />
              Most Popular
            </span>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-2xl font-medium text-background-50">Classified</h3>
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-background-50/15 text-background-50">
                <i className="ri-vip-crown-line text-lg" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-heading text-5xl font-light text-background-50">$40</span>
              <span className="text-sm font-label text-background-50/70">/yr, one-time</span>
            </div>
            <p className="text-sm font-label mb-6 text-background-50/75">Get to the top of results</p>
            <div className="flex items-center gap-2.5 mb-6 px-3.5 py-2.5 rounded-lg bg-accent-500/15 border border-accent-400/30">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-accent-500 text-background-50 flex-shrink-0">
                <i className="ri-shield-check-fill text-xs" />
              </span>
              <span className="text-sm font-label font-semibold text-background-50">
                Verified checkmark added to your profile
              </span>
            </div>
            <ul className="space-y-3 mb-10">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-accent-500/25 text-accent-300">
                    <i className="ri-check-line text-xs" />
                  </span>
                  <span className="font-label text-background-50/90">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-md text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors bg-accent-500 text-background-50 hover:bg-accent-600"
              to="/listings/submit?tier=classified"
            >
              Go Classified
              <i className="ri-arrow-right-line" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
