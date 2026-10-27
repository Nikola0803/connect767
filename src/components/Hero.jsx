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
    <section className="relative w-full min-h-[640px] sm:min-h-[720px] md:min-h-[820px] flex items-center overflow-hidden">
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
      <div className="relative z-10 w-full translate-y-12 sm:translate-y-20 md:translate-y-28 px-4 md:px-8 lg:px-12 pt-16 md:pt-20 pb-12">
        <div className="w-full max-w-7xl mx-auto text-center">
          <h1 className="whitespace-nowrap font-heading text-background-50 text-[clamp(1.2rem,6.2vw,2.05rem)] sm:text-[clamp(2.05rem,4.15vw,4.05rem)] font-semibold leading-[0.98] tracking-[-0.045em] sm:tracking-[-0.035em]">
            Dominica’s <span className="italic text-accent-400">Online Directory</span>
          </h1>
          <p className="mx-auto mt-1.5 max-w-fit font-heading text-background-50 text-[clamp(0.78rem,1.1vw,1rem)] font-normal leading-tight tracking-normal">
            Discover Dominican Excellence at Home and Abroad
          </p>
          <form onSubmit={handleSubmit} className="mt-5 max-w-5xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center overflow-hidden rounded-[1.75rem] lg:rounded-full bg-background-50 p-1.5 shadow-[0_14px_45px_rgba(0,0,0,0.25)] focus-within:shadow-[0_18px_55px_rgba(0,0,0,0.34)] transition-shadow">
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
              <div className="flex items-center gap-2 pt-2 lg:pt-0 lg:pl-2 border-t lg:border-t-0 border-background-200">
                <Link
                  to="/match"
                  aria-label="Open AI Matching"
                  className="flex-1 sm:flex-none inline-flex h-11 sm:h-12 min-w-28 items-center justify-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
                >
                  <i className="ri-sparkling-2-fill text-background-50" aria-hidden="true" />
                  AI Match
                </Link>
              </div>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-background-50/85">
            <Link to="/listings?tier=Classified" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-background-50/15 hover:text-background-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300">
              <i className="ri-award-line text-accent-300" aria-hidden="true" /> Classified Listings
            </Link>
            <Link to="/listings?booking=true" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-background-50/15 hover:text-background-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300">
              <i className="ri-calendar-check-line text-accent-300" aria-hidden="true" /> Book Rentals &amp; Services
            </Link>
            <Link to="/listings/submit?tier=free" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-background-50/15 hover:text-background-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300">
              <i className="ri-add-circle-line text-accent-300" aria-hidden="true" /> List Your Business or Profile — Free
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
