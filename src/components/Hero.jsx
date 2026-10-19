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
      <div className="relative z-10 w-full px-4 md:px-8 lg:px-12 pb-16 md:pb-24 pt-32 md:pt-40">
        <div className="max-w-5xl">
          <h1 className="font-heading text-background-50 text-4xl sm:text-5xl md:text-7xl font-light leading-[1.05] tracking-tight">
            The Directory.
            <br />
            The Shop.
            <br />
            <span className="italic font-medium">The Custom Kit. </span>
            <span className="text-accent-400">One Place.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-background-50/85 text-base md:text-lg font-light">
            Connect767 is a modern directory, a curated shop, and a 3D Uniform Studio — built for
            the people who make our country feel like home.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 max-w-2xl">
            <div className="relative">
              <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-foreground-400 text-xl pointer-events-none" />
              <input
                className="w-full pl-14 pr-5 py-4 rounded-full bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:shadow-[0_4px_24px_rgba(0,0,0,0.18)] font-label text-base transition-shadow"
                placeholder="Search businesses, services, locations..."
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </form>

          <Link
            to="/match"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-500/15 border border-accent-400/30 hover:bg-accent-500/25 text-background-50 text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className="ri-sparkling-2-fill text-accent-400" />
            Not sure where to start? Try our AI Matching
            <i className="ri-arrow-right-line" />
          </Link>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-background-50/85">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full bg-accent-500 border-2 border-background-50 flex items-center justify-center text-xs font-bold">
                  AJ
                </div>
                <div className="w-9 h-9 rounded-full bg-primary-500 border-2 border-background-50 flex items-center justify-center text-xs font-bold">
                  RP
                </div>
                <div className="w-9 h-9 rounded-full bg-secondary-600 border-2 border-background-50 flex items-center justify-center text-xs font-bold">
                  NF
                </div>
              </div>
              <div className="text-xs">
                <div className="font-semibold text-background-50">Loved by locals</div>
                <div className="text-background-50/70">Featured in 4 island guides</div>
              </div>
            </div>
            <Link
              className="ml-auto md:ml-0 inline-flex items-center gap-2 text-sm font-medium text-background-50 hover:text-accent-400 cursor-pointer"
              to="/listings/submit"
            >
              Post a listing — it's free
              <i className="ri-arrow-right-up-line" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
