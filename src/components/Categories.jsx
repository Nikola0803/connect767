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
              Every corner of town, <span className="italic">indexed and alive.</span>
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
                className={`group relative rounded-xl border p-5 md:p-6 flex flex-col justify-between h-40 md:h-48 cursor-pointer transition-all ${
                  cat.active
                    ? "bg-accent-500 text-background-50 border-accent-500 hover:bg-accent-600 hover:border-accent-600"
                    : "border-background-200/70 bg-background-100/60 hover:border-primary-300 hover:bg-primary-50/50"
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center rounded-lg ${
                    cat.active
                      ? "bg-background-50/20 text-background-50"
                      : "bg-background-50 text-primary-700 border border-background-200/70"
                  }`}
                >
                  <i className={`${cat.icon || "ri-price-tag-3-line"} text-xl`} />
                </div>
                <div>
                  <h3
                    className={`font-heading text-lg md:text-xl font-medium ${
                      cat.active ? "text-background-50" : "text-foreground-950"
                    }`}
                  >
                    {cat.name}
                  </h3>
                  <div className="mt-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-label ${
                        cat.active ? "text-background-50/80" : "text-foreground-600"
                      }`}
                    >
                      {cat.count}
                    </span>
                    <i
                      className={`ri-arrow-right-up-line text-lg transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                        cat.active ? "text-background-50" : "text-foreground-500"
                      }`}
                    />
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
