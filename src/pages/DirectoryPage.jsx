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
  const [showFilters, setShowFilters] = useState(false);
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
      <div className="border-b border-background-200/70 bg-background-100/60">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-10">
          <div className="mb-6 max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700 mb-2">
              <span className="w-7 h-px bg-accent-500" />
              Dominica Directory
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-light leading-tight text-foreground-950">
              Find the right local <span className="italic text-accent-500">connection.</span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-foreground-600">
              Search trusted talent, businesses, products and services across Dominica.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-background-200/80 bg-background-50 shadow-[0_18px_50px_rgba(35,45,38,0.08)] overflow-hidden">
            <div className="p-3 md:p-4 border-b border-background-200/70">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-primary-600 text-lg pointer-events-none" />
                  <input
                    aria-label="Search directory listings"
                    className="w-full h-12 pl-12 pr-11 rounded-xl border border-background-300/80 bg-white text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 font-label text-sm md:text-base transition-all"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-foreground-400 hover:text-foreground-800 hover:bg-background-100 cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((value) => !value)}
                  aria-expanded={showFilters}
                  className={`h-12 inline-flex items-center justify-center gap-2 px-5 rounded-xl border font-semibold text-sm cursor-pointer transition-all ${
                    showFilters || activeFilterCount > 0
                      ? "bg-primary-600 text-background-50 border-primary-600 shadow-sm"
                      : "bg-background-50 text-foreground-800 border-background-300 hover:border-primary-300 hover:bg-primary-50/50"
                  }`}
                >
                  <i className="ri-equalizer-2-line text-base" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-background-50 text-primary-700 text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                  <i className={`text-base ${showFilters ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}`} />
                </button>
              </div>
            </div>

            <div className="px-3 md:px-4 py-3 flex items-center gap-2 overflow-x-auto">
              <span className="hidden md:inline text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-400 mr-1 whitespace-nowrap">
                Browse
              </span>
              {(directoryCategories || []).map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => {
                    const next = cat.slug === "all" ? "all" : category === cat.slug ? "all" : cat.slug;
                    updateFilter(setCategory)(next);
                    setIndustry("all");
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                    (cat.slug === "all" ? category === "all" : category === cat.slug)
                      ? "bg-primary-100 text-primary-800 border-primary-200"
                      : "bg-transparent text-foreground-600 border-transparent hover:text-foreground-950 hover:bg-background-100"
                  }`}
                >
                  {cat.icon && <i className={`${cat.icon} text-sm`} />}
                  {cat.label}
                </button>
              ))}
            </div>

            {showFilters && (
              <div className="px-4 md:px-5 py-5 border-t border-background-200/70 bg-white/70">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <label className="block">
                    <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-foreground-500">Industry</span>
                    <select
                      value={industry}
                      onChange={(e) => updateFilter(setIndustry)(e.target.value)}
                      disabled={!selectedCategory}
                      className="w-full h-10 px-3 rounded-lg border border-background-300 bg-background-50 text-xs text-foreground-800 focus:outline-none focus:border-primary-400 disabled:text-foreground-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="all">{selectedCategory ? `All ${selectedCategory.label}` : "Choose a category first"}</option>
                      {industryOptions.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-foreground-500">Listing type</span>
                    <select value={tier} onChange={(e) => updateFilter(setTier)(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-background-300 bg-background-50 text-xs text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer">
                      {tierOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-foreground-500">Price</span>
                    <select value={priceTier} onChange={(e) => updateFilter(setPriceTier)(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-background-300 bg-background-50 text-xs text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer">
                      {priceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-foreground-500">Experience</span>
                    <select value={experienceRange} onChange={(e) => updateFilter(setExperienceRange)(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-background-300 bg-background-50 text-xs text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer">
                      {experienceRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block mb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-foreground-500">Education</span>
                    <select value={educationFilter} onChange={(e) => updateFilter(setEducationFilter)(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-background-300 bg-background-50 text-xs text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer">
                      <option value="all">All education</option>
                      {EDUCATION_CHOICES.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                    </select>
                  </label>
                </div>
                {(activeFilterCount > 0 || search) && (
                  <div className="mt-4 pt-4 border-t border-background-200/70 flex items-center justify-between gap-4">
                    <span className="text-xs text-foreground-500">Refine your results using any combination of filters.</span>
                    <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 hover:text-accent-800 cursor-pointer whitespace-nowrap">
                      <i className="ri-refresh-line" />
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-light text-foreground-950">
                Browse <span className="text-accent-500 italic">Directory</span>
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
                className="h-9 text-xs font-label px-3 rounded-lg border border-background-300 bg-background-50 text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer"
              >
                {directorySortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 p-1 bg-background-100 rounded-lg border border-background-200/70">
                <button
                  aria-label="Grid view"
                  type="button"
                  onClick={() => setView("grid")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    view === "grid" ? "bg-background-50 text-foreground-950" : "text-foreground-500 hover:text-foreground-700"
                  }`}
                >
                  <i className="ri-layout-grid-line" />
                  <span className="hidden sm:inline ml-1">Grid</span>
                </button>
                <button
                  aria-label="List view"
                  type="button"
                  onClick={() => setView("list")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    view === "list" ? "bg-background-50 text-foreground-950" : "text-foreground-500 hover:text-foreground-700"
                  }`}
                >
                  <i className="ri-list-check" />
                  <span className="hidden sm:inline ml-1">List</span>
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
                  className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-600 hover:bg-background-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <i className="ri-arrow-left-s-line text-sm" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-semibold cursor-pointer transition-colors ${
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
                  className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-600 hover:bg-background-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
