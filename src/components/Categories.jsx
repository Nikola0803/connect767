import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getHomeCategories } from "../data/repository";
import { CardSkeleton, ErrorState } from "./ui/States";

export default function Categories() {
  const { data: categories, loading, error, reload } = useAsync(() => getHomeCategories(), []);

  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-14">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium mb-4">
              <i className="ri-shapes-line" />
              Browse by category
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight max-w-2xl">
              Every Community. Every Business. <span className="italic">One Connection.</span>
            </h2>
          </div>
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
            to="/listings"
          >
            See all 7 categories
            <i className="ri-arrow-right-line" />
          </Link>
        </div>

        {loading && (
          <CardSkeleton count={7} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4" />
        )}

        {error && <ErrorState message="Couldn't load categories." onRetry={reload} />}

        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={`/listings${cat.href}`}
                className={`group/card relative flex h-40 cursor-pointer flex-col justify-between rounded-[1.5rem] border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_20px_46px_rgba(31,112,78,0.12)] md:h-48 md:p-6 ${
                  cat.active
                    ? "border-primary-300 bg-primary-50/40"
                    : "border-background-200 bg-background-50"
                }`}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-background-50 shadow-sm transition-transform duration-300 group-hover/card:scale-105"
                >
                  <i className={`${cat.icon || "ri-price-tag-3-line"} text-xl`} />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-medium text-foreground-950 md:text-xl">
                    {cat.name}
                  </h3>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-label text-xs text-foreground-600">
                      {cat.count}
                    </span>
                    <i className="ri-arrow-right-up-line text-lg text-primary-700 transition-transform group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
