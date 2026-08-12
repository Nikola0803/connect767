import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { heroImage } from "../data/content";
import { categoryTaxonomy } from "../data/industries";

export default function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
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
    const q = [query, location].filter(Boolean).join(" ").trim();
    goToDirectory({ q, category });
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

          <form
            onSubmit={handleSubmit}
            className="mt-10 bg-background-50 rounded-2xl p-2 shadow-none max-w-4xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto] gap-2">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background-50 md:border-r md:border-background-200">
                <i className="ri-search-2-line text-foreground-500 text-lg w-5 h-5 flex items-center justify-center" />
                <input
                  className="flex-1 bg-transparent text-sm text-foreground-950 placeholder-foreground-400 focus:outline-none font-label"
                  placeholder="What are you looking for?"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl md:border-r md:border-background-200">
                <i className="ri-map-pin-line text-foreground-500 text-lg w-5 h-5 flex items-center justify-center" />
                <input
                  className="flex-1 bg-transparent text-sm text-foreground-950 placeholder-foreground-400 focus:outline-none font-label"
                  placeholder="Where?"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl">
                <i className="ri-price-tag-3-line text-foreground-500 text-lg w-5 h-5 flex items-center justify-center" />
                <select
                  className="flex-1 bg-transparent text-sm text-foreground-950 focus:outline-none font-label cursor-pointer pr-6"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categoryTaxonomy.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                type="submit"
              >
                Search
                <i className="ri-arrow-right-line" />
              </button>
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
