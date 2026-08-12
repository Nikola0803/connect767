import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DirectoryListingCard from "../components/DirectoryListingCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { getListings, getDirectoryCategories } from "../data/repository";
import { tierOptions, priceOptions, directorySortOptions } from "../data/directory";
import { findCategory } from "../data/industries";

const PAGE_SIZE = 12;
const INDUSTRY_PREVIEW_COUNT = 14;

export default function DirectoryPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [industry, setIndustry] = useState("all");
  const [tier, setTier] = useState("all");
  const [priceTier, setPriceTier] = useState("all");
  const [sort, setSort] = useState("rating");
  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  const {
    data: directoryListings,
    loading,
    error,
    reload,
  } = useAsync(() => getListings(), []);
  const { data: directoryCategories } = useAsync(() => getDirectoryCategories(), []);

  const filtered = useMemo(() => {
    if (!directoryListings) return [];
    let list = directoryListings.filter((l) => {
      const matchesSearch =
        !search ||
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.category.toLowerCase().includes(search.toLowerCase()) ||
        l.location.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || l.categorySlug === category;
      const matchesIndustry = industry === "all" || l.industrySlug === industry;
      const matchesTier = tier === "all" || l.badge === tier;
      const matchesPrice = priceTier === "all" || l.price === priceTier;
      return matchesSearch && matchesCategory && matchesIndustry && matchesTier && matchesPrice;
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
  }, [directoryListings, search, category, industry, tier, priceTier, sort]);

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
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 border-b border-background-200/70 bg-background-50/95 backdrop-blur sticky top-16 md:top-20 z-30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4">
            <form
              className="relative flex gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="relative flex-1">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
                <input
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label"
                  placeholder="Search businesses, services, locations..."
                  type="text"
                  value={search}
                  onChange={(e) => updateFilter(setSearch)(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <i className="ri-search-line" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 flex-1">
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
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border transition-all whitespace-nowrap cursor-pointer ${
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

            {category !== "all" && findCategory(category) && (
              <div className="flex flex-wrap items-center gap-2 pl-3 border-l-2 border-primary-200">
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
                  // Defensive de-dup by label — belt-and-suspenders in case
                  // duplicate industry terms ever exist upstream (e.g. an
                  // older WordPress import run before a taxonomy fix), so a
                  // stray duplicate can never show up twice in the UI even
                  // if the underlying data briefly has one.
                  const seen = new Set();
                  const unique = findCategory(category).industries.filter((ind) => {
                    if (seen.has(ind.label)) return false;
                    seen.add(ind.label);
                    return true;
                  });
                  return (showAllIndustries ? unique : unique.slice(0, INDUSTRY_PREVIEW_COUNT)).map(
                    (ind) => (
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
                    )
                  );
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <div className="inline-flex items-center gap-1 px-1 py-1 bg-background-100 rounded-full border border-background-200/70 overflow-x-auto max-w-full">
                  {tierOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateFilter(setTier)(opt.value)}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 ${
                        tier === opt.value
                          ? "bg-accent-500 text-background-50"
                          : "text-foreground-600 hover:text-foreground-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1 px-1 py-1 bg-background-100 rounded-full border border-background-200/70 overflow-x-auto max-w-full">
                  {priceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateFilter(setPriceTier)(opt.value)}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-full cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 ${
                        priceTier === opt.value
                          ? "bg-secondary-500 text-background-50"
                          : "text-foreground-600 hover:text-foreground-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:ml-auto flex items-center gap-3">
                <span className="text-xs font-label text-foreground-500 whitespace-nowrap">
                  {filtered.length} listing{filtered.length === 1 ? "" : "s"}
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="text-xs font-label px-3 py-1.5 rounded-lg border border-background-300 bg-background-50 text-foreground-800 focus:outline-none focus:border-primary-400 cursor-pointer"
                >
                  {directorySortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950">
                Browse <span className="text-accent-500 italic">Directory</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mt-1">
                {filtered.length} listing{filtered.length === 1 ? "" : "s"} found
              </p>
            </div>
            <div className="flex items-center gap-1 px-1 py-1 bg-background-100 rounded-lg border border-background-200/70">
              <button
                aria-label="Grid view"
                type="button"
                onClick={() => setView("grid")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  view === "grid"
                    ? "bg-background-50 text-foreground-950"
                    : "text-foreground-500 hover:text-foreground-700"
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
                  view === "list"
                    ? "bg-background-50 text-foreground-950"
                    : "text-foreground-500 hover:text-foreground-700"
                }`}
              >
                <i className="ri-list-check" />
                <span className="hidden sm:inline ml-1">List</span>
              </button>
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
