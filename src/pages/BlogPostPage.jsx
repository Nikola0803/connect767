import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getBlogPostBySlug, getRelatedBlogPosts } from "../data/repository";
import { authors } from "../data/blog";
import BlogPostCard from "../components/BlogPostCard";
import ShareMenu from "../components/ShareMenu";
import { Spinner, ErrorState } from "../components/ui/States";

function headingId(text, index) {
  const value = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return value || `section-${index + 1}`;
}

function ArticleBody({ blocks }) {
  return (
    <div className="prose-content">
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2
              key={i}
              id={headingId(block.text, i)}
              className="scroll-mt-28 mt-10 border-l-4 border-primary-500 pl-4 font-heading text-2xl font-medium leading-tight text-foreground-950 md:text-3xl"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={i} className="pt-5 font-heading text-xl font-medium text-foreground-950 md:text-2xl">
              {block.text}
            </h3>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={i} className="my-8 border-l-4 border-accent-500 bg-accent-50 px-6 py-5 font-heading text-xl italic leading-relaxed text-foreground-900 md:text-2xl">
              {block.text}
            </blockquote>
          );
        }
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type;
          return (
            <List key={i} className={`my-5 space-y-2 pl-6 text-[17px] leading-8 text-foreground-700 ${block.type === "ol" ? "list-decimal" : "list-disc"}`}>
              {(block.items || []).map((item) => <li key={item}>{item}</li>)}
            </List>
          );
        }
        if (block.type === "callout") {
          return (
            <aside key={i} className="my-8 rounded-2xl border border-primary-200 bg-primary-50/70 p-6">
              {block.title && <h3 className="mb-2 font-heading text-xl text-primary-900">{block.title}</h3>}
              <p className="text-[16px] leading-7 text-foreground-700">{block.text}</p>
            </aside>
          );
        }
        if (block.type === "image" && block.src) {
          return (
            <figure key={i} className="my-9">
              <img src={block.src} alt={block.alt || ""} className="w-full rounded-2xl object-cover" />
              {block.caption && <figcaption className="mt-2 text-center text-xs text-foreground-500 font-label">{block.caption}</figcaption>}
            </figure>
          );
        }
        if (block.type === "html") {
          return (
            <div
              key={i}
              className="my-5 text-[17px] leading-8 text-foreground-700 [&_a]:font-medium [&_a]:text-primary-700 [&_a]:underline [&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-accent-500 [&_blockquote]:pl-6 [&_h2]:scroll-mt-28 [&_h2]:mt-10 [&_h2]:border-l-4 [&_h2]:border-primary-500 [&_h2]:pl-4 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:font-medium [&_h2]:text-foreground-950 [&_h3]:pt-5 [&_h3]:font-heading [&_h3]:text-2xl [&_h3]:text-foreground-950 [&_img]:my-8 [&_img]:w-full [&_img]:rounded-2xl [&_li]:mb-2 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        return (
          <p key={i} className="my-5 text-[17px] leading-8 text-foreground-700 md:text-lg md:leading-8">
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
  const [progress, setProgress] = useState(0);
  const [savedArticles, setSavedArticles] = useState(() => {
    try {
      const stored = localStorage.getItem("c767_saved_blog_articles");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const updateProgress = () => {
      const article = document.querySelector("[data-blog-article]");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const distance = Math.max(1, article.offsetHeight - window.innerHeight);
      setProgress(Math.max(0, Math.min(100, ((-rect.top + 120) / distance) * 100)));
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [post?.slug]);

  const contents = useMemo(
    () => (post?.body || []).map((block, index) => ({ ...block, index })).filter((block) => block.type === "h2"),
    [post?.body]
  );

  const saved = savedArticles.includes(slug);
  const toggleSaved = () => {
    setSavedArticles((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug];
      try {
        localStorage.setItem("c767_saved_blog_articles", JSON.stringify(next));
      } catch {
        // Saving remains available for this session when storage is blocked.
      }
      return next;
    });
  };

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
      <div className="fixed left-0 right-0 top-16 z-40 h-1 bg-transparent md:top-20" aria-hidden="true">
        <div className="h-full bg-accent-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
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

      <article data-blog-article className="w-full px-4 py-10 md:px-8 md:py-14 lg:px-12">
        <div className="mx-auto max-w-[860px] overflow-hidden rounded-[28px] border border-t-[6px] border-primary-200 border-t-primary-500 bg-background-50 shadow-[0_24px_70px_rgba(65,48,31,0.10)]">
          <div className="flex items-center justify-between gap-4 border-b border-primary-100 bg-gradient-to-r from-primary-50 via-background-50 to-secondary-50 px-5 py-4 sm:px-8">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">
              <i className="ri-quill-pen-line text-base" />
              Connect767 stories
            </span>
            <span className="hidden h-2 w-2 rounded-full bg-accent-500 sm:block" aria-hidden="true" />
          </div>
          <div className="mx-auto max-w-[720px] px-5 py-8 sm:px-8 md:px-0 md:py-12">
          <div className="flex items-center gap-3 text-xs text-foreground-600 font-label mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1.5 font-semibold text-white shadow-[0_8px_20px_rgba(31,112,78,0.20)]">
              <i className="ri-article-line" />
              {post.tag}
            </span>
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>

          <h1 className="font-heading text-3xl md:text-5xl font-light text-foreground-950 leading-tight mb-8">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mb-8 border-l-2 border-primary-400 pl-5 font-heading text-xl leading-8 text-foreground-700 md:text-2xl md:leading-9">
              {post.excerpt}
            </p>
          )}

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

          {contents.length > 1 && (
            <nav aria-label="Article contents" className="mb-10 overflow-hidden rounded-2xl border border-secondary-200 bg-background-50 shadow-[0_18px_48px_rgba(83,55,35,0.08)]">
              <div className="border-b border-secondary-200 bg-gradient-to-r from-secondary-100/80 via-background-50 to-primary-50/80 px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">Article navigation</p>
                <h2 className="mt-1 font-heading text-xl font-medium text-foreground-950">In this article</h2>
              </div>
              <ol className="grid gap-3 p-5 sm:grid-cols-2">
                {contents.map((item, index) => (
                  <li key={`${item.text}-${item.index}`}>
                    <a href={`#${headingId(item.text, item.index)}`} className={`group flex h-full items-start gap-3 rounded-2xl border border-t-4 p-4 text-sm leading-6 transition hover:-translate-y-0.5 ${index % 2 === 0 ? "border-primary-200 border-t-primary-500 bg-gradient-to-br from-primary-50 to-background-50 hover:shadow-[0_12px_28px_rgba(31,112,78,0.14)]" : "border-secondary-200 border-t-secondary-500 bg-gradient-to-br from-secondary-50 to-background-50 hover:shadow-[0_12px_28px_rgba(153,119,72,0.14)]"}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-heading ${index % 2 === 0 ? "bg-primary-100 text-primary-800" : "bg-secondary-100 text-secondary-800"}`}>{String(index + 1).padStart(2, "0")}</span>
                      <span className="pt-1 font-semibold text-foreground-800 group-hover:text-primary-800">{item.text}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

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

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-t-4 border-primary-200 border-t-primary-500 bg-gradient-to-br from-primary-50 to-background-50 p-5 shadow-sm">
            <div>
              <p className="font-heading text-lg text-foreground-950">Worth sharing?</p>
              <p className="text-xs text-foreground-500 font-label">Send this article to someone who may find it useful.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSaved}
                aria-pressed={saved}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${saved ? "border-accent-300 bg-accent-50 text-accent-700" : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"}`}
              >
                <i className={saved ? "ri-heart-fill" : "ri-heart-line"} />
                <span>{saved ? "Saved" : "Save"}</span>
              </button>
              <ShareMenu title={post.title} />
            </div>
          </div>

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
