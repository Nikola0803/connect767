import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { heroImage } from "../data/content";
export default function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState("directory");
  // The trending-category pills that used to sit under the search bar were
  // removed. Their getHomeCategories() fetch went with them — leaving it
  // would have been a request on every homepage load feeding nothing. The
  // same data still powers the "Browse by category" section (Categories.jsx).

  const goToDirectory = (params) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.category) search.set("category", params.category);
    navigate(`/listings${search.toString() ? `?${search.toString()}` : ""}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = query.trim();
    if (searchScope === "shop") {
      navigate(`/shop${value ? `?q=${encodeURIComponent(value)}` : ""}`);
      return;
    }
    goToDirectory({ q: value });
  };

  const placeholder = searchScope === "shop"
    ? "Search Dominican products, apparel and gifts"
    : "Search business, professionals & service providers worldwide";

  return (
    <section className="relative flex min-h-[560px] w-full items-center overflow-hidden sm:min-h-[680px] md:min-h-[820px]">
      <div className="absolute inset-0">
        <img
          alt="Local town street at golden hour"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover object-top"
          src={heroImage}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/60 via-foreground-950/35 to-foreground-950/70" />
      </div>
      <div className="relative z-10 w-full translate-y-6 px-4 pb-16 pt-20 sm:translate-y-14 md:translate-y-28 md:px-8 md:pb-12 md:pt-20 lg:px-12">
        <div className="w-full max-w-7xl mx-auto text-center">
          <h1 className="whitespace-nowrap font-heading text-background-50 text-[clamp(1.2rem,6.2vw,2.05rem)] sm:text-[clamp(2.05rem,4.15vw,4.05rem)] font-semibold leading-[0.98] tracking-[-0.045em] sm:tracking-[-0.035em]">
            Dominica’s <span className="italic text-accent-400">Online Directory</span>
          </h1>
          <p className="mx-auto mt-1.5 max-w-fit font-heading text-background-50 text-[clamp(0.78rem,1.1vw,1rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            Discover Dominican Excellence at Home &amp; Abroad
          </p>
          <form onSubmit={handleSubmit} className="mx-auto mt-5 max-w-5xl">
            <div className="flex flex-col overflow-hidden rounded-[1.35rem] bg-background-50 p-1.5 shadow-[0_14px_45px_rgba(0,0,0,0.25)] transition-shadow focus-within:shadow-[0_18px_55px_rgba(0,0,0,0.34)] lg:flex-row lg:items-center lg:rounded-full">
              <div className="flex items-center gap-1 rounded-full bg-background-100 p-1 lg:mr-1 flex-shrink-0">
                {[
                  { value: "directory", label: "Directory", icon: "ri-map-pin-2-line" },
                  { value: "shop", label: "Shop", icon: "ri-shopping-bag-3-line" },
                ].map((scope) => (
                  <button
                    key={scope.value}
                    type="button"
                    aria-pressed={searchScope === scope.value}
                    onClick={() => setSearchScope(scope.value)}
                    className={`flex-1 lg:flex-none inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-all cursor-pointer ${
                      searchScope === scope.value
                        ? "bg-background-50 text-primary-800 shadow-sm"
                        : "text-foreground-500 hover:text-foreground-800"
                    }`}
                  >
                    <i className={scope.icon} aria-hidden="true" />
                    {scope.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-0">
                <i className="ri-search-line absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-primary-800 text-xl pointer-events-none" />
                <input
                  aria-label={`Search the ${searchScope}`}
                  className="w-full h-12 sm:h-14 pl-12 sm:pl-14 pr-4 bg-transparent text-foreground-950 placeholder-foreground-500 focus:outline-none font-label text-sm"
                  placeholder={placeholder}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-background-200 pt-2 lg:border-t-0 lg:pl-2 lg:pt-0">
                <Link
                  to="/match"
                  aria-label="Open AI Matching"
                  className="inline-flex h-11 w-full min-w-28 items-center justify-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-5 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 sm:h-12 lg:w-auto"
                >
                  <i className="ri-sparkling-2-fill" aria-hidden="true" />
                  AI Match
                </Link>
              </div>
            </div>
          </form>
          <div className="-mx-1 mt-4 flex snap-x snap-mandatory flex-nowrap items-center justify-start gap-1 overflow-x-auto px-1 pb-1 text-[11px] font-semibold text-background-50/85 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
            <Link to="/listings?tier=Classified" className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 transition-colors hover:bg-background-50/15 hover:text-background-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300">
              <i className="ri-award-line text-accent-300" aria-hidden="true" /> Classified Listings
            </Link>
            <Link to="/listings?booking=true" className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 transition-colors hover:bg-background-50/15 hover:text-background-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300">
              <i className="ri-calendar-check-line text-accent-300" aria-hidden="true" /> Book Rentals &amp; Services
            </Link>
            <Link to="/listings/submit?tier=free" className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 transition-colors hover:bg-background-50/15 hover:text-background-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300">
              <i className="ri-add-circle-line text-accent-300" aria-hidden="true" /> Create Your Free Listing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
