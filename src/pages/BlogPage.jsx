import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BlogPostCard from "../components/BlogPostCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { getBlogPosts, getBlogCategories } from "../data/repository";

const PAGE_SIZE = 7;

const isUncategorized = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-") === "uncategorized";

export default function BlogPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  const { data: posts, loading, error, reload } = useAsync(() => getBlogPosts(), []);
  const { data: categories } = useAsync(() => getBlogCategories(), []);

  const visibleCategories = useMemo(
    () =>
      (categories || []).filter(
        (item) => !isUncategorized(item.slug) && !isUncategorized(item.label),
      ),
    [categories],
  );

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
  const featuredPost = pageItems[0];
  const remainingPosts = pageItems.slice(1);
  const featuredHasCategory =
    featuredPost &&
    !isUncategorized(featuredPost.categorySlug) &&
    !isUncategorized(featuredPost.tag);

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="pt-16 md:pt-20">
      <section className="relative overflow-hidden border-b border-background-200/70 bg-[radial-gradient(circle_at_82%_18%,rgba(125,197,157,0.28),transparent_32%),linear-gradient(135deg,#fbf8f1_0%,#f6f2e9_58%,#edf7f0_100%)] px-4 py-16 md:px-8 md:py-24 lg:px-12">
        <div className="pointer-events-none absolute -left-20 top-12 h-56 w-56 rounded-full border border-primary-200/50" />
        <div className="pointer-events-none absolute -left-8 top-24 h-36 w-36 rounded-full border border-primary-200/40" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-background-50/85 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-800 shadow-sm backdrop-blur">
            <i className="ri-book-open-line" />
            The Connect767 Journal
          </div>
          <h1 className="mx-auto mb-5 max-w-4xl font-heading text-4xl font-medium leading-[1.08] text-foreground-950 sm:text-5xl md:text-6xl">
            Insights, Ideas &amp; <span className="italic text-primary-700">Opportunities</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-foreground-600 md:text-lg">
            Practical guidance, business intelligence, and community stories for Dominicans at home and abroad.
          </p>
        </div>
      </section>

      <main className="w-full px-4 py-10 md:px-8 md:py-14 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 rounded-3xl border border-background-200/80 bg-background-50/95 p-4 shadow-[0_16px_45px_rgba(55,44,28,0.05)] md:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary-700">
                  Explore the journal
                </p>
                <h2 className="font-heading text-2xl font-medium text-foreground-950">
                  Find your next useful read
                </h2>
              </div>
              {!loading && !error && (
                <p className="text-sm text-foreground-500">
                  {filtered.length} {filtered.length === 1 ? "article" : "articles"}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-4 border-t border-background-200/70 pt-4 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => updateFilter(setCategory)(cat.slug)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                    category === cat.slug
                      ? "border-primary-600 bg-primary-600 text-background-50 shadow-sm"
                      : "border-background-200/80 bg-background-50 text-foreground-700 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
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
            <div className="relative w-full flex-shrink-0 lg:w-80">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
              <input
                className="w-full rounded-xl border border-background-300 bg-background-50 py-3 pl-10 pr-10 text-sm text-foreground-950 placeholder-foreground-400 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100/60"
                placeholder="Search articles..."
                type="text"
                value={search}
                onChange={(e) => updateFilter(setSearch)(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear article search"
                  onClick={() => updateFilter(setSearch)("")}
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-foreground-500 transition hover:bg-background-100 hover:text-foreground-900"
                >
                  <i className="ri-close-line" />
                </button>
              )}
            </div>
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

          {!loading && !error && featuredPost && (
            <>
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group grid overflow-hidden rounded-[2rem] border border-t-4 border-primary-200 border-t-primary-600 bg-gradient-to-br from-background-50 via-background-50 to-primary-50/70 shadow-[0_24px_70px_rgba(8,68,45,0.09)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(31,112,78,0.15)] md:grid-cols-[1.1fr_0.9fr]"
              >
                <div className="relative h-72 overflow-hidden md:h-[460px]">
                  <img
                    src={featuredPost.image}
                    alt={featuredPost.title}
                    className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-foreground-950/25 to-transparent md:hidden" />
                </div>
                <div className="flex flex-col justify-center p-7 sm:p-9 md:p-10 lg:p-12">
                  <div className="mb-5 flex flex-wrap items-center gap-2.5 text-xs text-foreground-600">
                    {featuredHasCategory && (
                    <span className="rounded-full bg-primary-50 px-2.5 py-1 font-semibold text-primary-800">
                      {featuredPost.tag}
                    </span>
                    )}
                    <span>{featuredPost.date}</span>
                    <span aria-hidden="true">·</span>
                    <span>{featuredPost.readTime}</span>
                  </div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-primary-700">
                    Editor&apos;s pick
                  </p>
                  <h2 className="mb-5 font-heading text-3xl font-medium leading-[1.12] text-foreground-950 transition-colors group-hover:text-primary-700 md:text-4xl lg:text-[2.65rem]">
                    {featuredPost.title}
                  </h2>
                  <p className="mb-7 text-base leading-7 text-foreground-600">
                    {featuredPost.excerpt}
                  </p>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-background-50 px-4 py-2.5 text-sm font-semibold text-primary-800 transition group-hover:border-primary-400 group-hover:bg-primary-50">
                    Read the story
                    <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>

              {remainingPosts.length > 0 && (
                <section className="mt-14">
                  <div className="mb-6 flex items-end justify-between gap-4 border-b border-background-200/80 pb-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary-700">
                        Latest perspectives
                      </p>
                      <h2 className="font-heading text-3xl font-medium text-foreground-950">
                        More from Connect767
                      </h2>
                    </div>
                    <i className="ri-arrow-down-line hidden text-2xl text-primary-500 sm:block" />
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {remainingPosts.map((post) => (
                      <BlogPostCard key={post.slug} post={post} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {totalPages > 1 && (
            <div className="mt-12 border-t border-background-200/80 pt-8">
              <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
                <button
                  aria-label="Previous page"
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-background-200 text-foreground-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <i className="ri-arrow-left-s-line text-sm" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-xs font-semibold transition-colors ${
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
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-background-200 text-foreground-600 transition hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <i className="ri-arrow-right-s-line text-sm" />
                </button>
              </nav>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
