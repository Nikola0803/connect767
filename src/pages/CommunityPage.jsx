import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ShareMenu from "../components/ShareMenu";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { isLegacyCoordinateLabel, reverseGeocodeLocation } from "../lib/reverseGeocode";
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPosts,
  getListings,
  getMyListings,
  reportCommunityPost,
  toggleCommunityBookmark,
  toggleCommunityFollow,
  toggleCommunityReaction,
  toggleCommunityRepost,
  updateCommunityPost,
} from "../data/repository";

const POST_TYPES = [
  { value: "status", label: "Update", icon: "ri-chat-3-line", description: "Share business news, progress, or a quick announcement.", placeholder: "Share a business update…", action: "Post update" },
  { value: "offer", label: "Offer", icon: "ri-coupon-3-line", description: "Promote a special price, service, product, or limited-time deal.", placeholder: "Describe your offer, price, and how customers can claim it…", action: "Post offer" },
  { value: "event", label: "Event", icon: "ri-calendar-event-line", description: "Announce an upcoming activity and include the date, time, and location.", placeholder: "Share the event date, time, location, and attendance details…", action: "Post event" },
  { value: "opportunity", label: "Opportunity", icon: "ri-briefcase-4-line", description: "Share a job, partnership, contract, or collaboration opportunity.", placeholder: "Describe the opportunity, requirements, and how to respond…", action: "Post opportunity" },
];

export const COMMUNITY_REACTIONS = [
  { value: "like", label: "Like", emoji: "👍" },
  { value: "dislike", label: "Dislike", emoji: "👎" },
  { value: "love", label: "Love", emoji: "❤️" },
  { value: "care", label: "Care", emoji: "🫶" },
  { value: "celebrate", label: "Celebrate", emoji: "🎉" },
  { value: "support", label: "Support", emoji: "🤝" },
  { value: "insightful", label: "Insightful", emoji: "💡" },
  { value: "curious", label: "Curious", emoji: "🤔" },
  { value: "funny", label: "Funny", emoji: "😂" },
  { value: "wow", label: "Wow", emoji: "😮" },
  { value: "sad", label: "Sad", emoji: "😢" },
  { value: "angry", label: "Angry", emoji: "😡" },
  { value: "fire", label: "Fire", emoji: "🔥" },
  { value: "applause", label: "Applause", emoji: "👏" },
  { value: "thanks", label: "Thanks", emoji: "🙏" },
  { value: "hundred", label: "One hundred", emoji: "💯" },
  { value: "eyes", label: "Watching", emoji: "👀" },
  { value: "rocket", label: "Boost", emoji: "🚀" },
  { value: "star", label: "Star", emoji: "⭐" },
];

export const COMMUNITY_EMOTIONS = [
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "loved", label: "Loved", emoji: "🥰" },
  { value: "excited", label: "Excited", emoji: "😃" },
  { value: "grateful", label: "Grateful", emoji: "🙏" },
  { value: "celebrating", label: "Celebrating", emoji: "🎉" },
  { value: "inspired", label: "Inspired", emoji: "✨" },
  { value: "proud", label: "Proud", emoji: "💚" },
  { value: "focused", label: "Focused", emoji: "🎯" },
  { value: "optimistic", label: "Optimistic", emoji: "☀️" },
  { value: "supportive", label: "Supportive", emoji: "🤝" },
  { value: "curious", label: "Curious", emoji: "🤔" },
  { value: "motivated", label: "Motivated", emoji: "🚀" },
  { value: "surprised", label: "Surprised", emoji: "😮" },
  { value: "thoughtful", label: "Thoughtful", emoji: "💭" },
  { value: "confident", label: "Confident", emoji: "💪" },
  { value: "energized", label: "Energized", emoji: "⚡" },
  { value: "amused", label: "Amused", emoji: "😂" },
  { value: "relieved", label: "Relieved", emoji: "😌" },
  { value: "hopeful", label: "Hopeful", emoji: "🌈" },
  { value: "determined", label: "Determined", emoji: "🔥" },
  { value: "calm", label: "Calm", emoji: "🧘" },
  { value: "creative", label: "Creative", emoji: "🎨" },
  { value: "accomplished", label: "Accomplished", emoji: "🏆" },
  { value: "thankful", label: "Thankful", emoji: "🙌" },
  { value: "blessed", label: "Blessed", emoji: "😇" },
  { value: "friendly", label: "Friendly", emoji: "👋" },
  { value: "impressed", label: "Impressed", emoji: "🤩" },
  { value: "interested", label: "Interested", emoji: "👀" },
  { value: "encouraged", label: "Encouraged", emoji: "🌱" },
  { value: "connected", label: "Connected", emoji: "🌐" },
  { value: "generous", label: "Generous", emoji: "🎁" },
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "busy", label: "Busy", emoji: "🐝" },
  { value: "productive", label: "Productive", emoji: "✅" },
  { value: "concerned", label: "Concerned", emoji: "😟" },
  { value: "disappointed", label: "Disappointed", emoji: "😞" },
  { value: "sad", label: "Sad", emoji: "😢" },
  { value: "frustrated", label: "Frustrated", emoji: "😤" },
  { value: "tired", label: "Tired", emoji: "😴" },
  { value: "confused", label: "Confused", emoji: "😕" },
];

export const COMMUNITY_ACTIVITIES = [
  { value: "working", label: "Working", emoji: "💻" },
  { value: "hiring", label: "Hiring", emoji: "📣" },
  { value: "networking", label: "Networking", emoji: "🤝" },
  { value: "learning", label: "Learning", emoji: "📚" },
  { value: "traveling", label: "Traveling", emoji: "✈️" },
  { value: "shopping", label: "Shopping", emoji: "🛍️" },
  { value: "eating", label: "Eating", emoji: "🍽️" },
  { value: "attending", label: "Attending an event", emoji: "🎟️" },
  { value: "hosting", label: "Hosting", emoji: "🎤" },
  { value: "launching", label: "Launching something", emoji: "🚀" },
  { value: "selling", label: "Selling", emoji: "🏷️" },
  { value: "volunteering", label: "Volunteering", emoji: "🙋" },
  { value: "exercising", label: "Exercising", emoji: "🏃" },
  { value: "creating", label: "Creating", emoji: "🎨" },
  { value: "planning", label: "Planning", emoji: "🗓️" },
  { value: "collaborating", label: "Collaborating", emoji: "👥" },
  { value: "meeting", label: "In a meeting", emoji: "🗣️" },
  { value: "delivering", label: "Making deliveries", emoji: "🚚" },
  { value: "exploring", label: "Exploring", emoji: "🧭" },
  { value: "celebrating-activity", label: "Celebrating", emoji: "🥳" },
];

