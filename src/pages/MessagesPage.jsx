import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getMessageThread, getMessageThreads, sendMessage, startMessageThread } from "../data/repository";
import { isLiveApi } from "../lib/config";

const relativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(hours, "hour");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MESSAGE_EMOJIS = ["😀", "😊", "😂", "❤️", "👍", "👏", "🙏", "🎉", "✨", "📌", "📎", "✅"];
const ACCEPTED_ATTACHMENTS = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function MessageAttachments({ attachments = [], mine = false }) {
  if (!attachments.length) return null;
  return (
    <div className={`mt-2 grid gap-2 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {attachments.map((attachment) => (
        attachment.isImage ? (
          <a key={attachment.id || attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/20 bg-black/5">
            <img src={attachment.url} alt={attachment.name || "Message attachment"} className="max-h-56 w-full object-cover" />
            <span className={`block truncate px-2.5 py-2 text-[10px] ${mine ? "text-background-50/80" : "text-foreground-600"}`}>{attachment.name}</span>
          </a>
        ) : (
          <a key={attachment.id || attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 ${mine ? "border-white/20 bg-white/10 text-background-50" : "border-background-200 bg-background-100 text-foreground-800"}`}>
            <i className="ri-file-line text-lg" />
            <span className="min-w-0"><span className="block truncate text-xs font-semibold">{attachment.name}</span><span className={`block text-[10px] ${mine ? "text-background-50/70" : "text-foreground-400"}`}>{formatFileSize(attachment.size)}</span></span>
            <i className="ri-download-2-line ml-auto flex-shrink-0" />
          </a>
        )
      ))}
    </div>
  );
}

