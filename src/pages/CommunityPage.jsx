import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import {
  createCommunityComment,
  createCommunityPost,
  getCommunityPosts,
  getMyListings,
  toggleCommunityReaction,
} from "../data/repository";

const POST_TYPES = [
  { value: "status", label: "Update", icon: "ri-chat-3-line" },
  { value: "offer", label: "Offer", icon: "ri-coupon-3-line" },
  { value: "event", label: "Event", icon: "ri-calendar-event-line" },
  { value: "opportunity", label: "Opportunity", icon: "ri-briefcase-4-line" },
];

export const COMMUNITY_EMOTIONS = [
  { value: "excited", label: "Excited", emoji: "😃" },
  { value: "grateful", label: "Grateful", emoji: "🙏" },
  { value: "celebrating", label: "Celebrating", emoji: "🎉" },
  { value: "inspired", label: "Inspired", emoji: "✨" },
  { value: "proud", label: "Proud", emoji: "💚" },
  { value: "focused", label: "Focused", emoji: "🎯" },
];

function initials(value = "Business") {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function relativeTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function CommunityPost({ post, authenticated, onReact, onComment }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const comments = post.comments || [];
  const emotion = COMMUNITY_EMOTIONS.find((item) => item.value === post.emotion);

  const submitComment = async (event) => {
    event.preventDefault();
    const clean = comment.trim();
    if (!clean) return;
    await onComment(post.id, clean);
    setComment("");
    setCommentsOpen(true);
  };

  return (
    <article className="rounded-[1.5rem] border border-background-200/80 bg-background-50 p-5 shadow-[0_14px_45px_rgba(24,48,36,0.06)] sm:p-6">
      <header className="flex items-start gap-3">
        {post.listingLogo ? (
          <img src={post.listingLogo} alt="" className="h-12 w-12 rounded-2xl border border-background-200 object-cover" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-700 text-xs font-bold text-white">{initials(post.listingTitle)}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/listings/${post.listingSlug}`} className="font-heading text-xl font-semibold text-foreground-950 hover:text-primary-700">{post.listingTitle}</Link>
            {post.verified && <i className="ri-verified-badge-fill text-primary-600" aria-label="Verified listing" />}
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700">{post.industry || "Business"}</span>
          </div>
          <p className="mt-1 text-xs text-foreground-500">{post.location || "Connect767 community"} · {relativeTime(post.createdAt)}</p>
        </div>
        <button type="button" aria-label="More options" className="grid h-9 w-9 place-items-center rounded-full text-foreground-400 hover:bg-background-100"><i className="ri-more-2-fill" /></button>
      </header>

      {emotion && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-semibold text-foreground-700"><span className="text-base" aria-hidden="true">{emotion.emoji}</span>Feeling {emotion.label.toLowerCase()}</div>}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground-800">{post.text}</p>
      {post.mediaUrl && <img src={post.mediaUrl} alt={`Update from ${post.listingTitle}`} className="mt-4 max-h-[32rem] w-full rounded-2xl border border-background-200 object-cover" />}
      {post.type !== "status" && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-200 bg-accent-50/60 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500 text-white"><i className={POST_TYPES.find((type) => type.value === post.type)?.icon || "ri-megaphone-line"} /></span>
          <div><p className="text-sm font-bold text-foreground-900">{POST_TYPES.find((type) => type.value === post.type)?.label}</p><p className="text-xs text-foreground-500">Open the business profile for details.</p></div>
          <Link to={`/listings/${post.listingSlug}`} className="ml-auto text-xs font-bold text-primary-700">View profile <i className="ri-arrow-right-up-line" /></Link>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-b border-background-200 pb-3 text-xs text-foreground-500">
        <span>{post.reactionCount || 0} appreciations</span>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)}>{comments.length} comment{comments.length === 1 ? "" : "s"}</button>
      </div>
      <div className="flex items-center gap-1 pt-2">
        <button type="button" disabled={!authenticated} onClick={() => onReact(post.id)} className={`inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold ${post.reacted ? "bg-primary-50 text-primary-700" : "text-foreground-600 hover:bg-background-100"}`}><i className={post.reacted ? "ri-heart-3-fill" : "ri-heart-3-line"} />Appreciate</button>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-foreground-600 hover:bg-background-100"><i className="ri-chat-3-line" />Comment</button>
        <button type="button" onClick={() => navigator.share?.({ title: post.listingTitle, url: `${window.location.origin}/listings/${post.listingSlug}` })} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-foreground-600 hover:bg-background-100"><i className="ri-share-forward-line" />Share</button>
        <Link to={`/listings/${post.listingSlug}`} className="ml-auto hidden text-xs font-bold text-primary-700 sm:inline-flex">View profile <i className="ri-arrow-right-up-line ml-1" /></Link>
      </div>

      {commentsOpen && (
        <div className="mt-3 border-t border-background-200 pt-4">
          <div className="space-y-3">
            {comments.map((item) => <div key={item.id} className="rounded-xl bg-background-100 px-3 py-2"><p className="text-xs font-bold text-foreground-900">{item.name}</p><p className="mt-1 text-sm text-foreground-700">{item.text}</p></div>)}
          </div>
          {authenticated ? (
            <form onSubmit={submitComment} className="mt-3 flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={600} className="h-10 min-w-0 flex-1 rounded-xl border border-background-300 bg-white px-3 text-sm outline-none focus:border-primary-500" placeholder="Add a helpful comment…" /><button className="h-10 rounded-xl bg-primary-700 px-4 text-xs font-bold text-white" type="submit">Reply</button></form>
          ) : <Link to="/auth/login" className="mt-3 inline-flex text-xs font-bold text-primary-700">Sign in to join the conversation</Link>}
        </div>
      )}
    </article>
  );
}

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const { data, loading, error, reload } = useAsync(getCommunityPosts, []);
  const [posts, setPosts] = useState([]);
  const [listings, setListings] = useState([]);
  const [listingId, setListingId] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState("status");
  const [emotion, setEmotion] = useState("");
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { if (data?.posts) setPosts(data.posts); }, [data]);
  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return undefined;
    }
    const preview = URL.createObjectURL(image);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [image]);
  useEffect(() => {
    if (!isAuthenticated) return;
    getMyListings().then((items) => {
      const published = (items || []).filter((item) => item.status === "publish" || item.status === "published" || !item.status);
      setListings(published);
      setListingId(String(published[0]?.id || ""));
    }).catch(() => setListings([]));
  }, [isAuthenticated]);

  const selectedListing = useMemo(() => listings.find((item) => String(item.id) === listingId), [listings, listingId]);
  const selectedEmotion = COMMUNITY_EMOTIONS.find((item) => item.value === emotion);
  const selectImage = (event) => {
    const nextImage = event.target.files?.[0];
    if (!nextImage) return;
    if (!nextImage.type.startsWith("image/")) {
      setMessage("Choose a JPG, PNG, WebP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (nextImage.size > 5 * 1024 * 1024) {
      setMessage("Community images must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setMessage("");
    setImage(nextImage);
  };
  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const submitPost = async (event) => {
    event.preventDefault();
    if (!text.trim() || !listingId) return;
    setSubmitting(true);
    setMessage("");
    try {
      const created = await createCommunityPost({ listingId: Number(listingId), text: text.trim(), type, emotion, image, listingSlug: selectedListing?.slug, listingTitle: selectedListing?.title });
      setPosts((current) => [created, ...current]);
      setText("");
      setType("status");
      setEmotion("");
      setEmotionOpen(false);
      removeImage();
    } catch (postError) {
      setMessage(postError.message || "Your update could not be published.");
    } finally { setSubmitting(false); }
  };
  const react = async (postId) => {
    const current = posts.find((post) => post.id === postId);
    setPosts((items) => items.map((post) => post.id === postId ? { ...post, reacted: !post.reacted, reactionCount: Math.max(0, (post.reactionCount || 0) + (post.reacted ? -1 : 1)) } : post));
    try {
      const result = await toggleCommunityReaction(postId);
      if (result) setPosts((items) => items.map((post) => post.id === postId ? { ...post, reacted: result.reacted, reactionCount: result.count } : post));
    } catch { setPosts((items) => items.map((post) => post.id === postId ? current : post)); }
  };
  const comment = async (postId, value) => {
    const created = await createCommunityComment(postId, value);
    setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), created] } : post));
  };

  return (
    <div className="min-h-screen bg-background-100/45 pb-20 pt-24 md:pt-28">
      <section className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-col gap-5 border-b border-background-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Connect · Share · Grow</p><h1 className="mt-2 font-heading text-4xl font-light text-foreground-950 md:text-5xl">Business <span className="italic text-accent-500">community</span></h1><p className="mt-3 max-w-2xl text-sm text-foreground-600">Updates, offers and conversations from businesses across Dominica and abroad.</p></div>
          <div className="inline-flex rounded-full border border-background-300 bg-background-50 p-1 text-xs font-bold"><span className="rounded-full bg-primary-700 px-4 py-2 text-white">For you</span><span className="px-4 py-2 text-foreground-500">Following</span><span className="px-4 py-2 text-foreground-500">Nearby</span></div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <main className="space-y-4">
            <section className="rounded-[1.5rem] border border-background-200/80 bg-background-50 p-5 shadow-[0_14px_45px_rgba(24,48,36,0.06)]">
              {isAuthenticated && listings.length ? (
                <form onSubmit={submitPost}>
                  <div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-700 text-xs font-bold text-white">{initials(selectedListing?.title)}</span><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1200} rows={3} className="min-h-24 flex-1 resize-none rounded-2xl border border-background-300 bg-white p-3 text-sm outline-none focus:border-primary-500" placeholder={`Share an update from ${selectedListing?.title || "your business"}…`} /></div>
                  {imagePreview && <div className="relative ml-14 mt-3 overflow-hidden rounded-2xl border border-background-200 bg-background-100"><img src={imagePreview} alt="Attachment preview" className="max-h-72 w-full object-cover" /><button type="button" onClick={removeImage} aria-label="Remove attached image" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white shadow-lg"><i className="ri-close-line text-lg" /></button><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-xs font-semibold text-white"><i className="ri-image-line mr-1.5" />{image.name}</div></div>}
                  {emotionOpen && <div className="ml-14 mt-3 flex flex-wrap gap-2 rounded-2xl border border-background-200 bg-background-100 p-3" role="group" aria-label="Choose an emotion">{COMMUNITY_EMOTIONS.map((item) => <button key={item.value} type="button" onClick={() => { setEmotion(item.value); setEmotionOpen(false); }} className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${emotion === item.value ? "border-primary-500 bg-primary-50 text-primary-800" : "border-background-300 bg-white text-foreground-700 hover:border-primary-300"}`}><span className="text-base" aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-background-200 pt-3">
                    <select aria-label="Business profile" value={listingId} onChange={(event) => setListingId(event.target.value)} className="h-10 max-w-52 rounded-xl border border-background-300 bg-white px-3 text-xs font-semibold">{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                    {POST_TYPES.map((option) => <button key={option.value} type="button" onClick={() => setType(option.value)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${type === option.value ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><i className={option.icon} />{option.label}</button>)}
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} className="sr-only" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${image ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><i className="ri-image-add-line" />{image ? "Photo added" : "Photo"}</button>
                    <button type="button" onClick={() => setEmotionOpen((open) => !open)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${emotion ? "bg-accent-50 text-foreground-800" : "text-foreground-500 hover:bg-background-100"}`}><span className="text-base" aria-hidden="true">{selectedEmotion?.emoji || "😊"}</span>{selectedEmotion?.label || "Emotion"}</button>
                    <button type="submit" disabled={submitting || !text.trim()} className="ml-auto h-10 rounded-xl bg-primary-700 px-5 text-xs font-bold text-white disabled:opacity-40">{submitting ? "Posting…" : "Post update"}</button>
                  </div>
                  {message && <p role="alert" className="mt-3 text-xs text-red-600">{message}</p>}
                </form>
              ) : isAuthenticated ? <div className="text-sm text-foreground-600">Publish a directory listing before posting to the community. <Link to="/listings/submit" className="font-bold text-primary-700">Create your listing</Link></div> : <div className="flex items-center justify-between gap-4"><p className="text-sm text-foreground-600">Sign in as a listing owner to share business updates.</p><Link to="/auth/login" className="shrink-0 rounded-xl bg-primary-700 px-4 py-2.5 text-xs font-bold text-white">Sign in</Link></div>}
            </section>

            {loading && !posts.length && <div className="py-16 text-center text-sm text-foreground-500">Loading community updates…</div>}
            {error && !posts.length && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">The community feed could not load. <button onClick={reload} className="font-bold underline">Try again</button></div>}
            {posts.map((post) => <CommunityPost key={post.id} post={post} authenticated={isAuthenticated} onReact={react} onComment={comment} />)}
          </main>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-background-200 bg-background-50 p-5"><h2 className="font-heading text-xl font-semibold">Trending conversations</h2><div className="mt-4 divide-y divide-background-200">{[["#ShopLocal767", "38 updates"], ["Holiday services", "24 offers"], ["Small-business tips", "17 conversations"]].map(([label, detail], index) => <div key={label} className="flex gap-3 py-3"><span className="font-heading text-lg text-accent-500">0{index + 1}</span><div><p className="text-xs font-bold text-foreground-900">{label}</p><p className="mt-1 text-[10px] text-foreground-500">{detail}</p></div></div>)}</div></section>
            <section className="rounded-[1.5rem] border border-background-200 bg-background-50 p-5"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-shield-check-line" /></span><div><h2 className="text-sm font-bold">Business-first by design</h2><p className="mt-2 text-xs leading-5 text-foreground-500">Every update is connected to a published listing. Reporting, moderation and posting limits help reduce spam.</p></div></div></section>
          </aside>
        </div>
      </section>
    </div>
  );
}
