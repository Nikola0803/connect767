import { Link } from "react-router-dom";

export default function BlogPostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block bg-background-100/60 rounded-2xl border border-background-200/70 overflow-hidden hover:border-primary-300 transition-colors cursor-pointer"
    >
      <div className="w-full h-52 overflow-hidden">
        <img
          alt={`${post.title} — ${post.tag}`}
          title={`${post.title} — ${post.tag}`}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          src={post.image}
        />
      </div>
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-xs text-foreground-600 font-label mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-900 font-semibold">
            {post.tag}
          </span>
          <span>{post.date}</span>
          <span>·</span>
          <span>{post.readTime}</span>
        </div>
        <h3 className="font-heading text-xl font-medium text-foreground-950 leading-snug mb-3 group-hover:text-primary-700 transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-foreground-600 leading-relaxed mb-4 line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary-700 group-hover:text-primary-800 whitespace-nowrap">
          Read article
          <i className="ri-arrow-right-line" />
        </span>
      </div>
    </Link>
  );
}
