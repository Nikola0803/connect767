import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DirectoryListingCard from "../components/DirectoryListingCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { getListings, getDirectoryCategories } from "../data/repository";
import { tierOptions, priceOptions, directorySortOptions, experienceRangeOptions, matchesExperienceRange } from "../data/directory";
import { EDUCATION_CHOICES } from "../data/profileChoices";
import { findCategory } from "../data/industries";
import { listingMatchesSearch } from "../lib/listingSearch";

const PAGE_SIZE = 12;

export default function DirectoryPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [industry, setIndustry] = useState("all");
  const [tier, setTier] = useState("all");
  const [priceTier, setPriceTier] = useState("all");
  const [educationFilter, setEducationFilter] = useState("all");
  const [experienceRange, setExperienceRange] = useState("all");
  const [sort, setSort] = useState("rating");
  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);
  const [databaseSearch, setDatabaseSearch] = useState(search.trim());

  useEffect(() => {
    const timeout = window.setTimeout(() => setDatabaseSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const activeFilterCount = [
    category !== "all",
    industry !== "all",
    tier !== "all",
    priceTier !== "all",
    experienceRange !== "all",
    educationFilter !== "all",
  ].filter(Boolean).length;

  const selectedCategory = category !== "all" ? findCategory(category) : null;
  const industryOptions = useMemo(() => {
    if (!selectedCategory) return [];
    const seen = new Set();
    return selectedCategory.industries.filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
  }, [selectedCategory]);

  const {
    data: directoryListings,
    loading,
    error,
    reload,
  } = useAsync(() => getListings({ search: databaseSearch }), [databaseSearch]);
  const { data: directoryCategories } = useAsync(() => getDirectoryCategories(), []);

  const filtered = useMemo(() => {
    if (!directoryListings) return [];
    let list = directoryListings.filter((l) => {
      const matchesSearch = listingMatchesSearch(l, search);
      const matchesCategory = category === "all" || l.categorySlug === category;
      const matchesIndustry = industry === "all" || l.industrySlug === industry;
      const matchesTier = tier === "all" || l.badge === tier;
      const matchesPrice = priceTier === "all" || l.price === priceTier;
      const matchesEducation =
        educationFilter === "all" || (l.education || "").toLowerCase() === educationFilter.toLowerCase();
      const matchesExperience = matchesExperienceRange(l.yearsExperience, experienceRange);
      return matchesSearch && matchesCategory && matchesIndustry && matchesTier && matchesPrice && matchesEducation && matchesExperience;
    });

    switch (sort) {
      case "reviews":
        list = [...list].sort(
          (a, b) => parseInt(b.reviews.replace(/\D/g, "")) - parseInt(a.reviews.replace(/\D/g, ""))
        );
        break;
      case "price-low":
        list = [...list].sort((a, b) => a.price.length - b.price.length);
        break;
      case "price-high":
        list = [...list].sort((a, b) => b.price.length - a.price.length);
        break;
      case "rating":
        list = [...list].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
        break;
      default:
        break;
    }
    return list;
  }, [directoryListings, search, category, industry, tier, priceTier, educationFilter, experienceRange, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const clearAll = () => {
    setSearch("");
    setCategory("all");
    setIndustry("all");
    setTier("all");
    setPriceTier("all");
    setEducationFilter("all");
    setExperienceRange("all");
    setPage(1);
  };

  return (
    <div className="pt-16 md:pt-20 min-h-screen bg-background-50">
      <section className="relative overflow-hidden bg-primary-950 text-background-50">
        <div className="absolute -top-28 right-0 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-36 left-1/4 h-80 w-80 rounded-full bg-accent-500/15 blur-3xl pointer-events-none" />
        <div className="relative w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 pt-10 pb-20 md:pt-14 md:pb-24">
          <div>
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-background-50/15 bg-background-50/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
                <span className="ml-2 text-primary-200">CONNECT</span>
                <span className="text-accent-400">767</span>
                <span className="ml-1 text-background-50/85 tracking-[0.08em]">Dominica’s Online Directory</span>
              </div>
              <h1 className="mt-4 font-heading text-[clamp(2.35rem,5vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.04em]">
                Find your next <span className="italic text-accent-400">connection.</span>
              </h1>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-10 w-full px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto rounded-[1.6rem] border border-background-200/80 bg-background-50 p-3 md:p-4 shadow-[0_24px_70px_rgba(24,48,36,0.14)]">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-primary-700 text-lg pointer-events-none" />
            <input
              aria-label="Search directory listings"
              className="w-full h-14 pl-12 pr-11 rounded-xl border border-background-300/80 bg-white text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 font-label text-sm md:text-base transition-all"
              placeholder="Search businesses, services, skills or locations"
              type="search"
              value={search}
              onChange={(e) => updateFilter(setSearch)(e.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => updateFilter(setSearch)("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-foreground-400 hover:text-foreground-800 hover:bg-background-100 cursor-pointer transition-colors"
              >
                <i className="ri-close-line" />
              </button>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-background-200/70 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="inline-flex h-9 items-center gap-2 px-3 rounded-full bg-primary-50 text-[10px] font-bold uppercase tracking-[0.13em] text-primary-800 whitespace-nowrap flex-shrink-0">
              <i className="ri-equalizer-2-line text-sm" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary-700 text-background-50 text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </span>

              <label className="relative flex-shrink-0">
                <span className="sr-only">All Categories</span>
                <select
                  value={category}
                  onChange={(e) => {
                    updateFilter(setCategory)(e.target.value);
                    setIndustry("all");
                  }}
                  className="appearance-none h-9 min-w-36 pl-3.5 pr-8 rounded-full border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer"
                >
                  {(directoryCategories || []).map((cat) => (
                    <option key={cat.slug} value={cat.slug}>{cat.slug === "all" ? "All Categories" : cat.label}</option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Industry</span>
                <select value={industry} onChange={(e) => updateFilter(setIndustry)(e.target.value)} disabled={!selectedCategory} className="appearance-none h-9 min-w-32 pl-3.5 pr-8 rounded-full border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 disabled:text-foreground-400 disabled:bg-background-100 disabled:cursor-not-allowed cursor-pointer">
                  <option value="all">Industry</option>
                  {industryOptions.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Experience</span>
                <select value={experienceRange} onChange={(e) => updateFilter(setExperienceRange)(e.target.value)} className="appearance-none h-9 min-w-32 pl-3.5 pr-8 rounded-full border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer">
                  {experienceRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.value === "all" ? "Experience" : option.label}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Education</span>
                <select value={educationFilter} onChange={(e) => updateFilter(setEducationFilter)(e.target.value)} className="appearance-none h-9 min-w-32 pl-3.5 pr-8 rounded-full border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer">
                  <option value="all">Education</option>
                  {EDUCATION_CHOICES.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Price</span>
                <select value={priceTier} onChange={(e) => updateFilter(setPriceTier)(e.target.value)} className="appearance-none h-9 min-w-24 pl-3.5 pr-8 rounded-full border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer">
                  {priceOptions.map((option) => <option key={option.value} value={option.value}>{option.value === "all" ? "Price" : option.label}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Listing Type</span>
                <select value={tier} onChange={(e) => updateFilter(setTier)(e.target.value)} className="appearance-none h-9 min-w-32 pl-3.5 pr-8 rounded-full border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer">
                  {tierOptions.map((option) => <option key={option.value} value={option.value}>{option.value === "all" ? "Listing Type" : option.label}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              {(activeFilterCount > 0 || search) && (
                <button type="button" onClick={clearAll} className="h-9 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-accent-700 hover:text-accent-800 hover:bg-accent-50 rounded-full cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors">
                  <i className="ri-close-circle-line" />
                  Clear all
                </button>
              )}
          </div>
        </div>
      </section>

      <div className="w-full px-4 md:px-8 lg:px-12 pt-14 pb-12 md:pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-7">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 mb-2">
                Discover Dominican Service providers worldwide
              </div>
              <h2 className="font-heading text-2xl md:text-4xl font-light text-foreground-950">
                Browse the <span className="text-accent-500 italic">directory</span>
              </h2>
              <p className="mt-1 text-xs text-foreground-500">
                {loading ? "Finding listings…" : `${filtered.length} listing${filtered.length === 1 ? "" : "s"} found`}
              </p>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <label className="sr-only" htmlFor="directory-sort">Sort listings</label>
              <select
                id="directory-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 min-w-40 text-xs font-semibold pl-4 pr-8 rounded-full border border-background-300 bg-background-50 text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer"
              >
                {directorySortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 p-1 bg-background-100 rounded-full border border-background-200/70">
                <button
                  aria-label="Grid view"
                  type="button"
                  onClick={() => setView("grid")}
                  className={`w-8 h-8 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    view === "grid" ? "bg-background-50 text-primary-700 shadow-sm" : "text-foreground-500 hover:text-foreground-700"
                  }`}
                >
                  <i className="ri-layout-grid-line" />
                </button>
                <button
                  aria-label="List view"
                  type="button"
                  onClick={() => setView("list")}
                  className={`w-8 h-8 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    view === "list" ? "bg-background-50 text-primary-700 shadow-sm" : "text-foreground-500 hover:text-foreground-700"
                  }`}
                >
                  <i className="ri-list-check" />
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <CardSkeleton
              count={8}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            />
          )}

          {error && <ErrorState message="Couldn't load listings." onRetry={reload} />}

          {!loading && !error && pageItems.length === 0 && (
            <EmptyState
              icon="ri-search-line"
              title="No listings match your filters"
              description="Try clearing a filter or search term"
            />
          )}

          {!loading && !error && pageItems.length > 0 && (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                  : "flex flex-col gap-5"
              }
            >
              {pageItems.map((listing) => (
                <DirectoryListingCard key={listing.slug} listing={listing} view={view} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-10">
              <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
                <button
                  aria-label="Previous page"
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-background-200 text-foreground-600 hover:bg-background-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <i className="ri-arrow-left-s-line text-sm" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-9 h-9 flex items-center justify-center rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      n === currentPage
                        ? "bg-primary-500 text-background-50"
                        : "text-foreground-700 hover:bg-background-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  aria-label="Next page"
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-background-200 text-foreground-600 hover:bg-background-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <i className="ri-arrow-right-s-line text-sm" />
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
