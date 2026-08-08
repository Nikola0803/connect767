import { Link } from "react-router-dom";
import BlogPostCard from "./BlogPostCard";
import { CardSkeleton, ErrorState } from "./ui/States";
import { useAsync } from "../hooks/useAsync";
import { getBlogPosts } from "../data/repository";

export default function Blog() {
  const { data: blogPosts, loading, error, reload } = useAsync(() => getBlogPosts(), []);
  const featured = (blogPosts || []).slice(0, 3);

  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-14">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-medium mb-4">
              <i className="ri-book-open-line" />
              From the blog
            </div>
            <h4 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight max-w-2xl">
              <Link className="hover:text-primary-700 cursor-pointer" to="/blog">
                Field notes for owners, buyers &amp; <span className="italic">makers.</span>
              </Link>
            </h4>
          </div>
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
            to="/blog"
          >
            All articles
            <i className="ri-arrow-right-line" />
          </Link>
        </div>

        {loading && (
          <CardSkeleton count={3} className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6" />
        )}

        {error && <ErrorState message="Couldn't load blog posts." onRetry={reload} />}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {featured.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
