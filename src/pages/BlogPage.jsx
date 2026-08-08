import { useMemo, useState } from "react";
import BlogPostCard from "../components/BlogPostCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { getBlogPosts, getBlogCategories } from "../data/repository";

const PAGE_SIZE = 6;

export default function BlogPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  const { data: posts, loading, error, reload } = useAsync(() => getBlogPosts(), []);
  const { data: categories } = useAsync(() => getBlogCategories(), []);

  const filtered = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => {
      const matchesSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.excerpt?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || p.categorySlug === category;
      return matchesSearch && matchesCategory;
    });
  }, [posts, search, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20 bg-background-100/50 border-b border-background-200/70">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
            <i className="ri-book-open-line" />
            From the blog
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-light text-foreground-950 leading-tight mb-4">
            Field notes for owners, buyers &amp; <span className="italic text-primary-700">makers.</span>
          </h1>
          <p className="text-foreground-600 font-label">
            Playbooks, shop operations, uniform design, and stories from the Connect767 community.
          </p>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-10">
            <div className="flex items-center flex-wrap gap-1.5 flex-1">
              {(categories || []).map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => updateFilter(setCategory)(cat.slug)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                    category === cat.slug
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
            <div className="relative flex-shrink-0 w-full lg:w-72">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
              <input
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label"
                placeholder="Search articles..."
                type="text"
                value={search}
                onChange={(e) => updateFilter(setSearch)(e.target.value)}
              />
            </div>
          </div>

          {loading && (
            <CardSkeleton count={6} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6" />
          )}

          {error && <ErrorState message="Couldn't load blog posts." onRetry={reload} />}

          {!loading && !error && pageItems.length === 0 && (
            <EmptyState
              icon="ri-article-line"
              title="No articles match your search"
              description="Try a different keyword or category"
            />
          )}

          {!loading && !error && pageItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {pageItems.map((post) => (
                <BlogPostCard key={post.slug} post={post} />
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