function initials(value = "Business") {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function listingAvatar(listing) {
  return listing?.logo || listing?.coverPhoto || listing?.image || "";
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

function linkLabel(value = "") {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function mapUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function readStoredIds(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeStoredIds(key, ids) {
  try { localStorage.setItem(key, JSON.stringify([...ids])); } catch { /* storage unavailable */ }
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

const REPORT_REASONS = [
  ["spam", "Spam or repetitive content"],
  ["misleading", "False or misleading information"],
  ["harassment", "Harassment or abusive content"],
  ["inappropriate", "Inappropriate content"],
  ["other", "Something else"],
];

function PostOptionsMenu({ post, authenticated, canManage, onDelete, onEdit, onHide, onMute, onReport, onBookmark, onFollow }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.text || "");
  const [reportOpen, setReportOpen] = useState(false);
  const [saved, setSaved] = useState(Boolean(post.bookmarked));
  const [notice, setNotice] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const toggleSaved = async () => {
    if (!authenticated) return;
    const result = await onBookmark(post.id);
    setSaved(Boolean(result.bookmarked));
    setOpen(false);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/community#community-post-${post.id}`;
    setNotice(await copyText(url) ? "Link copied" : "Copy the link from your browser");
    setOpen(false);
    setTimeout(() => setNotice(""), 2500);
  };

  const deletePost = async () => {
    if (!window.confirm("Delete this update permanently? This cannot be undone.")) return;
    setOpen(false);
    try {
      await onDelete(post.id);
    } catch (error) {
      setNotice(error.message || "The post could not be deleted");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const reportPost = async (reason) => {
    try {
      await onReport(post.id, reason);
      setReportOpen(false);
      setNotice("Report sent for review");
      setTimeout(() => setNotice(""), 2500);
    } catch (error) {
      setReportOpen(false);
      setNotice(error.message || "The report could not be sent");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const clean = editText.trim();
    if (!clean) return;
    try {
      await onEdit(post.id, clean);
      setEditOpen(false);
      setNotice("Post updated");
      setTimeout(() => setNotice(""), 2500);
    } catch (error) {
      setNotice(error.message || "The post could not be updated");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const itemClass = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground-700 transition hover:bg-background-100 hover:text-primary-700";

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button type="button" aria-label="Post options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full text-foreground-400 transition hover:bg-background-100 hover:text-primary-700"><i className="ri-more-2-fill text-lg" /></button>
      {open && <div role="menu" aria-label="Post options" className="absolute right-0 top-12 z-40 w-64 rounded-2xl border border-background-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(24,48,36,0.18)]">
        {authenticated ? <button type="button" role="menuitem" onClick={toggleSaved} className={itemClass}><i className={saved ? "ri-bookmark-fill" : "ri-bookmark-line"} />{saved ? "Remove from saved" : "Save post"}</button> : <Link role="menuitem" to="/auth/login?redirect=/community" className={itemClass}><i className="ri-bookmark-line" />Sign in to save</Link>}
        <button type="button" role="menuitem" onClick={copyLink} className={itemClass}><i className="ri-link" />Copy post link</button>
        <Link role="menuitem" to={`/listings/${post.listingSlug}`} onClick={() => setOpen(false)} className={itemClass}><i className="ri-user-3-line" />View business profile</Link>
        {!canManage && authenticated && <button type="button" role="menuitem" onClick={async () => { await onFollow(post.listingId); setOpen(false); }} className={itemClass}><i className={post.following ? "ri-user-unfollow-line" : "ri-user-follow-line"} />{post.following ? "Unfollow business" : "Follow business"}</button>}
        <div className="my-1 h-px bg-background-200" />
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onHide(post.id); }} className={itemClass}><i className="ri-eye-off-line" />Hide this post</button>
        {!canManage && <button type="button" role="menuitem" onClick={() => { setOpen(false); onMute(post.listingId); }} className={itemClass}><i className="ri-volume-mute-line" />Mute this business</button>}
        {!canManage && (authenticated ? <button type="button" role="menuitem" onClick={() => { setOpen(false); setReportOpen(true); }} className={itemClass}><i className="ri-flag-line" />Report post</button> : <Link role="menuitem" to="/auth/login?redirect=/community" className={itemClass}><i className="ri-flag-line" />Sign in to report</Link>)}
        {canManage && <><div className="my-1 h-px bg-background-200" /><button type="button" role="menuitem" onClick={() => { setOpen(false); setEditText(post.text || ""); setEditOpen(true); }} className={itemClass}><i className="ri-edit-line" />Edit post</button><button type="button" role="menuitem" onClick={deletePost} className={`${itemClass} text-red-600 hover:bg-red-50 hover:text-red-700`}><i className="ri-delete-bin-6-line" />Delete post</button></>}
      </div>}
      {notice && <span role="status" className="absolute right-0 top-12 z-30 whitespace-nowrap rounded-lg bg-foreground-950 px-3 py-2 text-xs font-semibold text-white shadow-lg">{notice}</span>}
      {editOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}><form onSubmit={saveEdit} role="dialog" aria-modal="true" aria-labelledby={`edit-post-${post.id}`} className="w-full max-w-lg rounded-3xl border border-background-200 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id={`edit-post-${post.id}`} className="font-heading text-2xl font-semibold text-foreground-950">Edit post</h2><p className="mt-1 text-sm text-foreground-500">Update the message shared by {post.listingTitle}.</p></div><button type="button" aria-label="Close edit dialog" onClick={() => setEditOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-background-100"><i className="ri-close-line text-lg" /></button></div><textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={1200} rows={6} autoFocus className="mt-4 w-full resize-y rounded-2xl border border-background-300 p-3 text-sm leading-6 outline-none focus:border-primary-500" aria-label="Post text" /><div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-foreground-400">{editText.length}/1200</span><div className="flex gap-2"><button type="button" onClick={() => setEditOpen(false)} className="h-10 rounded-xl border border-background-300 px-4 text-xs font-bold text-foreground-700">Cancel</button><button type="submit" disabled={!editText.trim()} className="h-10 rounded-xl bg-primary-700 px-5 text-xs font-bold text-white disabled:opacity-40">Save changes</button></div></div></form></div>}
      {reportOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby={`report-post-${post.id}`} className="w-full max-w-md rounded-3xl border border-background-200 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id={`report-post-${post.id}`} className="font-heading text-2xl font-semibold text-foreground-950">Report this post</h2><p className="mt-1 text-sm text-foreground-500">Tell us why this content should be reviewed.</p></div><button type="button" aria-label="Close report dialog" onClick={() => setReportOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-background-100"><i className="ri-close-line text-lg" /></button></div><div className="mt-4 space-y-2">{REPORT_REASONS.map(([value, label]) => <button key={value} type="button" onClick={() => reportPost(value)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-background-200 px-4 py-3 text-left text-sm font-semibold text-foreground-700 transition hover:border-primary-300 hover:bg-primary-50">{label}<i className="ri-arrow-right-s-line" /></button>)}</div></div></div>}
    </div>
  );
}

function CommunityPost({ post, authenticated, canManage, onReact, onComment, onDelete, onEdit, onHide, onMute, onReport, onBookmark, onRepost, onFollow }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const reactionsRef = useRef(null);
  const comments = post.comments || [];
  const emotion = COMMUNITY_EMOTIONS.find((item) => item.value === post.emotion);
  const activity = COMMUNITY_ACTIVITIES.find((item) => item.value === post.activity);
  const postType = POST_TYPES.find((item) => item.value === post.type) || POST_TYPES[0];
  const hasLiveLocation = Number.isFinite(Number(post.latitude)) && Number.isFinite(Number(post.longitude));
  const hasLegacyLocationLabel = hasLiveLocation && isLegacyCoordinateLabel(post.postLocation);
  const [postLocationLabel, setPostLocationLabel] = useState(hasLegacyLocationLabel ? "Current location" : post.postLocation);
  const headerLocationLabel = postLocationLabel ? "Connect767 community" : (post.location || "Connect767 community");
  const postShareUrl = typeof window !== "undefined" ? `${window.location.origin}/community#community-post-${post.id}` : "";
  const reactionCounts = post.reactions || { like: post.thumbCount || 0, love: post.reactionCount || 0 };
  const viewerReaction = post.viewerReaction || (post.thumbed ? "like" : post.reacted ? "love" : "");
  const selectedReaction = COMMUNITY_REACTIONS.find((item) => item.value === viewerReaction);
  const visibleReactions = COMMUNITY_REACTIONS.filter((item) => Number(reactionCounts[item.value]) > 0);
  const totalReactions = Number.isFinite(Number(post.totalReactions))
    ? Number(post.totalReactions)
    : Object.values(reactionCounts).reduce((sum, count) => sum + Number(count || 0), 0);

  useEffect(() => {
    setPostLocationLabel(hasLegacyLocationLabel ? "Current location" : post.postLocation);
    if (!hasLegacyLocationLabel) return undefined;
    let active = true;
    reverseGeocodeLocation(post.latitude, post.longitude).then((placeName) => {
      if (active && placeName) setPostLocationLabel(placeName);
    });
    return () => { active = false; };
  }, [hasLegacyLocationLabel, post.latitude, post.longitude, post.postLocation]);

  useEffect(() => {
    if (!reactionsOpen) return undefined;
    const closeOutside = (event) => {
      if (!reactionsRef.current?.contains(event.target)) setReactionsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setReactionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [reactionsOpen]);

  const submitComment = async (event) => {
    event.preventDefault();
    const clean = comment.trim();
    if (!clean) return;
    await onComment(post.id, clean, replyTo?.id || 0);
    setComment("");
    setReplyTo(null);
    setCommentsOpen(true);
  };

  return (
    <article id={`community-post-${post.id}`} className="scroll-mt-24 rounded-[1.5rem] border border-background-200/80 bg-background-50 p-4 shadow-[0_14px_45px_rgba(24,48,36,0.06)] sm:p-6">
      <header className="flex items-start gap-3">
        {post.listingLogo ? (
          <img src={post.listingLogo} alt={`${post.listingTitle} profile`} className="h-12 w-12 rounded-2xl border border-background-200 object-cover" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-700 text-xl text-white" aria-label={`${post.listingTitle} profile`}><i className="ri-user-3-line" /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/listings/${post.listingSlug}`} className="font-heading text-xl font-semibold text-foreground-950 hover:text-primary-700">{post.listingTitle}</Link>
            {post.verified && <i className="ri-verified-badge-fill text-primary-600" aria-label="Verified listing" />}
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700">{post.industry || "Business"}</span>
          </div>
          <p className="mt-1 text-xs text-foreground-500">{headerLocationLabel} · {relativeTime(post.createdAt)}</p>
        </div>
        <PostOptionsMenu post={post} authenticated={authenticated} canManage={canManage} onDelete={onDelete} onEdit={onEdit} onHide={onHide} onMute={onMute} onReport={onReport} onBookmark={onBookmark} onFollow={onFollow} />
      </header>

      {(emotion || activity) && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-semibold text-foreground-700"><span className="text-base" aria-hidden="true">{emotion?.emoji || activity?.emoji}</span>{emotion ? `Feeling ${emotion.label.toLowerCase()}` : activity.label}</div>}
      {postLocationLabel && (hasLiveLocation ? <a href={mapUrl(post.latitude, post.longitude)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary-700 hover:underline"><i className="ri-map-pin-2-fill" />{postLocationLabel}<i className="ri-arrow-right-up-line" /></a> : <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary-700"><i className="ri-map-pin-2-fill" />{postLocationLabel}</div>)}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground-800">{post.text}</p>
      {post.mediaUrl && <img src={post.mediaUrl} alt={`Update from ${post.listingTitle}`} className="mt-4 max-h-[32rem] w-full rounded-2xl border border-background-200 object-cover" />}
      {post.videoUrl && <video src={post.videoUrl} controls playsInline preload="metadata" className="mt-4 max-h-[32rem] w-full rounded-2xl border border-background-200 bg-black object-contain">Your browser does not support video playback.</video>}
      {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl border border-background-200 bg-background-100 p-4 transition hover:border-primary-300 hover:bg-primary-50/40"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-700 text-white"><i className="ri-links-line text-lg" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-primary-700">Shared link</span><span className="mt-1 block truncate text-sm font-semibold text-foreground-900">{linkLabel(post.linkUrl)}</span><span className="mt-0.5 block truncate text-xs text-foreground-500">{post.linkUrl}</span></span><i className="ri-arrow-right-up-line text-foreground-400" /></a>}
      {!!post.mentions?.length && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">With</span>{post.mentions.map((mention) => <Link key={mention.id || mention.slug} to={`/listings/${mention.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><span className="font-bold">@</span>{mention.title}</Link>)}</div>}
      {post.type !== "status" && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-accent-200 bg-accent-50/60 p-3 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500 text-white"><i className={postType.icon} /></span>
          <div><p className="text-sm font-bold text-foreground-900">{postType.label}</p><p className="text-xs text-foreground-500">{postType.description}</p></div>
          <Link to={`/listings/${post.listingSlug}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-primary-200 px-3 text-xs font-bold text-primary-700 sm:ml-auto sm:min-h-0 sm:border-0 sm:px-0">View profile <i className="ri-arrow-right-up-line ml-1" /></Link>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-b border-background-200 pb-3 text-xs text-foreground-500">
        <span className="inline-flex min-h-6 items-center gap-2">
          {visibleReactions.length > 0 && <span className="flex -space-x-1" aria-hidden="true">{visibleReactions.slice(0, 4).map((item) => <span key={item.value} className="grid h-6 w-6 place-items-center rounded-full border-2 border-background-50 bg-white text-sm shadow-sm">{item.emoji}</span>)}</span>}
          <span>{totalReactions} reaction{totalReactions === 1 ? "" : "s"}{Number(post.repostCount) > 0 ? ` · ${post.repostCount} repost${Number(post.repostCount) === 1 ? "" : "s"}` : ""}</span>
        </span>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)}>{comments.length} comment{comments.length === 1 ? "" : "s"}</button>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <div role="toolbar" aria-label="Post actions" className="flex min-w-0 flex-1 items-center justify-around gap-1 sm:flex-none sm:justify-start">
          <div ref={reactionsRef} className="relative">
            {reactionsOpen && authenticated && <div role="menu" aria-label="Choose a reaction" className="absolute bottom-full left-0 z-30 mb-2 flex w-max max-w-[calc(100vw-2.5rem)] items-center rounded-full border border-background-200 bg-white p-1.5 shadow-[0_14px_40px_rgba(24,48,36,0.18)] sm:max-w-[42rem]">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {COMMUNITY_REACTIONS.map((item) => <button key={item.value} type="button" role="menuitem" title={item.label} aria-label={item.label} aria-pressed={viewerReaction === item.value} onClick={() => { setReactionsOpen(false); onReact(post.id, item.value); }} className={`group/reaction relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl transition hover:-translate-y-1 hover:bg-primary-50 hover:scale-110 ${viewerReaction === item.value ? "bg-primary-100 ring-2 ring-primary-500" : ""}`}><span aria-hidden="true">{item.emoji}</span><span className="pointer-events-none absolute -top-8 hidden rounded-md bg-foreground-950 px-2 py-1 text-[10px] font-bold text-white group-hover/reaction:block">{item.label}</span></button>)}
              </div>
              <button type="button" onClick={() => setReactionsOpen(false)} aria-label="Close reactions" title="Close" className="ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border-l border-background-200 text-lg text-foreground-500 transition hover:bg-background-100 hover:text-foreground-900"><i aria-hidden="true" className="ri-close-line" /></button>
            </div>}
            <button type="button" disabled={!authenticated} onClick={() => setReactionsOpen((open) => !open)} aria-expanded={reactionsOpen} aria-haspopup="menu" aria-label={selectedReaction ? `Reacted ${selectedReaction.label}. Choose another reaction` : "React to this update"} title={selectedReaction?.label || "React"} className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selectedReaction ? "bg-primary-50 text-primary-700" : "text-foreground-600 hover:bg-background-100 hover:text-primary-700"}`}>{selectedReaction ? <span aria-hidden="true">{selectedReaction.emoji}</span> : <i aria-hidden="true" className="ri-emotion-line" />}</button>
          </div>
          <button type="button" onClick={() => setCommentsOpen((open) => !open)} aria-label={commentsOpen ? "Hide comments" : "Show comments"} title="Comment" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition-colors ${commentsOpen ? "bg-primary-50 text-primary-700" : "text-foreground-600 hover:bg-background-100 hover:text-primary-700"}`}><i aria-hidden="true" className="ri-chat-3-line" /></button>
          <button type="button" disabled={!authenticated} onClick={() => onRepost(post.id)} aria-label={post.viewerReposted ? "Remove repost" : "Repost update"} title={post.viewerReposted ? "Remove repost" : "Repost"} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition-colors disabled:opacity-45 ${post.viewerReposted ? "bg-primary-50 text-primary-700" : "text-foreground-600 hover:bg-background-100 hover:text-primary-700"}`}><i aria-hidden="true" className="ri-repeat-2-line" /></button>
          <ShareMenu title={`${post.listingTitle} on Connect767`} url={postShareUrl} placement="top" iconOnly buttonClassName="!h-11 !w-11 !rounded-full !bg-transparent !text-lg !text-foreground-600 !shadow-none hover:!bg-background-100 hover:!text-primary-700" />
        </div>
        <Link to={`/listings/${post.listingSlug}`} className="ml-auto hidden text-xs font-bold text-primary-700 sm:inline-flex">View profile <i className="ri-arrow-right-up-line ml-1" /></Link>
      </div>

      {commentsOpen && (
        <div className="mt-3 border-t border-background-200 pt-4">
          <div className="space-y-3">
            {comments.filter((item) => !Number(item.parentId)).map((item) => <div key={item.id}><div className="rounded-xl bg-background-100 px-3 py-2"><p className="text-xs font-bold text-foreground-900">{item.name}</p><p className="mt-1 text-sm text-foreground-700">{item.text}</p>{authenticated && <button type="button" onClick={() => { setReplyTo(item); setCommentsOpen(true); }} className="mt-2 text-[10px] font-bold text-primary-700">Reply</button>}</div>{comments.filter((reply) => Number(reply.parentId) === Number(item.id)).map((reply) => <div key={reply.id} className="ml-6 mt-2 rounded-xl border-l-2 border-primary-200 bg-background-100/70 px-3 py-2"><p className="text-xs font-bold text-foreground-900">{reply.name}</p><p className="mt-1 text-sm text-foreground-700">{reply.text}</p></div>)}</div>)}
          </div>
          {authenticated ? (
            <><form onSubmit={submitComment} className="mt-3 flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={600} className="h-10 min-w-0 flex-1 rounded-xl border border-background-300 bg-white px-3 text-sm outline-none focus:border-primary-500" placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a helpful comment…"} /><button className="h-10 rounded-xl bg-primary-700 px-4 text-xs font-bold text-white" type="submit">Reply</button></form>{replyTo && <button type="button" onClick={() => setReplyTo(null)} className="mt-2 text-[10px] font-bold text-foreground-500">Cancel reply</button>}</>
          ) : <Link to="/auth/login" className="mt-3 inline-flex text-xs font-bold text-primary-700">Sign in to join the conversation</Link>}
        </div>
      )}
    </article>
  );
}

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("for-you");
  const { data, loading, error, reload } = useAsync(() => getCommunityPosts({ tab: activeTab }), [activeTab]);
  const [posts, setPosts] = useState([]);
  const [listings, setListings] = useState([]);
  const [hiddenPostIds, setHiddenPostIds] = useState(() => new Set());
  const [mutedListingIds, setMutedListingIds] = useState(() => readStoredIds("c767_muted_community_listings"));
  const [listingId, setListingId] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState("status");
  const [emotion, setEmotion] = useState("");
  const [activity, setActivity] = useState("");
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [emotionSearch, setEmotionSearch] = useState("");
  const [feelingTab, setFeelingTab] = useState("feelings");
  const [postLocation, setPostLocation] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionedBusinesses, setMentionedBusinesses] = useState([]);
  const [inlineMention, setInlineMention] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [attachmentType, setAttachmentType] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const postTextRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const activeMentionSearch = inlineMention?.query ?? "";

  useEffect(() => { if (data?.posts) setPosts(data.posts); }, [data]);
  useEffect(() => {
    if (!attachment) {
      setAttachmentPreview("");
      return undefined;
    }
    const preview = URL.createObjectURL(attachment);
    setAttachmentPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [attachment]);
  useEffect(() => {
    if (!isAuthenticated) return;
    getMyListings().then((items) => {
      const published = (items || []).filter((item) => item.status === "publish" || item.status === "published" || !item.status);
      setListings(published);
      setListingId(String(published[0]?.id || ""));
    }).catch(() => setListings([]));
  }, [isAuthenticated]);
  useEffect(() => {
    if (!inlineMention) {
      setMentionResults([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      getListings(activeMentionSearch.trim() ? { search: activeMentionSearch.trim() } : {})
        .then((items) => { if (active) setMentionResults((items || []).slice(0, 6)); })
        .catch(() => { if (active) setMentionResults([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [activeMentionSearch, inlineMention]);

  const selectedListing = useMemo(() => listings.find((item) => String(item.id) === listingId), [listings, listingId]);
  const ownedListingIds = useMemo(() => new Set(listings.map((item) => String(item.id))), [listings]);
  const visiblePosts = posts.filter((post) => !hiddenPostIds.has(String(post.id)) && !mutedListingIds.has(String(post.listingId)));
  const selectedPostType = POST_TYPES.find((item) => item.value === type) || POST_TYPES[0];
  const selectedEmotion = COMMUNITY_EMOTIONS.find((item) => item.value === emotion);
  const selectedActivity = COMMUNITY_ACTIVITIES.find((item) => item.value === activity);
  const feelingOptions = feelingTab === "feelings" ? COMMUNITY_EMOTIONS : COMMUNITY_ACTIVITIES;
  const filteredFeelings = feelingOptions.filter((item) => item.label.toLowerCase().includes(emotionSearch.trim().toLowerCase()));
  const updatePostText = (event) => {
    const value = event.target.value;
    const cursor = event.target.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|[\s(])@([^@\n]{0,60})$/);
    setText(value);
    if (!match) {
      setInlineMention(null);
      return;
    }
    const query = match[1].trimStart();
    setInlineMention({ query, start: cursor - match[1].length - 1, end: cursor });
  };
  const beginInlineMention = () => {
    const textarea = postTextRef.current;
    const cursor = textarea?.selectionStart ?? text.length;
    const prefix = text.slice(0, cursor);
    const spacer = prefix && !/[\s(]$/.test(prefix) ? " " : "";
    const insertion = `${spacer}@`;
    const start = cursor + spacer.length;
    const nextText = `${prefix}${insertion}${text.slice(cursor)}`;
    setText(nextText);
    setInlineMention({ query: "", start, end: start + 1 });
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + 1, start + 1);
    });
  };
  const selectMention = (item) => {
    if (!mentionedBusinesses.some((mention) => String(mention.id) === String(item.id)) && mentionedBusinesses.length < 10) {
      setMentionedBusinesses((current) => [...current, { id: item.id, slug: item.slug, title: item.title }]);
    }
    if (inlineMention) {
      setText((current) => `${current.slice(0, inlineMention.start)}@${item.title} ${current.slice(inlineMention.end)}`);
      setInlineMention(null);
    }
    setMentionResults([]);
  };
  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentType("");
    setLinkUrl("");
    setLinkOpen(false);
    setAttachmentMenuOpen(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };
  const selectMedia = (event, kind) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isImage = kind === "image";
    const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if ((isImage && !file.type.startsWith("image/")) || (!isImage && !validVideoTypes.includes(file.type))) {
      setMessage(isImage ? "Choose a JPG, PNG, WebP, or GIF image." : "Choose an MP4, WebM, or MOV video.");
      event.target.value = "";
      return;
    }
    const sizeLimit = (isImage ? 5 : 25) * 1024 * 1024;
    if (file.size > sizeLimit) {
      setMessage(isImage ? "Community images must be 5 MB or smaller." : "Community videos must be 25 MB or smaller.");
      event.target.value = "";
      return;
    }
    setMessage("");
    setLinkOpen(false);
    setAttachmentMenuOpen(false);
    setLinkUrl("");
    setAttachment(file);
    setAttachmentType(kind);
  };
  const attachLink = () => {
    const value = linkUrl.trim();
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      setAttachment(null);
      setAttachmentType("link");
      setLinkUrl(parsed.toString());
      setLinkOpen(false);
      setAttachmentMenuOpen(false);
      setMessage("");
    } catch {
      setMessage("Enter a complete website link beginning with http:// or https://.");
    }
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Live location is not supported by this browser. Enter a location manually instead.");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        setLocationCoordinates({ latitude, longitude });
        setPostLocation("Finding location name…");
        const placeName = await reverseGeocodeLocation(latitude, longitude);
        setPostLocation(placeName || "Current location");
        setLocationOpen(false);
        setLocating(false);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setMessage(denied ? "Location permission was denied. Allow location access or enter a place manually." : "Your live location could not be detected. Try again or enter a place manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };
  const submitPost = async (event) => {
    event.preventDefault();
    if (!text.trim() || !listingId) return;
    setSubmitting(true);
    setMessage("");
    try {
      const created = await createCommunityPost({ listingId: Number(listingId), text: text.trim(), type, emotion, activity, postLocation: postLocation.trim(), latitude: locationCoordinates?.latitude ?? null, longitude: locationCoordinates?.longitude ?? null, mentions: mentionedBusinesses.map(({ id, slug, title }) => ({ id, slug, title })), image: attachmentType === "image" ? attachment : null, video: attachmentType === "video" ? attachment : null, linkUrl: attachmentType === "link" ? linkUrl : "", listingSlug: selectedListing?.slug, listingTitle: selectedListing?.title, listingLogo: listingAvatar(selectedListing) });
      setPosts((current) => [created, ...current]);
      setText("");
      setType("status");
      setEmotion("");
      setActivity("");
      setEmotionOpen(false);
      setEmotionSearch("");
      setPostLocation("");
      setLocationCoordinates(null);
      setLocationOpen(false);
      setMentionedBusinesses([]);
      setInlineMention(null);
      clearAttachment();
    } catch (postError) {
      setMessage(postError.message || "Your update could not be published.");
    } finally { setSubmitting(false); }
  };
  const react = async (postId, reactionType = "like") => {
    const current = posts.find((post) => post.id === postId);
    const previousType = current?.viewerReaction || (current?.thumbed ? "like" : current?.reacted ? "love" : "");
    const nextType = previousType === reactionType ? "" : reactionType;
    setPosts((items) => items.map((post) => {
      if (post.id !== postId) return post;
      const counts = { ...(post.reactions || { like: post.thumbCount || 0, love: post.reactionCount || 0 }) };
      if (previousType) counts[previousType] = Math.max(0, Number(counts[previousType] || 0) - 1);
      if (nextType) counts[nextType] = Number(counts[nextType] || 0) + 1;
      return { ...post, reactions: counts, viewerReaction: nextType, totalReactions: Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0) };
    }));
    try {
      const result = await toggleCommunityReaction(postId, reactionType);
      if (result) setPosts((items) => items.map((post) => post.id === postId ? { ...post, reactions: result.reactions, viewerReaction: result.viewerReaction, totalReactions: result.total } : post));
    } catch { setPosts((items) => items.map((post) => post.id === postId ? current : post)); }
  };
  const comment = async (postId, value, parentId = 0) => {
    const created = await createCommunityComment(postId, value, parentId);
    setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), created] } : post));
  };
  const bookmarkPost = async (postId) => {
    const result = await toggleCommunityBookmark(postId);
    setPosts((items) => items.map((post) => String(post.id) === String(postId) ? { ...post, bookmarked: result.bookmarked } : post));
    return result;
  };
  const repostPost = async (postId) => {
    const result = await toggleCommunityRepost(postId, { listingId: Number(listingId) || 0 });
    setPosts((items) => items.map((post) => String(post.id) === String(postId) ? { ...post, viewerReposted: result.reposted, repostCount: result.count } : post));
  };
  const followBusiness = async (businessId) => {
    const result = await toggleCommunityFollow(businessId);
    setPosts((items) => items.map((post) => String(post.listingId) === String(businessId) ? { ...post, following: result.following } : post));
    return result;
  };
  const hidePost = (postId) => setHiddenPostIds((current) => new Set([...current, String(postId)]));
  const muteBusiness = (listingToMute) => {
    const post = posts.find((item) => String(item.listingId) === String(listingToMute));
    if (!window.confirm(`Mute ${post?.listingTitle || "this business"}? Its posts will no longer appear in your feed on this device.`)) return;
    setMutedListingIds((current) => {
      const next = new Set([...current, String(listingToMute)]);
      writeStoredIds("c767_muted_community_listings", next);
      return next;
    });
  };
  const removePost = async (postId) => {
    await deleteCommunityPost(postId);
    setPosts((items) => items.filter((post) => String(post.id) !== String(postId)));
  };
  const editPost = async (postId, updatedText) => {
    const updated = await updateCommunityPost(postId, updatedText);
    setPosts((items) => items.map((post) => String(post.id) === String(postId) ? { ...post, ...updated, text: updated?.text || updatedText } : post));
  };
  const reportPost = (postId, reason) => reportCommunityPost(postId, reason);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background-100/45 pb-20 pt-20 sm:pt-24 md:pt-28">
      <section className="mx-auto max-w-7xl px-3 sm:px-4 md:px-8">
        <div className="flex flex-col gap-5 border-b border-background-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Connect · Share · Grow</p><h1 className="mt-2 font-heading text-3xl font-light leading-tight text-foreground-950 sm:text-4xl md:text-5xl">Business <span className="italic text-accent-500">community</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-foreground-600">Updates, offers and conversations from businesses across Dominica and abroad.</p></div>
          <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-background-300 bg-background-50 p-1 text-[11px] font-bold sm:w-auto sm:grid-cols-none sm:grid-flow-col sm:rounded-full sm:text-xs" role="tablist" aria-label="Community feed views">{[["for-you", "For you"], ["following", "Following"], ["latest", "Latest"], ["trending", "Trending"], ["businesses", "Businesses"], ["community", "Community"]].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={activeTab === value} aria-label={`Show ${label} posts`} onClick={() => setActiveTab(value)} className={`min-h-10 min-w-0 rounded-xl px-2 py-2 transition sm:rounded-full sm:px-4 ${activeTab === value ? "bg-primary-700 text-white shadow-sm" : "text-foreground-500 hover:bg-background-100 hover:text-primary-700"}`}>{label}</button>)}</div>
        </div>

        <div className="mt-5 grid gap-6 sm:mt-7 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <main className="space-y-4">
            <section className="rounded-[1.5rem] border border-background-200/80 bg-background-50 p-4 shadow-[0_14px_45px_rgba(24,48,36,0.06)] sm:p-5">
              {isAuthenticated && listings.length ? (
                <form onSubmit={submitPost}>
                  <span id="community-feeling-panel" className="sr-only">Feeling and activity options</span>
                  <div className="flex gap-2.5 sm:gap-3">
                    {listingAvatar(selectedListing) ? (
                      <img src={listingAvatar(selectedListing)} alt={`${selectedListing.title} profile`} className="h-11 w-11 shrink-0 rounded-2xl border border-background-200 object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-700 text-lg text-white" aria-label="Listing profile picture"><i className="ri-user-3-line" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      {listings.length > 1 && <div className="mb-2 flex items-center justify-end gap-2"><label htmlFor="community-business-profile" className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">Posting as</label><select id="community-business-profile" value={listingId} onChange={(event) => setListingId(event.target.value)} className="h-9 max-w-52 rounded-xl border border-background-300 bg-white px-3 text-xs font-semibold">{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}
                      <div className="relative"><textarea ref={postTextRef} value={text} onChange={updatePostText} onKeyDown={(event) => { if (event.key === "Escape") setInlineMention(null); }} maxLength={1200} rows={3} className="min-h-28 w-full resize-none rounded-2xl border border-background-300 bg-white px-3 pb-10 pt-3 text-sm leading-6 outline-none focus:border-primary-500" placeholder={`${selectedPostType.placeholder.replace(/…$/, "")} from ${selectedListing?.title || "your business"}…`} aria-label="Status update. Type @ to mention a business." />
                        <button type="button" onClick={beginInlineMention} aria-label="Mention a business in this update" title="Mention a business" className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-base font-bold text-primary-700 transition hover:bg-primary-100">@</button>
                        <span className="pointer-events-none absolute bottom-2 left-12 hidden text-[10px] font-medium text-foreground-400 sm:inline">Type @ to mention a directory listing</span>
                        {inlineMention && <div role="listbox" aria-label="Directory listing suggestions" className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-background-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(24,48,36,0.2)]">{mentionResults.length ? mentionResults.map((item) => <button key={item.id || item.slug} type="button" role="option" disabled={mentionedBusinesses.some((mention) => String(mention.id) === String(item.id)) || mentionedBusinesses.length >= 10} onClick={() => selectMention(item)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-primary-50 disabled:opacity-45">{listingAvatar(item) ? <img src={listingAvatar(item)} alt="" className="h-9 w-9 shrink-0 rounded-xl border border-background-200 object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-[10px] font-bold text-primary-700">{initials(item.title)}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-foreground-900">{item.title}</span><span className="block truncate text-[10px] text-foreground-500">{item.location || item.category}</span></span><span className="text-xs font-bold text-primary-700">@</span></button>) : <p className="px-3 py-4 text-center text-xs text-foreground-500">Searching published directory listings…</p>}</div>}
                      </div>
                      {!!mentionedBusinesses.length && <div className="mt-2 flex flex-wrap gap-2">{mentionedBusinesses.map((item) => <span key={item.id || item.slug} className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><span className="font-bold">@</span>{item.title}<button type="button" onClick={() => setMentionedBusinesses((current) => current.filter((mention) => String(mention.id) !== String(item.id)))} aria-label={`Remove ${item.title}`}><i className="ri-close-line" /></button></span>)}</div>}
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/70 px-3 py-2 text-xs text-foreground-600" role="status" aria-live="polite"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-700 text-white"><i className={selectedPostType.icon} /></span><span><strong className="text-primary-800">{selectedPostType.label} selected.</strong> {selectedPostType.description}</span></div>
                    </div>
                  </div>
                  {attachmentPreview && <div className="relative mt-3 overflow-hidden rounded-2xl border border-background-200 bg-background-100 sm:ml-14">{attachmentType === "image" ? <img src={attachmentPreview} alt="Attachment preview" className="max-h-72 w-full object-cover" /> : <video src={attachmentPreview} controls playsInline preload="metadata" className="max-h-72 w-full bg-black object-contain" />}<button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white shadow-lg"><i className="ri-close-line text-lg" /></button><div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-xs font-semibold text-white"><i className={`${attachmentType === "video" ? "ri-video-line" : "ri-image-line"} mr-1.5`} />{attachment.name}</div></div>}
                  {attachmentType === "link" && <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50/50 p-3 sm:ml-14"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-white"><i className="ri-links-line" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700">Link ready to share</span><span className="mt-1 block truncate text-sm font-semibold text-foreground-900">{linkLabel(linkUrl)}</span></span><button type="button" onClick={clearAttachment} aria-label="Remove attached link" className="grid h-9 w-9 place-items-center rounded-full text-foreground-500 hover:bg-white"><i className="ri-close-line text-lg" /></button></div>}
                  {linkOpen && <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-background-200 bg-background-100 p-3 sm:ml-14 sm:flex-row"><input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); attachLink(); } }} className="h-10 min-w-0 flex-1 rounded-xl border border-background-300 bg-white px-3 text-sm outline-none focus:border-primary-500" placeholder="https://yourbusiness.com/page" aria-label="Website link" /><button type="button" onClick={attachLink} className="h-10 rounded-xl bg-primary-700 px-4 text-xs font-bold text-white">Attach link</button></div>}
                  {emotionOpen && <div className="mt-3 rounded-2xl border border-background-200 bg-background-100 p-3 sm:ml-14" role="group" aria-label="Choose a feeling or activity"><div className="mb-3 flex items-center justify-between gap-2"><div className="inline-flex rounded-xl border border-background-300 bg-white p-1"><button type="button" onClick={() => { setFeelingTab("feelings"); setEmotionSearch(""); }} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${feelingTab === "feelings" ? "bg-primary-700 text-white" : "text-foreground-500"}`}>Feelings</button><button type="button" onClick={() => { setFeelingTab("activities"); setEmotionSearch(""); }} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${feelingTab === "activities" ? "bg-primary-700 text-white" : "text-foreground-500"}`}>Activities</button></div>{(emotion || activity) && <button type="button" onClick={() => { setEmotion(""); setActivity(""); setEmotionSearch(""); setEmotionOpen(false); }} className="text-[10px] font-bold text-primary-700">Clear</button>}</div><label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-background-300 bg-white px-3 text-foreground-500 focus-within:border-primary-400"><i className="ri-search-line" /><input value={emotionSearch} onChange={(event) => setEmotionSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-foreground-800 outline-none" placeholder={`Search ${feelingOptions.length} ${feelingTab}…`} aria-label={`Search ${feelingTab}`} /></label><div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">{filteredFeelings.map((item) => <button key={item.value} type="button" onClick={() => { if (feelingTab === "feelings") { setEmotion(item.value); setActivity(""); } else { setActivity(item.value); setEmotion(""); } setEmotionSearch(""); setEmotionOpen(false); }} className={`inline-flex h-10 items-center justify-start gap-2 rounded-xl border px-3 text-xs font-semibold transition ${(emotion === item.value || activity === item.value) ? "border-primary-500 bg-primary-50 text-primary-800" : "border-background-300 bg-white text-foreground-700 hover:border-primary-300 hover:bg-primary-50/40"}`}><span className="text-base" aria-hidden="true">{item.emoji}</span><span className="truncate">{item.label}</span></button>)}</div>{!filteredFeelings.length && <p className="py-6 text-center text-xs text-foreground-500">No {feelingTab} match “{emotionSearch}”.</p>}</div>}
                  {locationOpen && <div className="mt-3 rounded-2xl border border-background-200 bg-background-100 p-3 sm:ml-14"><button type="button" onClick={useCurrentLocation} disabled={locating} className="flex w-full items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3 text-left text-primary-800 transition hover:bg-primary-100 disabled:opacity-60"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-white"><i className={locating ? "ri-loader-4-line animate-spin" : "ri-crosshair-2-line"} /></span><span><span className="block text-xs font-bold">{locating ? "Finding your location…" : "Use current location"}</span><span className="mt-0.5 block text-[10px] text-foreground-500">Your browser will ask for permission</span></span></button><div className="my-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400"><span className="h-px flex-1 bg-background-300" />or enter a place<span className="h-px flex-1 bg-background-300" /></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-background-300 bg-white px-3 text-primary-700 focus-within:border-primary-400"><i className="ri-map-pin-2-line" /><input value={postLocation} onChange={(event) => { setPostLocation(event.target.value.slice(0, 120)); setLocationCoordinates(null); }} className="min-w-0 flex-1 bg-transparent text-sm text-foreground-800 outline-none" placeholder="Add a city, venue, or place" aria-label="Post location" /></label><button type="button" onClick={() => setLocationOpen(false)} className="h-10 rounded-xl bg-primary-700 px-4 text-xs font-bold text-white">Done</button></div><p className="mt-2 text-[10px] text-foreground-400">Location names © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-primary-700">OpenStreetMap contributors</a></p></div>}
                  <div className="mt-3 grid grid-cols-3 items-center gap-2 border-t border-background-200 pt-3 sm:flex sm:flex-wrap">
                    <div className="col-span-3 grid grid-cols-2 gap-1 rounded-xl border border-background-200 bg-background-100 p-1 sm:col-auto sm:flex sm:flex-wrap" role="group" aria-label="Update type">{POST_TYPES.map((option) => <button key={option.value} type="button" aria-pressed={type === option.value} title={option.description} onClick={() => { setType(option.value); setMessage(""); }} className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition sm:h-9 sm:px-3 ${type === option.value ? "bg-primary-700 text-white shadow-sm" : "text-foreground-600 hover:bg-white hover:text-primary-700"}`}><i className={option.icon} />{option.label}</button>)}</div>
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectMedia(event, "image")} className="sr-only" />
                    <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => selectMedia(event, "video")} className="sr-only" />
                    <div className="relative min-w-0 sm:min-w-fit">
                      <button type="button" aria-haspopup="menu" aria-expanded={attachmentMenuOpen} onClick={() => { setAttachmentMenuOpen((open) => !open); setLinkOpen(false); setEmotionOpen(false); setLocationOpen(false); }} className={`inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition sm:h-10 sm:w-auto sm:px-3 ${attachmentType || attachmentMenuOpen || linkOpen ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><i className="ri-attachment-2" /><span className="truncate">{attachmentType ? `${attachmentType === "image" ? "Photo" : attachmentType === "video" ? "Video" : "Link"} added` : "Attach"}</span><i className={`ri-arrow-${attachmentMenuOpen ? "up" : "down"}-s-line text-sm`} /></button>
                      {attachmentMenuOpen && <div role="menu" aria-label="Attach to update" className="absolute bottom-12 left-0 z-30 w-52 overflow-hidden rounded-2xl border border-background-200 bg-white p-1.5 shadow-[0_16px_45px_rgba(24,48,36,0.18)]">
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); imageInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-image-add-line" /></span><span><span className="block text-xs font-bold text-foreground-900">Photo</span><span className="block text-[10px] text-foreground-500">JPG, PNG, WebP or GIF</span></span></button>
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); videoInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-video-add-line" /></span><span><span className="block text-xs font-bold text-foreground-900">Video</span><span className="block text-[10px] text-foreground-500">MP4, WebM or MOV</span></span></button>
                        <button type="button" role="menuitem" onClick={() => { setAttachment(null); setAttachmentType(""); setLinkOpen(true); setAttachmentMenuOpen(false); setMessage(""); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-links-line" /></span><span><span className="block text-xs font-bold text-foreground-900">Website link</span><span className="block text-[10px] text-foreground-500">Share a secure URL</span></span></button>
                      </div>}
                    </div>
                    <button type="button" aria-expanded={emotionOpen} aria-controls="community-feeling-panel" onClick={() => { setEmotionSearch(""); setEmotionOpen((open) => !open); setAttachmentMenuOpen(false); setLinkOpen(false); setLocationOpen(false); }} className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold sm:h-10 sm:px-3 ${(emotion || activity) ? "bg-accent-50 text-foreground-800" : "text-foreground-500 hover:bg-background-100"}`}><span className="text-base" aria-hidden="true">{selectedEmotion?.emoji || selectedActivity?.emoji || "😊"}</span><span className="truncate">{selectedEmotion?.label || selectedActivity?.label || "Feeling"}</span></button>
                    <button type="button" aria-expanded={locationOpen} onClick={() => { setLocationOpen((open) => !open); setAttachmentMenuOpen(false); setLinkOpen(false); setEmotionOpen(false); }} className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold sm:h-10 sm:px-3 ${postLocation ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><i className={`${locationCoordinates ? "ri-crosshair-2-line" : "ri-map-pin-2-line"} text-base`} /><span className="truncate">{postLocation || "Location"}</span></button>
                    <button type="submit" disabled={submitting || !text.trim()} aria-disabled={submitting || !text.trim()} title={!text.trim() ? `Write your ${selectedPostType.label.toLowerCase()} before posting` : selectedPostType.action} className="col-span-3 h-11 w-full rounded-xl bg-primary-700 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:bg-primary-200 disabled:text-primary-700 sm:col-auto sm:ml-auto sm:h-10 sm:w-auto">{submitting ? "Posting…" : !text.trim() ? `Write ${selectedPostType.label.toLowerCase()} first` : selectedPostType.action}</button>
                  </div>
                  {message && <p role="alert" className="mt-3 text-xs text-red-600">{message}</p>}
                </form>
              ) : isAuthenticated ? <div className="text-sm text-foreground-600">Publish a directory listing before posting to the community. <Link to="/listings/submit" className="font-bold text-primary-700">Create your listing</Link></div> : <div className="flex items-center justify-between gap-4"><p className="text-sm text-foreground-600">Sign in as a listing owner to share business updates.</p><Link to="/auth/login" className="shrink-0 rounded-xl bg-primary-700 px-4 py-2.5 text-xs font-bold text-white">Sign in</Link></div>}
            </section>

            {loading && !posts.length && <div className="py-16 text-center text-sm text-foreground-500">Loading community updates…</div>}
            {error && !posts.length && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">The community feed could not load. <button onClick={reload} className="font-bold underline">Try again</button></div>}
            {!loading && !error && !visiblePosts.length && <div className="rounded-2xl border border-background-200 bg-background-50 p-8 text-center text-sm text-foreground-500">No posts are available in this feed yet.</div>}
            {visiblePosts.map((post) => <CommunityPost key={post.id} post={post} authenticated={isAuthenticated} canManage={Boolean(post.canManage) || ownedListingIds.has(String(post.listingId))} onReact={react} onComment={comment} onDelete={removePost} onEdit={editPost} onHide={hidePost} onMute={muteBusiness} onReport={reportPost} onBookmark={bookmarkPost} onRepost={repostPost} onFollow={followBusiness} />)}
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
