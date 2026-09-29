import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getBlogPostBySlug, getRelatedBlogPosts } from "../data/repository";
import { authors } from "../data/blog";
import BlogPostCard from "../components/BlogPostCard";
import { Spinner, ErrorState } from "../components/ui/States";

function ArticleBody({ blocks }) {
  return (
    <div className="prose-content space-y-5">
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2
              key={i}
              className="font-heading text-2xl font-medium text-foreground-950 pt-4"
            >
              {block.text}
            </h2>
          );
        }
        return (
          <p key={i} className="text-foreground-700 leading-relaxed">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const { data: post, loading, error, reload } = useAsync(() => getBlogPostBySlug(slug), [slug]);
  const { data: related } = useAsync(
    () => (post ? getRelatedBlogPosts(post) : Promise.resolve([])),
    [post?.slug]
  );

  if (loading) return <Spinner className="pt-16 md:pt-20 min-h-[60vh]" />;
  if (error) {
    return (
      <div className="pt-16 md:pt-20">
        <ErrorState message="Couldn't load this article." onRetry={reload} />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="pt-16 md:pt-20 px-4 md:px-8 lg:px-12 py-24 text-center">
        <h1 className="font-heading text-2xl text-foreground-950 mb-2">Article not found</h1>
        <p className="text-sm text-foreground-600 mb-6">
          We couldn't find an article at this address.
        </p>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600"
        >
          Back to the blog
          <i className="ri-arrow-right-line" />
        </Link>
      </div>
    );
  }

  // Real WP author data (live mode, when the post's author isn't one of the
  // three built-in personas) takes priority; the local authors.js map covers
  // local-fixture mode and the designed team/amara/marcus personas.
  const author = post.wpAuthor?.name
    ? post.wpAuthor
    : authors[post.author] || authors.team;

  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 border-b border-background-200/70 bg-background-50">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-xs font-label text-foreground-500">
          <Link className="hover:text-foreground-800 cursor-pointer" to="/">
            Home
          </Link>
          <i className="ri-arrow-right-s-line text-xs" />
          <Link className="hover:text-foreground-800 cursor-pointer" to="/blog">
            Blog
          </Link>
          <i className="ri-arrow-right-s-line text-xs" />
          <span className="text-foreground-800 font-medium truncate">{post.title}</span>
        </div>
      </div>

      <article className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-14">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 text-xs text-foreground-600 font-label mb-5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 font-semibold">
              {post.tag}
            </span>
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>

          <h1 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight mb-8">
            {post.title}
          </h1>

          <div className="flex items-center gap-3 mb-8">
            <img
              src={author.avatar}
              alt={author.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <div className="text-sm font-semibold text-foreground-900">{author.name}</div>
              <div className="text-xs text-foreground-500 font-label">{author.role}</div>
            </div>
          </div>

          <div className="w-full h-64 md:h-96 rounded-2xl overflow-hidden mb-10 border border-background-200/70">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover object-top"
            />
          </div>

          <ArticleBody blocks={post.body} />

          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-10 pt-8 border-t border-background-200/70">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs rounded-full bg-secondary-100 text-secondary-800 font-label border border-secondary-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-background-200/70 flex items-center gap-4">
            <img
              src={author.avatar}
              alt={author.name}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0"
            />
            <div>
              <div className="text-sm font-semibold text-foreground-900">
                Written by {author.name}
              </div>
              <div className="text-xs text-foreground-500 font-label">{author.role}</div>
            </div>
          </div>
        </div>
      </article>

      {related?.length > 0 && (
        <section className="w-full px-4 md:px-8 lg:px-12 py-14 bg-background-100/50 border-t border-background-200/70">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-8">
              More from the <span className="italic text-primary-700">blog</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {related.map((p) => (
                <BlogPostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
