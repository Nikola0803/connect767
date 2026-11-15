import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ShareMenu from "../components/ShareMenu";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import {
  createCommunityComment,
  createCommunityPost,
  getCommunityPosts,
  getListings,
  getMyListings,
  toggleCommunityReaction,
} from "../data/repository";

const POST_TYPES = [
  { value: "status", label: "Update", icon: "ri-chat-3-line", description: "Share business news, progress, or a quick announcement.", placeholder: "Share a business update…", action: "Post update" },
  { value: "offer", label: "Offer", icon: "ri-coupon-3-line", description: "Promote a special price, service, product, or limited-time deal.", placeholder: "Describe your offer, price, and how customers can claim it…", action: "Post offer" },
  { value: "event", label: "Event", icon: "ri-calendar-event-line", description: "Announce an upcoming activity and include the date, time, and location.", placeholder: "Share the event date, time, location, and attendance details…", action: "Post event" },
  { value: "opportunity", label: "Opportunity", icon: "ri-briefcase-4-line", description: "Share a job, partnership, contract, or collaboration opportunity.", placeholder: "Describe the opportunity, requirements, and how to respond…", action: "Post opportunity" },
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

function CommunityPost({ post, authenticated, onReact, onComment }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const comments = post.comments || [];
  const emotion = COMMUNITY_EMOTIONS.find((item) => item.value === post.emotion);
  const activity = COMMUNITY_ACTIVITIES.find((item) => item.value === post.activity);
  const postType = POST_TYPES.find((item) => item.value === post.type) || POST_TYPES[0];
  const hasLiveLocation = Number.isFinite(Number(post.latitude)) && Number.isFinite(Number(post.longitude));
  const postShareUrl = typeof window !== "undefined" ? `${window.location.origin}/community#community-post-${post.id}` : "";

  const submitComment = async (event) => {
    event.preventDefault();
    const clean = comment.trim();
    if (!clean) return;
    await onComment(post.id, clean);
    setComment("");
    setCommentsOpen(true);
  };

  return (
    <article id={`community-post-${post.id}`} className="scroll-mt-24 rounded-[1.5rem] border border-background-200/80 bg-background-50 p-5 shadow-[0_14px_45px_rgba(24,48,36,0.06)] sm:p-6">
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

      {(emotion || activity) && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-semibold text-foreground-700"><span className="text-base" aria-hidden="true">{emotion?.emoji || activity?.emoji}</span>{emotion ? `Feeling ${emotion.label.toLowerCase()}` : activity.label}</div>}
      {post.postLocation && (hasLiveLocation ? <a href={mapUrl(post.latitude, post.longitude)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary-700 hover:underline"><i className="ri-map-pin-2-fill" />{post.postLocation}<i className="ri-arrow-right-up-line" /></a> : <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary-700"><i className="ri-map-pin-2-fill" />{post.postLocation}</div>)}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground-800">{post.text}</p>
      {post.mediaUrl && <img src={post.mediaUrl} alt={`Update from ${post.listingTitle}`} className="mt-4 max-h-[32rem] w-full rounded-2xl border border-background-200 object-cover" />}
      {post.videoUrl && <video src={post.videoUrl} controls playsInline preload="metadata" className="mt-4 max-h-[32rem] w-full rounded-2xl border border-background-200 bg-black object-contain">Your browser does not support video playback.</video>}
      {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl border border-background-200 bg-background-100 p-4 transition hover:border-primary-300 hover:bg-primary-50/40"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-700 text-white"><i className="ri-links-line text-lg" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-primary-700">Shared link</span><span className="mt-1 block truncate text-sm font-semibold text-foreground-900">{linkLabel(post.linkUrl)}</span><span className="mt-0.5 block truncate text-xs text-foreground-500">{post.linkUrl}</span></span><i className="ri-arrow-right-up-line text-foreground-400" /></a>}
      {!!post.mentions?.length && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">With</span>{post.mentions.map((mention) => <Link key={mention.id || mention.slug} to={`/listings/${mention.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><span className="font-bold">@</span>{mention.title}</Link>)}</div>}
      {post.type !== "status" && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-200 bg-accent-50/60 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500 text-white"><i className={postType.icon} /></span>
          <div><p className="text-sm font-bold text-foreground-900">{postType.label}</p><p className="text-xs text-foreground-500">{postType.description}</p></div>
          <Link to={`/listings/${post.listingSlug}`} className="ml-auto text-xs font-bold text-primary-700">View profile <i className="ri-arrow-right-up-line" /></Link>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-b border-background-200 pb-3 text-xs text-foreground-500">
        <span>{post.reactionCount || 0} appreciations</span>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)}>{comments.length} comment{comments.length === 1 ? "" : "s"}</button>
      </div>
      <div className="flex items-center gap-1 pt-2">
        <button type="button" disabled={!authenticated} onClick={() => onReact(post.id)} className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${post.reacted ? "bg-primary-50 text-primary-700" : "text-foreground-600 hover:bg-background-100"}`}><span className="inline-flex items-center gap-1" aria-hidden="true"><i className={post.reacted ? "ri-heart-3-fill" : "ri-heart-3-line"} /><i className={post.reacted ? "ri-thumb-up-fill" : "ri-thumb-up-line"} /></span>Appreciate</button>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold text-foreground-600 hover:bg-background-100"><i className="ri-chat-3-line" />Comment</button>
        <ShareMenu title={`${post.listingTitle} on Connect767`} url={postShareUrl} placement="top" showLabelOnMobile buttonClassName="!h-10 !rounded-full !border-0 !px-3 !py-0 !text-xs !font-semibold !text-foreground-600 hover:!bg-background-100" />
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
  const [activity, setActivity] = useState("");
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [emotionSearch, setEmotionSearch] = useState("");
  const [feelingTab, setFeelingTab] = useState("feelings");
  const [postLocation, setPostLocation] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionedBusinesses, setMentionedBusinesses] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [attachmentType, setAttachmentType] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

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
    if (!mentionOpen || mentionSearch.trim().length < 2) {
      setMentionResults([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      getListings({ search: mentionSearch.trim() })
        .then((items) => { if (active) setMentionResults((items || []).slice(0, 6)); })
        .catch(() => { if (active) setMentionResults([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [mentionOpen, mentionSearch]);

  const selectedListing = useMemo(() => listings.find((item) => String(item.id) === listingId), [listings, listingId]);
  const selectedPostType = POST_TYPES.find((item) => item.value === type) || POST_TYPES[0];
  const selectedEmotion = COMMUNITY_EMOTIONS.find((item) => item.value === emotion);
  const selectedActivity = COMMUNITY_ACTIVITIES.find((item) => item.value === activity);
  const feelingOptions = feelingTab === "feelings" ? COMMUNITY_EMOTIONS : COMMUNITY_ACTIVITIES;
  const filteredFeelings = feelingOptions.filter((item) => item.label.toLowerCase().includes(emotionSearch.trim().toLowerCase()));
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
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        setLocationCoordinates({ latitude, longitude });
        setPostLocation(`Live location · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
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
      const created = await createCommunityPost({ listingId: Number(listingId), text: text.trim(), type, emotion, activity, postLocation: postLocation.trim(), latitude: locationCoordinates?.latitude ?? null, longitude: locationCoordinates?.longitude ?? null, mentions: mentionedBusinesses.map(({ id, slug, title }) => ({ id, slug, title })), image: attachmentType === "image" ? attachment : null, video: attachmentType === "video" ? attachment : null, linkUrl: attachmentType === "link" ? linkUrl : "", listingSlug: selectedListing?.slug, listingTitle: selectedListing?.title });
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
      setMentionOpen(false);
      setMentionSearch("");
      setMentionedBusinesses([]);
      clearAttachment();
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
                  <div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-700 text-xs font-bold text-white">{initials(selectedListing?.title)}</span><div className="min-w-0 flex-1"><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1200} rows={3} className="min-h-24 w-full resize-none rounded-2xl border border-background-300 bg-white p-3 text-sm outline-none focus:border-primary-500" placeholder={`${selectedPostType.placeholder.replace(/…$/, "")} from ${selectedListing?.title || "your business"}…`} /><div className="mt-2 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/70 px-3 py-2 text-xs text-foreground-600" role="status" aria-live="polite"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-700 text-white"><i className={selectedPostType.icon} /></span><span><strong className="text-primary-800">{selectedPostType.label} selected.</strong> {selectedPostType.description}</span></div></div></div>
                  {attachmentPreview && <div className="relative ml-14 mt-3 overflow-hidden rounded-2xl border border-background-200 bg-background-100">{attachmentType === "image" ? <img src={attachmentPreview} alt="Attachment preview" className="max-h-72 w-full object-cover" /> : <video src={attachmentPreview} controls playsInline preload="metadata" className="max-h-72 w-full bg-black object-contain" />}<button type="button" onClick={clearAttachment} aria-label="Remove attachment" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white shadow-lg"><i className="ri-close-line text-lg" /></button><div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-xs font-semibold text-white"><i className={`${attachmentType === "video" ? "ri-video-line" : "ri-image-line"} mr-1.5`} />{attachment.name}</div></div>}
                  {attachmentType === "link" && <div className="ml-14 mt-3 flex items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50/50 p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-white"><i className="ri-links-line" /></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700">Link ready to share</span><span className="mt-1 block truncate text-sm font-semibold text-foreground-900">{linkLabel(linkUrl)}</span></span><button type="button" onClick={clearAttachment} aria-label="Remove attached link" className="grid h-9 w-9 place-items-center rounded-full text-foreground-500 hover:bg-white"><i className="ri-close-line text-lg" /></button></div>}
                  {linkOpen && <div className="ml-14 mt-3 flex flex-col gap-2 rounded-2xl border border-background-200 bg-background-100 p-3 sm:flex-row"><input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); attachLink(); } }} className="h-10 min-w-0 flex-1 rounded-xl border border-background-300 bg-white px-3 text-sm outline-none focus:border-primary-500" placeholder="https://yourbusiness.com/page" aria-label="Website link" /><button type="button" onClick={attachLink} className="h-10 rounded-xl bg-primary-700 px-4 text-xs font-bold text-white">Attach link</button></div>}
                  {emotionOpen && <div className="ml-14 mt-3 rounded-2xl border border-background-200 bg-background-100 p-3" role="group" aria-label="Choose a feeling or activity"><div className="mb-3 flex items-center justify-between gap-2"><div className="inline-flex rounded-xl border border-background-300 bg-white p-1"><button type="button" onClick={() => { setFeelingTab("feelings"); setEmotionSearch(""); }} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${feelingTab === "feelings" ? "bg-primary-700 text-white" : "text-foreground-500"}`}>Feelings</button><button type="button" onClick={() => { setFeelingTab("activities"); setEmotionSearch(""); }} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${feelingTab === "activities" ? "bg-primary-700 text-white" : "text-foreground-500"}`}>Activities</button></div>{(emotion || activity) && <button type="button" onClick={() => { setEmotion(""); setActivity(""); setEmotionSearch(""); setEmotionOpen(false); }} className="text-[10px] font-bold text-primary-700">Clear</button>}</div><label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-background-300 bg-white px-3 text-foreground-500 focus-within:border-primary-400"><i className="ri-search-line" /><input value={emotionSearch} onChange={(event) => setEmotionSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-foreground-800 outline-none" placeholder={`Search ${feelingOptions.length} ${feelingTab}…`} aria-label={`Search ${feelingTab}`} /></label><div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">{filteredFeelings.map((item) => <button key={item.value} type="button" onClick={() => { if (feelingTab === "feelings") { setEmotion(item.value); setActivity(""); } else { setActivity(item.value); setEmotion(""); } setEmotionSearch(""); setEmotionOpen(false); }} className={`inline-flex h-10 items-center justify-start gap-2 rounded-xl border px-3 text-xs font-semibold transition ${(emotion === item.value || activity === item.value) ? "border-primary-500 bg-primary-50 text-primary-800" : "border-background-300 bg-white text-foreground-700 hover:border-primary-300 hover:bg-primary-50/40"}`}><span className="text-base" aria-hidden="true">{item.emoji}</span><span className="truncate">{item.label}</span></button>)}</div>{!filteredFeelings.length && <p className="py-6 text-center text-xs text-foreground-500">No {feelingTab} match “{emotionSearch}”.</p>}</div>}
                  {locationOpen && <div className="ml-14 mt-3 rounded-2xl border border-background-200 bg-background-100 p-3"><button type="button" onClick={useCurrentLocation} disabled={locating} className="flex w-full items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3 text-left text-primary-800 transition hover:bg-primary-100 disabled:opacity-60"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-700 text-white"><i className={locating ? "ri-loader-4-line animate-spin" : "ri-crosshair-2-line"} /></span><span><span className="block text-xs font-bold">{locating ? "Finding your location…" : "Use current location"}</span><span className="mt-0.5 block text-[10px] text-foreground-500">Your browser will ask for permission</span></span></button><div className="my-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400"><span className="h-px flex-1 bg-background-300" />or enter a place<span className="h-px flex-1 bg-background-300" /></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-background-300 bg-white px-3 text-primary-700 focus-within:border-primary-400"><i className="ri-map-pin-2-line" /><input value={postLocation} onChange={(event) => { setPostLocation(event.target.value.slice(0, 120)); setLocationCoordinates(null); }} className="min-w-0 flex-1 bg-transparent text-sm text-foreground-800 outline-none" placeholder="Add a city, venue, or place" aria-label="Post location" /></label><button type="button" onClick={() => setLocationOpen(false)} className="h-10 rounded-xl bg-primary-700 px-4 text-xs font-bold text-white">Done</button></div></div>}
                  {mentionOpen && <div className="ml-14 mt-3 rounded-2xl border border-background-200 bg-background-100 p-3"><label className="flex h-10 items-center gap-2 rounded-xl border border-background-300 bg-white px-3 text-primary-700 focus-within:border-primary-400"><span className="text-base font-bold">@</span><input value={mentionSearch} onChange={(event) => setMentionSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-foreground-800 outline-none" placeholder="Search directory businesses" aria-label="Mention a business" /></label>{mentionSearch.trim().length >= 2 && <div className="mt-2 overflow-hidden rounded-xl border border-background-200 bg-white">{mentionResults.length ? mentionResults.map((item) => <button key={item.id || item.slug} type="button" disabled={mentionedBusinesses.some((mention) => String(mention.id) === String(item.id)) || mentionedBusinesses.length >= 10} onClick={() => { setMentionedBusinesses((current) => [...current, { id: item.id, slug: item.slug, title: item.title }]); setMentionSearch(""); setMentionResults([]); }} className="flex w-full items-center gap-3 border-b border-background-100 px-3 py-2.5 text-left last:border-0 hover:bg-primary-50 disabled:opacity-40"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-[10px] font-bold text-primary-700">{initials(item.title)}</span><span className="min-w-0"><span className="block truncate text-xs font-bold text-foreground-900">{item.title}</span><span className="block truncate text-[10px] text-foreground-500">{item.location || item.category}</span></span></button>) : <p className="px-3 py-4 text-center text-xs text-foreground-500">No businesses found.</p>}</div>}{!!mentionedBusinesses.length && <div className="mt-3 flex flex-wrap gap-2">{mentionedBusinesses.map((item) => <span key={item.id || item.slug} className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><span className="font-bold">@</span>{item.title}<button type="button" onClick={() => setMentionedBusinesses((current) => current.filter((mention) => String(mention.id) !== String(item.id)))} aria-label={`Remove ${item.title}`}><i className="ri-close-line" /></button></span>)}</div>}</div>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-background-200 pt-3">
                    <select aria-label="Business profile" value={listingId} onChange={(event) => setListingId(event.target.value)} className="h-10 max-w-52 rounded-xl border border-background-300 bg-white px-3 text-xs font-semibold">{listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                    <div className="flex flex-wrap gap-1 rounded-xl border border-background-200 bg-background-100 p-1" role="group" aria-label="Update type">{POST_TYPES.map((option) => <button key={option.value} type="button" aria-pressed={type === option.value} title={option.description} onClick={() => { setType(option.value); setMessage(""); }} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${type === option.value ? "bg-primary-700 text-white shadow-sm" : "text-foreground-600 hover:bg-white hover:text-primary-700"}`}><i className={option.icon} />{option.label}</button>)}</div>
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectMedia(event, "image")} className="sr-only" />
                    <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => selectMedia(event, "video")} className="sr-only" />
                    <div className="relative">
                      <button type="button" aria-haspopup="menu" aria-expanded={attachmentMenuOpen} onClick={() => setAttachmentMenuOpen((open) => !open)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${attachmentType || attachmentMenuOpen || linkOpen ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><i className="ri-attachment-2" />{attachmentType ? `${attachmentType === "image" ? "Photo" : attachmentType === "video" ? "Video" : "Link"} added` : "Attach"}<i className={`ri-arrow-${attachmentMenuOpen ? "up" : "down"}-s-line text-sm`} /></button>
                      {attachmentMenuOpen && <div role="menu" aria-label="Attach to update" className="absolute bottom-12 left-0 z-30 w-52 overflow-hidden rounded-2xl border border-background-200 bg-white p-1.5 shadow-[0_16px_45px_rgba(24,48,36,0.18)]">
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); imageInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-image-add-line" /></span><span><span className="block text-xs font-bold text-foreground-900">Photo</span><span className="block text-[10px] text-foreground-500">JPG, PNG, WebP or GIF</span></span></button>
                        <button type="button" role="menuitem" onClick={() => { setAttachmentMenuOpen(false); videoInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-video-add-line" /></span><span><span className="block text-xs font-bold text-foreground-900">Video</span><span className="block text-[10px] text-foreground-500">MP4, WebM or MOV</span></span></button>
                        <button type="button" role="menuitem" onClick={() => { setAttachment(null); setAttachmentType(""); setLinkOpen(true); setAttachmentMenuOpen(false); setMessage(""); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-links-line" /></span><span><span className="block text-xs font-bold text-foreground-900">Website link</span><span className="block text-[10px] text-foreground-500">Share a secure URL</span></span></button>
                      </div>}
                    </div>
                    <button type="button" onClick={() => { setEmotionSearch(""); setEmotionOpen((open) => !open); setLocationOpen(false); setMentionOpen(false); }} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${(emotion || activity) ? "bg-accent-50 text-foreground-800" : "text-foreground-500 hover:bg-background-100"}`}><span className="text-base" aria-hidden="true">{selectedEmotion?.emoji || selectedActivity?.emoji || "😊"}</span>{selectedEmotion?.label || selectedActivity?.label || "Feeling/activity"}</button>
                    <button type="button" onClick={() => { setLocationOpen((open) => !open); setEmotionOpen(false); setMentionOpen(false); }} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${postLocation ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><i className={`${locationCoordinates ? "ri-crosshair-2-line" : "ri-map-pin-2-line"} text-base`} /><span className="max-w-28 truncate">{postLocation || "Location"}</span></button>
                    <button type="button" onClick={() => { setMentionOpen((open) => !open); setEmotionOpen(false); setLocationOpen(false); }} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${mentionedBusinesses.length ? "bg-primary-50 text-primary-700" : "text-foreground-500 hover:bg-background-100"}`}><span className="text-base font-bold">@</span>{mentionedBusinesses.length ? `${mentionedBusinesses.length} mentioned` : "Mention business"}</button>
                    <button type="submit" disabled={submitting || !text.trim()} className="ml-auto h-10 rounded-xl bg-primary-700 px-5 text-xs font-bold text-white disabled:opacity-40">{submitting ? "Posting…" : selectedPostType.action}</button>
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
