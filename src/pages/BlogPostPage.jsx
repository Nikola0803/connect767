import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getBlogPostBySlug, getRelatedBlogPosts } from "../data/repository";
import { authors } from "../data/blog";
import BlogPostCard from "../components/BlogPostCard";
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
              className="scroll-mt-28 pt-8 font-heading text-2xl font-medium leading-tight text-foreground-950 md:text-3xl"
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
              className="my-5 text-[17px] leading-8 text-foreground-700 [&_a]:font-medium [&_a]:text-primary-700 [&_a]:underline [&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-accent-500 [&_blockquote]:pl-6 [&_h2]:scroll-mt-28 [&_h2]:pt-8 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:font-medium [&_h2]:text-foreground-950 [&_h3]:pt-5 [&_h3]:font-heading [&_h3]:text-2xl [&_h3]:text-foreground-950 [&_img]:my-8 [&_img]:w-full [&_img]:rounded-2xl [&_li]:mb-2 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6"
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
  const [copied, setCopied] = useState(false);

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

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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

      <article data-blog-article className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-14">
        <div className="mx-auto max-w-[720px]">
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
            <nav aria-label="Article contents" className="mb-10 rounded-2xl border border-background-200/70 bg-background-100/70 p-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">In this article</p>
              <ol className="space-y-2">
                {contents.map((item, index) => (
                  <li key={`${item.text}-${item.index}`}>
                    <a href={`#${headingId(item.text, item.index)}`} className="group flex items-start gap-3 text-sm leading-6 text-foreground-700 hover:text-primary-700">
                      <span className="font-heading text-primary-500">{String(index + 1).padStart(2, "0")}</span>
                      <span className="border-b border-transparent group-hover:border-primary-300">{item.text}</span>
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

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-background-200/70 bg-background-100/60 p-5">
            <div>
              <p className="font-heading text-lg text-foreground-950">Worth sharing?</p>
              <p className="text-xs text-foreground-500 font-label">Send this article to someone who may find it useful.</p>
            </div>
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-full border border-primary-300 bg-background-50 px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50">
              <i className={copied ? "ri-check-line" : "ri-link"} />
              {copied ? "Link copied" : "Copy link"}
            </button>
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
