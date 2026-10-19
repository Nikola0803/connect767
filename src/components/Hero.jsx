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
    <section className="relative w-full min-h-[720px] md:min-h-[820px] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          alt="Local town street at golden hour"
          className="w-full h-full object-cover object-top"
          src={heroImage}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/60 via-foreground-950/35 to-foreground-950/70" />
      </div>
      <div className="relative z-10 w-full px-4 md:px-8 lg:px-12 pb-[12vh] md:pb-[14vh]">
        <div className="w-full max-w-6xl mx-auto text-center">
          <h1 className="font-heading text-background-50 text-2xl sm:text-3xl lg:text-4xl font-light leading-tight tracking-tight lg:whitespace-nowrap">
            Dominican Talent, Services, and Opportunity—<span className="italic text-accent-400">All in One Place.</span>
          </h1>
          <form onSubmit={handleSubmit} className="mt-5 max-w-2xl mx-auto">
            <div className="relative">
              <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-foreground-400 text-xl pointer-events-none" />
              <input
                aria-label="Search the directory"
                className="w-full pl-14 pr-28 sm:pr-36 py-4 rounded-full bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:shadow-[0_4px_24px_rgba(0,0,0,0.18)] font-label text-base transition-shadow"
                placeholder="Find local businesses, products, and services"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Link
                to="/match"
                aria-label="Open AI Matching"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center gap-1.5 h-11 px-3.5 sm:px-4 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 transition-colors"
              >
                <i className="ri-sparkling-2-fill text-accent-400" aria-hidden="true" />
                <span className="sm:hidden">AI</span>
                <span className="hidden sm:inline">AI Match</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
