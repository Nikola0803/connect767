import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { heroImage } from "../data/content";
export default function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
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
    goToDirectory({ q: query.trim() });
  };

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
          <h1 className="font-heading text-background-50 text-[clamp(2.05rem,4.15vw,4.05rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            Dominica’s <span className="italic text-accent-400">Online Directory</span>
          </h1>
          <p className="mt-1.5 font-heading text-background-50 text-[clamp(1.05rem,1.75vw,1.6rem)] font-medium leading-tight tracking-[-0.015em]">
            Dominica’s Trusted Directory for Talent, Services &amp; Opportunities.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center overflow-hidden rounded-[2rem] sm:rounded-full bg-background-50 p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.22)] focus-within:shadow-[0_12px_42px_rgba(0,0,0,0.3)] transition-shadow">
              <div className="relative flex-1 min-w-0">
                <i className="ri-search-line absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-primary-800 text-xl pointer-events-none" />
                <input
                  aria-label="Search the directory"
                  className="w-full h-12 sm:h-14 pl-12 sm:pl-14 pr-4 bg-transparent text-foreground-950 placeholder-foreground-500 focus:outline-none font-label text-sm"
                  placeholder="Discover Dominican businesses, professionals and service providers worldwide"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-2 sm:pt-0 sm:pl-2 border-t sm:border-t-0 border-background-200">
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
        </div>
      </div>
    </section>
  );
}
