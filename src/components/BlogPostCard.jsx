import { Link } from "react-router-dom";

export default function BlogPostCard({ post }) {
  const normalizedCategory = String(post.categorySlug || post.tag || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  const showCategory = normalizedCategory !== "uncategorized";

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-t-4 border-primary-200 border-t-primary-500 bg-gradient-to-br from-background-50 to-background-100/55 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(31,112,78,0.14)]"
    >
      <div className="h-52 w-full overflow-hidden">
        <img
          loading="lazy"
          decoding="async"
          alt={`${post.title} — ${post.tag}`}
          title={`${post.title} — ${post.tag}`}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          src={post.image}
        />
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-foreground-600 font-label">
          {showCategory && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-800">
            {post.tag}
          </span>
          )}
          <span>{post.date}</span>
          <span>·</span>
          <span>{post.readTime}</span>
        </div>
        <h3 className="mb-3 font-heading text-xl font-medium leading-snug text-foreground-950 transition-colors group-hover:text-primary-700">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-foreground-600">
            {post.excerpt}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary-700 group-hover:text-primary-800">
          Read article
          <i className="ri-arrow-right-line" />
        </span>
      </div>
    </Link>
  );
}
