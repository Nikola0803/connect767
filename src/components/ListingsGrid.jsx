import { useState } from "react";
import { Link } from "react-router-dom";
import DirectoryListingCard from "./DirectoryListingCard";
import { CardSkeleton, ErrorState } from "./ui/States";
import { useAsync } from "../hooks/useAsync";
import { getFeaturedListings } from "../data/repository";

const tabs = ["All", "Classified", "Featured", "Free"];

export default function ListingsGrid() {
  const { data: listings, loading, error, reload } = useAsync(() => getFeaturedListings(), []);
  const [savedSlugs, setSavedSlugs] = useState(new Set());
  const [activeTab, setActiveTab] = useState("All");

  const visibleListings = (listings || []).filter(
    (item) => activeTab === "All" || item.badge === activeTab
  );

  const toggleSave = (e, slug) => {
    e.preventDefault();
    e.stopPropagation();
    setSavedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-100/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium mb-4">
              <i className="ri-sparkling-2-line" />
              Handpicked this week
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight max-w-2xl">
              Featured <span className="text-accent-500 italic">listings</span> — worth the trip.
            </h2>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center px-3.5 py-2 text-sm font-medium rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? "bg-primary-500 text-background-50 border-primary-500"
                    : "bg-background-50 text-foreground-700 border-background-200/70 hover:border-background-300 hover:bg-background-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <CardSkeleton
            count={6}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
          />
        )}

        {error && <ErrorState message="Couldn't load featured listings." onRetry={reload} />}

        {!loading && !error && visibleListings.length === 0 && (
          <p className="text-center text-sm text-foreground-600 py-10">
            No {activeTab.toLowerCase()} listings right now — check back soon.
          </p>
        )}

        {!loading && !error && visibleListings.length > 0 && (
          <div className="directory-card-grid">
            {visibleListings.map((item) => (
              <DirectoryListingCard
                key={item.slug}
                listing={item}
                saved={savedSlugs.has(item.slug)}
                onToggleSaved={(event, listing) => toggleSave(event, listing.slug)}
                className="h-full"
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-background-300 bg-background-50 text-sm font-semibold text-foreground-950 hover:bg-background-200/60 cursor-pointer whitespace-nowrap"
            to="/listings"
          >
            Explore the full directory
            <i className="ri-arrow-right-line" />
          </Link>
        </div>
      </div>
    </section>
  );
}
