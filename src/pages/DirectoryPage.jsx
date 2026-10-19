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
const INDUSTRY_PREVIEW_COUNT = 14;

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
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [databaseSearch, setDatabaseSearch] = useState(search.trim());

  useEffect(() => {
    const timeout = window.setTimeout(() => setDatabaseSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const activeFilterCount = [
    tier !== "all",
    priceTier !== "all",
    experienceRange !== "all",
    educationFilter !== "all",
  ].filter(Boolean).length;

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

  return (
    <div className="pt-16 md:pt-20">
      {/* Sticky: search only */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 border-b border-background-200/70 bg-background-50/95 backdrop-blur sticky top-16 md:top-20 z-30">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-foreground-400 text-lg pointer-events-none" />
            <input
              className="w-full pl-12 pr-5 py-3.5 rounded-full border border-background-200 bg-white text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-300 focus:shadow-[0_2px_20px_rgba(0,0,0,0.1)] font-label text-base transition-shadow"
              placeholder="Search businesses, services, locations..."
              type="text"
              value={search}
              onChange={(e) => updateFilter(setSearch)(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto">

          {/* Category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2">
            {(directoryCategories || []).map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  const next = cat.slug === "all" ? "all" : category === cat.slug ? "all" : cat.slug;
                  updateFilter(setCategory)(next);
                  setIndustry("all");
                  setShowAllIndustries(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                  (cat.slug === "all" ? category === "all" : category === cat.slug)
                    ? "bg-primary-500 text-background-50 border-primary-500"
                    : "bg-background-50 text-foreground-700 border-background-200/70 hover:border-background-300 hover:bg-background-100"
                }`}
              >
                {cat.icon && (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={`${cat.icon} text-xs`} />
                  </div>
                )}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Industry sub-pills */}
          {category !== "all" && findCategory(category) && (
            <div className="flex flex-wrap items-center gap-2 pl-3 border-l-2 border-primary-200 mb-4">
              <button
                type="button"
                onClick={() => updateFilter(setIndustry)("all")}
                className={`px-3 py-1 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                  industry === "all"
                    ? "bg-accent-500 text-background-50"
                    : "bg-background-50 text-foreground-600 hover:bg-background-100 border border-background-200/70"
                }`}
              >
                All {findCategory(category).label}
              </button>
              {(() => {
                const seen = new Set();
                const unique = findCategory(category).industries.filter((ind) => {
                  if (seen.has(ind.label)) return false;
                  seen.add(ind.label);
                  return true;
                });
                return (showAllIndustries ? unique : unique.slice(0, INDUSTRY_PREVIEW_COUNT)).map((ind) => (
                  <button
                    key={ind.slug}
                    type="button"
                    onClick={() => updateFilter(setIndustry)(ind.slug)}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                      industry === ind.slug
                        ? "bg-accent-500 text-background-50"
                        : "bg-background-50 text-foreground-600 hover:bg-background-100 border border-background-200/70"
                    }`}
                  >
                    {ind.label}
                  </button>
                ));
              })()}
              {findCategory(category).industries.length > INDUSTRY_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllIndustries((v) => !v)}
                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap text-primary-700 hover:text-primary-800"
                >
                  {showAllIndustries ? "Show less" : "View more"}
                  <i className={showAllIndustries ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
                </button>
              )}
            </div>
          )}

          {/* Toolbar: filters toggle + sort + view + count */}
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                showFilters || activeFilterCount > 0
                  ? "bg-primary-500 text-background-50 border-primary-500"
                  : "bg-background-50 text-foreground-700 border-background-200/70 hover:border-background-300 hover:bg-background-100"
              }`}
            >
              <i className="ri-equalizer-line" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-background-50 text-primary-700 font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <span className="text-xs font-label text-foreground-500 whitespace-nowrap">
              {filtered.length} listing{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-label px-3 py-1.5 rounded-lg border border-background-300 bg-background-50 text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer"
              >
                {directorySortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 px-1 py-1 bg-background-100 rounded-lg border border-background-200/70">
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

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-6 p-4 rounded-2xl bg-background-100/60 border border-background-200/70">
              <div className="inline-flex items-center gap-1 px-1 py-1 bg-background-50 rounded-full border border-background-200/70">
                {tierOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateFilter(setTier)(opt.value)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 ${
                      tier === opt.value ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1 px-1 py-1 bg-background-50 rounded-full border border-background-200/70">
                {priceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateFilter(setPriceTier)(opt.value)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 ${
                      priceTier === opt.value ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1 px-1 py-1 bg-background-50 rounded-full border border-background-200/70">
                {experienceRangeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateFilter(setExperienceRange)(opt.value)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 ${
                      experienceRange === opt.value ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <select
                value={educationFilter}
                onChange={(e) => updateFilter(setEducationFilter)(e.target.value)}
                className="text-[11px] font-label px-3 py-1.5 rounded-full border border-background-200/70 bg-background-50 text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer"
              >
                <option value="all">All Education</option>
                {EDUCATION_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>{choice}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-6">
            <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950">
              Browse <span className="text-accent-500 italic">Directory</span>
            </h1>
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