export default function MessagesPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const listingSlug = searchParams.get("listing") || "";
  const listingTitle = searchParams.get("title") || "Listing owner";
  const requestedThread = searchParams.get("thread") || "";
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const draftRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      const result = await getMessageThreads();
      setThreads(result || []);
      return result || [];
    } catch (requestError) {
      setError(requestError.message || "Couldn't load your messages.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const openThread = useCallback(async (threadId, updateUrl = true) => {
    if (!threadId) return;
    setThreadLoading(true);
    setError("");
    try {
      const result = await getMessageThread(threadId);
      setActiveThread(result);
      setThreads((items) => items.map((item) => String(item.id) === String(threadId) ? { ...item, unread: false } : item));
      if (updateUrl) setSearchParams({ thread: String(threadId) });
    } catch (requestError) {
      setError(requestError.message || "Couldn't open this conversation.");
    } finally {
      setThreadLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadThreads().then((items) => {
      if (requestedThread) openThread(requestedThread, false);
      else if (!listingSlug && items[0]) openThread(items[0].id, false);
    });
  }, [isAuthenticated, listingSlug, loadThreads, openThread, requestedThread]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeThread?.messages?.length]);

  useEffect(() => {
    if (!isAuthenticated || !isLiveApi) return undefined;
    const timer = window.setInterval(() => {
      loadThreads();
      if (activeThread?.id) openThread(activeThread.id, false);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [activeThread?.id, isAuthenticated, loadThreads, openThread]);

  if (!isAuthenticated) return <Navigate to="/auth/login" state={{ from: location.pathname + location.search }} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !attachments.length) || sending) return;
    setSending(true);
    setError("");
    try {
      if (activeThread?.id) {
        const created = await sendMessage(activeThread.id, message, attachments);
        setActiveThread((thread) => ({ ...thread, messages: [...thread.messages, created] }));
      } else if (listingSlug) {
        const created = await startMessageThread({ listingSlug, listingTitle, message, attachments });
        setActiveThread(created);
        setSearchParams({ thread: String(created.id) });
      }
      setDraft("");
      setAttachments([]);
      setEmojiOpen(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      await loadThreads();
    } catch (requestError) {
      setError(requestError.message || "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  };

  const chooseAttachments = (event) => {
    const incoming = Array.from(event.target.files || []);
    setError("");
    if (attachments.length + incoming.length > MAX_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files to one message.`);
      event.target.value = "";
      return;
    }
    const oversized = incoming.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (oversized) {
      setError(`${oversized.name} is larger than the 10 MB attachment limit.`);
      event.target.value = "";
      return;
    }
    setAttachments((current) => [...current, ...incoming]);
    event.target.value = "";
  };

  const addEmoji = (emoji) => {
    setDraft((value) => `${value}${emoji}`);
    setEmojiOpen(false);
    window.setTimeout(() => draftRef.current?.focus(), 0);
  };

  const composingNew = Boolean(listingSlug && !activeThread);

  return (
    <div className="pt-16 md:pt-20 min-h-screen bg-background-100/40">
      <section className="border-b border-background-200/70 bg-background-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-7 md:py-9 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 mb-2"><i className="ri-chat-3-line text-base" /> Private messaging</div>
            <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">Messages</h1>
            <p className="mt-1 text-sm text-foreground-600 font-label">Keep listing and booking conversations together in one secure place.</p>
          </div>
          <Link to="/listings" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800">Browse directory <i className="ri-arrow-right-line" /></Link>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-6 md:py-8">
        {error && <div className="mb-4 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800 flex items-start gap-2"><i className="ri-error-warning-line mt-0.5" /> {error}</div>}

        <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-background-200/80 bg-background-50 shadow-sm lg:grid-cols-[360px_1fr]">
          <aside className={`border-r border-background-200/70 ${activeThread || composingNew ? "hidden lg:block" : "block"}`}>
            <div className="flex h-16 items-center justify-between border-b border-background-200/70 px-5">
              <h2 className="font-heading text-lg font-medium text-foreground-950">Conversations</h2>
              <button type="button" onClick={loadThreads} className="h-9 w-9 rounded-full text-foreground-500 hover:bg-background-100 hover:text-primary-700" aria-label="Refresh conversations"><i className="ri-refresh-line" /></button>
            </div>
            {loading ? (
              <div className="space-y-3 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-background-100" />)}</div>
            ) : threads.length === 0 ? (
              <div className="px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700"><i className="ri-chat-new-line text-xl" /></div><h3 className="font-heading text-lg text-foreground-950">No conversations yet</h3><p className="mt-2 text-sm leading-relaxed text-foreground-600">Open a directory profile and select Message to contact its owner.</p></div>
            ) : (
              <div className="divide-y divide-background-100 overflow-y-auto max-h-[620px]">
                {threads.map((thread) => (
                  <button key={thread.id} type="button" onClick={() => openThread(thread.id)} className={`w-full px-5 py-4 text-left transition-colors hover:bg-background-100/70 ${String(activeThread?.id) === String(thread.id) ? "bg-primary-50/70" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800">{(thread.otherParticipant || "?")[0].toUpperCase()}</div>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-foreground-950">{thread.otherParticipant}</p><span className="ml-auto flex-shrink-0 text-[10px] text-foreground-400">{relativeTime(thread.lastMessageAt)}</span></div><p className="mt-0.5 truncate text-xs font-medium text-primary-700">{thread.listingTitle}</p><div className="mt-1 flex items-center gap-2"><p className={`truncate text-xs ${thread.unread ? "font-semibold text-foreground-900" : "text-foreground-500"}`}>{thread.lastMessage}</p>{thread.unread && <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-accent-500" />}</div></div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className={`${activeThread || composingNew ? "flex" : "hidden lg:flex"} min-w-0 flex-col`}>
            {threadLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin" /> Loading conversation…</div>
            ) : activeThread || composingNew ? (
              <>
                <header className="flex h-16 items-center gap-3 border-b border-background-200/70 px-4 sm:px-6">
                  <button type="button" onClick={() => { setActiveThread(null); setSearchParams({}); }} className="lg:hidden h-9 w-9 rounded-full hover:bg-background-100" aria-label="Back to conversations"><i className="ri-arrow-left-line" /></button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800">{(activeThread?.otherParticipant || listingTitle || "?")[0].toUpperCase()}</div>
                  <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-foreground-950">{activeThread?.otherParticipant || listingTitle}</h2><Link to={`/listings/${activeThread?.listingSlug || listingSlug}`} className="block truncate text-xs text-primary-700 hover:underline">{activeThread?.listingTitle || listingTitle}</Link></div>
                  <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[10px] font-semibold text-primary-800"><i className="ri-lock-2-line" /> Private conversation</span>
                </header>

                <div className="flex-1 overflow-y-auto bg-background-100/35 px-4 py-6 sm:px-7">
                  {composingNew && <div className="mx-auto mb-6 max-w-md rounded-xl border border-primary-200 bg-primary-50/70 p-4 text-center text-xs leading-relaxed text-foreground-700"><i className="ri-shield-check-line mr-1 text-primary-700" /> Your message will be shared only with this listing owner.</div>}
                  <div className="space-y-4">
                    {(activeThread?.messages || []).map((message) => (
                      <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${message.mine ? "rounded-br-md bg-primary-700 text-background-50" : "rounded-bl-md border border-background-200/70 bg-background-50 text-foreground-800"}`}>{message.body && <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>}<MessageAttachments attachments={message.attachments} mine={message.mine} /><p className={`mt-1.5 text-[10px] ${message.mine ? "text-background-50/70" : "text-foreground-400"}`}>{relativeTime(message.createdAt)}</p></div></div>
                    ))}
                    <div ref={endRef} />
                  </div>
                </div>

                <form onSubmit={submit} className="border-t border-background-200/70 bg-background-50 p-4 sm:p-5">
                  {attachments.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{attachments.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-2 rounded-xl border border-background-200 bg-background-100 px-3 py-2 text-xs text-foreground-700"><i className={file.type.startsWith("image/") ? "ri-image-line text-primary-700" : "ri-file-line text-primary-700"} /><span className="max-w-48 truncate font-medium">{file.name}</span><span className="text-foreground-400">{formatFileSize(file.size)}</span><button type="button" onClick={() => setAttachments((files) => files.filter((_, itemIndex) => itemIndex !== index))} className="ml-1 text-foreground-400 hover:text-accent-700" aria-label={`Remove ${file.name}`}><i className="ri-close-line" /></button></div>)}</div>}
                  <div className="relative flex items-end gap-2 rounded-2xl border border-background-300 bg-background-50 p-2 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                    <input ref={attachmentInputRef} type="file" multiple accept={ACCEPTED_ATTACHMENTS} onChange={chooseAttachments} className="sr-only" />
                    <button type="button" onClick={() => attachmentInputRef.current?.click()} disabled={sending || attachments.length >= MAX_ATTACHMENTS} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-foreground-500 hover:bg-background-100 hover:text-primary-700 disabled:opacity-40" aria-label="Attach files" title="Attach up to 5 files"><i className="ri-attachment-2" /></button>
                    <button type="button" onClick={() => setEmojiOpen((open) => !open)} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-foreground-500 hover:bg-background-100 hover:text-primary-700" aria-label="Add emoji"><i className="ri-emotion-happy-line" /></button>
                    {emojiOpen && <div className="absolute bottom-14 left-10 z-20 grid w-52 grid-cols-6 gap-1 rounded-2xl border border-background-200 bg-background-50 p-3 shadow-xl">{MESSAGE_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => addEmoji(emoji)} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-primary-50" aria-label={`Add ${emoji}`}>{emoji}</button>)}</div>}
                    <textarea ref={draftRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(event); } }} maxLength={4000} rows={1} placeholder={composingNew ? `Message ${listingTitle}` : "Write a message…"} className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400" />
                    <button type="submit" disabled={(!draft.trim() && !attachments.length) || sending} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-background-50 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><i className={sending ? "ri-loader-4-line animate-spin" : "ri-send-plane-2-fill"} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-foreground-400"><span>Enter to send · Attach up to 5 files, 10 MB each</span><span>{draft.length}/4000</span></div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-8 text-center"><div><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><i className="ri-chat-smile-3-line text-2xl" /></div><h2 className="font-heading text-xl font-medium text-foreground-950">Your Connect767 inbox</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground-600">Select a conversation to discuss a listing, service, rental, or booking.</p></div></div>
            )}
          </main>
        </div>
        <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs text-foreground-500"><i className="ri-information-line mt-0.5" /> Never send card numbers, passwords, or banking details in a message.</p>
      </div>
    </div>
  );
}
