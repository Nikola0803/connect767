import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const AI_LOGO_SRC = "/connect767-ai-logo-transparent.png?v=20261117";
const AI_COMMAND_LOGO_SRC = "/connect767-ai-command-logo.png?v=20261117";

const authHref = (mode) => {
  const fallback = "/uniforms";
  if (typeof window === "undefined") return `/auth/${mode}?redirect=${encodeURIComponent(fallback)}`;
  const currentPath = `${window.location.pathname || fallback}${window.location.search || ""}${window.location.hash || ""}`;
  const returnPath = currentPath.startsWith("/auth/") ? fallback : currentPath;
  return `/auth/${mode}?redirect=${encodeURIComponent(returnPath)}`;
};

const MODE_COPY = {
  uniform: {
    label: "Full uniform",
    icon: "ri-shirt-line",
    title: "Design Your Uniform",
    description: "Describe a complete kit, then refine the generated result with AI instructions.",
    placeholder: "Describe the uniform you want to design…",
  },
  artwork: {
    label: "Transparent artwork",
    icon: "ri-image-edit-line",
    title: "Create Transparent Artwork",
    description: "Describe a crest, sponsor mark, graphic or pattern. The AI will generate an isolated transparent asset.",
    placeholder: "Describe the crest, graphic or pattern you want…",
  },
};

const isBackgroundRemovalIntent = (value = "") => {
  const normalized = String(value).trim().toLowerCase();
  return /\b(remove|erase|delete)\s+(the\s+)?background\b/.test(normalized)
    || /\b(make|turn)\s+(this\s+|the\s+|my\s+)?(file|image|artwork|logo|photo)?\s*(background\s+)?transparent\b/.test(normalized);
};

const inferPromptMode = (value = "", currentMode = "uniform") => {
  const normalized = String(value).trim().toLowerCase();
  const explicitArtwork = /\b(transparent|standalone|isolated)\s+(artwork|graphic|logo|crest|badge|emblem|pattern|png)\b/.test(normalized)
    || /\b(create|design|generate|make)\s+(a\s+|an\s+)?(transparent\s+|standalone\s+|isolated\s+)?(team\s+|club\s+|sponsor\s+)?(logo|crest|badge|emblem|artwork|graphic)\b/.test(normalized)
    || /\b(logo|crest|badge|emblem)\s+(only|by itself|with a transparent background)\b/.test(normalized);
  const explicitUniform = /\b(full\s+)?(uniform|kit|jersey|shirt|shorts|pants|trousers|skirt|dress|tracksuit|teamwear|socks)\b/.test(normalized)
    || /\b(front|side|back)\s+views?\b/.test(normalized);
  if (explicitArtwork && !explicitUniform) return "artwork";
  if (explicitUniform) return "uniform";
  return currentMode;
};

function EmptyConversation({ dark, mode }) {
  const modeCopy = MODE_COPY[mode] || MODE_COPY.uniform;
  return (
    <div className="mx-auto flex h-full w-full max-w-sm items-center justify-center px-6 py-10 text-center">
      <div className="w-full">
        <img src={AI_COMMAND_LOGO_SRC} alt="Connect767 AI" className="mx-auto h-10 w-14 object-contain opacity-60 grayscale-[20%]" />
        <span className={`mt-4 block text-[8px] font-bold uppercase tracking-[0.22em] ${dark ? "text-primary-200/80" : "text-primary-700"}`}>AI Design Studio</span>
        <h3 className={`mt-2 font-heading text-xl font-semibold leading-tight ${dark ? "text-white" : "text-foreground-950"}`}>{modeCopy.title}</h3>
        <p className={`mx-auto mt-3 max-w-xs text-[10px] leading-relaxed ${dark ? "text-white/55" : "text-foreground-500"}`}>
          {modeCopy.description}
        </p>
        <div className={`mx-auto mt-5 grid max-w-xs grid-cols-3 divide-x border-y py-2.5 ${dark ? "divide-white/10 border-white/10" : "divide-background-200 border-background-200"}`} aria-label="AI design workflow">
          {[
            ["ri-image-add-line", "Reference"],
            ["ri-quill-pen-line", "Describe"],
            ["ri-sparkling-2-line", "Refine"],
          ].map(([icon, label]) => (
            <div key={label} className={`flex min-w-0 items-center justify-center gap-1.5 px-2 text-[8px] font-semibold ${dark ? "text-white/55" : "text-foreground-500"}`}>
              <i className={`${icon} text-primary-600`} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIUniformComposer({
  sport,
  mode,
  onModeChange,
  connection,
  brandName,
  onBrandNameChange,
  prompt,
  onPromptChange,
  isRefinement,
  generating,
  generationPhase = "",
  renderTier = "preview",
  canSend,
  onSend,
  onStop,
  style,
  styles,
  onStyleChange,
  reference,
  onReferenceFile,
  onRemoveReference,
  promptHistory,
  historyEntries = promptHistory,
  onReusePrompt,
  onClearHistory,
  error,
  onRetry,
  uniformPlan,
  artworkPreview,
  onPlaceArtwork,
  onClearArtwork,
  preservationControls,
  canUndo,
  onUndo,
  onNewChat,
  onClearCurrentDesign,
  versions = [],
  onRestoreVersion,
  onCompareVersions,
  comparisonActive = false,
  onGenerateVariation,
  onGenerateProof,
  onSaveDesign,
  onDownloadDesign,
  onDownloadPrompts,
  onOpenBackgroundRemoval,
  toolbarTarget,
  aiQuota,
  accountRequired = false,
  downloadUnlocked = true,
  onCompleteOrder,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const dark = false;
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(176, Math.max(42, textarea.scrollHeight))}px`;
  }, [prompt]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    if (typeof conversation.scrollTo === "function") {
      conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
    } else {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, [promptHistory.length, uniformPlan, artworkPreview, generating]);

  const submit = (requestedTier = "preview") => {
    if (!canSend || generating) return;
    if (isBackgroundRemovalIntent(prompt) && onOpenBackgroundRemoval) {
      closePopovers();
      onPromptChange("");
      onOpenBackgroundRemoval();
      return;
    }
    const inferredMode = inferPromptMode(prompt, mode);
    if (inferredMode !== mode) onModeChange(inferredMode);
    onSend(requestedTier, inferredMode, prompt.trim());
    onPromptChange("");
  };

  const closePopovers = () => {
    setToolsOpen(false);
    setHistoryOpen(false);
    setSettingsOpen(false);
    setToolbarMenuOpen(false);
  };

  useEffect(() => {
    const dismissBannerPopovers = (event) => {
      if (event.target.closest?.("[data-ai-popover], [data-ai-popover-trigger]")) return;
      closePopovers();
    };
    const dismissWithEscape = (event) => {
      if (event.key === "Escape") closePopovers();
    };
    document.addEventListener("pointerdown", dismissBannerPopovers);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissBannerPopovers);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSurfacePointerDown = (event) => {
    if (event.target.closest("[data-ai-popover], [data-ai-popover-trigger]")) return;
    closePopovers();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit("preview");
    }
    if (event.key === "Escape") {
      closePopovers();
    }
  };

  const acceptDroppedFile = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onReferenceFile(file);
  };

  const reuse = (entry) => {
    onReusePrompt(entry);
    setHistoryOpen(false);
    textareaRef.current?.focus();
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* Clipboard access can be blocked by the browser. */ }
  };

  const focusCommandPrompt = () => {
    textareaRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    textareaRef.current?.focus();
  };

  const hasConversation = promptHistory.length > 0 || uniformPlan || artworkPreview || generating;
  const previousVersion = versions.length > 1 ? versions[versions.length - 2] : null;
  const originalVersion = versions[0] || null;
  const surface = dark ? "bg-[#11140f] text-white" : "bg-[#f8f7f2] text-foreground-950";
  const card = dark ? "border-white/10 bg-white/[0.055] text-white" : "border-background-200 bg-white text-foreground-950";
  const muted = dark ? "text-white/50" : "text-foreground-500";

  const bannerCommands = toolbarTarget ? createPortal(
    <div className="relative flex shrink-0 flex-nowrap items-center justify-start gap-1.5" data-ai-popover>
      <div className="relative" data-ai-popover>
        <button
          type="button"
          onClick={() => {
            setToolbarMenuOpen((value) => !value);
            setHistoryOpen(false);
            setToolsOpen(false);
            setSettingsOpen(false);
          }}
          className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-[8px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="AI tools"
          aria-expanded={toolbarMenuOpen}
          aria-haspopup="menu"
          data-ai-popover-trigger
        >
          <i className="ri-tools-line text-[10px]" /> AI tools <i className="ri-arrow-down-s-line" />
        </button>
        {toolbarMenuOpen && (
          <div className="absolute left-0 top-[calc(100%+.4rem)] z-50 grid w-56 gap-1 rounded-xl border border-background-200 bg-white p-2 text-foreground-950 shadow-2xl" data-ai-popover role="menu" aria-label="AI prompt tools menu">
            <button type="button" onClick={() => { setToolbarMenuOpen(false); setHistoryOpen(true); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100" role="menuitem"><i className="ri-history-line text-sm" /> History</button>
            <button type="button" onClick={() => { setToolbarMenuOpen(false); fileInputRef.current?.click(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100" role="menuitem"><i className="ri-image-add-line text-sm" /> Reference</button>
            <button type="button" onClick={() => { setToolbarMenuOpen(false); focusCommandPrompt(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold text-primary-800 hover:bg-primary-50" role="menuitem"><i className="ri-magic-line text-sm" /> Refine with AI</button>
            <button type="button" onClick={() => { setToolbarMenuOpen(false); onOpenBackgroundRemoval?.(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100" role="menuitem"><i className="ri-eraser-line text-sm" /> Remove background / Make transparent</button>
            <div className="my-1 border-t border-background-200" />
            <button type="button" onClick={() => { setToolbarMenuOpen(false); onSaveDesign?.(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100" role="menuitem"><i className="ri-save-3-line text-sm" /> Save design</button>
            <button type="button" onClick={() => { setToolbarMenuOpen(false); if (downloadUnlocked) onDownloadDesign?.(); else onCompleteOrder?.(); }} disabled={!uniformPlan && !artworkPreview} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" role="menuitem"><i className={downloadUnlocked ? "ri-download-2-line text-sm" : "ri-lock-line text-sm"} /> {downloadUnlocked ? "Download design" : "Unlock after payment"}</button>
            <button type="button" onClick={() => { setToolbarMenuOpen(false); onDownloadPrompts?.(); }} disabled={!historyEntries.length} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" role="menuitem"><i className="ri-file-download-line text-sm" /> Download prompts</button>
            <button type="button" onClick={() => { setToolbarMenuOpen(false); setSettingsOpen(true); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100" role="menuitem"><i className="ri-settings-3-line text-sm" /> Settings</button>
            {(uniformPlan || artworkPreview) && <button type="button" onClick={() => { setToolbarMenuOpen(false); onClearCurrentDesign?.(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-red-50 hover:text-red-700" role="menuitem"><i className="ri-delete-bin-6-line text-sm" /> Clear current design</button>}
            {mode === "uniform" && uniformPlan && <>
              <div className="my-1 border-t border-background-200" />
              <p className="px-3 pb-1 pt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-foreground-500">Versions</p>
              <button type="button" onClick={() => { setToolbarMenuOpen(false); if (previousVersion) onRestoreVersion?.(previousVersion); }} disabled={!previousVersion || generating} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" role="menuitem"><i className="ri-arrow-left-line" /> Previous version</button>
              <button type="button" onClick={() => { setToolbarMenuOpen(false); onCompareVersions?.(comparisonActive ? null : previousVersion); }} disabled={!previousVersion || generating} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" role="menuitem"><i className="ri-split-cells-horizontal" /> {comparisonActive ? "Close comparison" : "Compare versions"}</button>
              <button type="button" onClick={() => { setToolbarMenuOpen(false); if (originalVersion) onRestoreVersion?.(originalVersion); }} disabled={!originalVersion || versions.length < 2 || generating} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" role="menuitem"><i className="ri-restart-line" /> Restore original</button>
              <button type="button" onClick={() => { setToolbarMenuOpen(false); onGenerateVariation?.(); }} disabled={generating || connection !== "connected"} className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-left text-[9px] font-bold text-primary-800 hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-40" role="menuitem"><i className="ri-refresh-line" /> New variation</button>
            </>}
          </div>
        )}
      </div>
    </div>,
    toolbarTarget,
  ) : null;

  return (
    <section onPointerDown={handleSurfacePointerDown} className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden transition-colors ${surface}`} aria-label="Connect767 AI uniform designer">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onReferenceFile(file);
        }}
      />

      {bannerCommands}

      {!toolbarTarget && <header className={`flex flex-shrink-0 items-center justify-between gap-3 border-b px-4 py-3 ${dark ? "border-white/10" : "border-background-200"}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src={AI_LOGO_SRC} alt="Connect767 AI" className="h-8 w-12 shrink-0 object-contain drop-shadow-sm" />
              <span className={`h-1.5 w-1.5 rounded-full ${connection === "connected" ? "bg-emerald-500" : connection === "checking" ? "bg-amber-400" : "bg-red-400"}`} />
            </div>
            <p className={`truncate text-[9px] ${muted}`}>Uniform Design Assistant · {MODE_COPY[mode].label}</p>
          </div>
        </div>
      </header>}

      {historyOpen && (
        <aside data-ai-popover className={`absolute inset-x-3 top-[68px] z-30 max-h-[60%] overflow-hidden rounded-2xl border shadow-2xl ${card}`} aria-label="AI design conversation history">
          <div className="flex items-center justify-between border-b border-current/10 px-3 py-2.5">
              <div><strong className="block text-xs">Design History</strong><span className={`text-[9px] ${muted}`}>{historyEntries.length} saved {historyEntries.length === 1 ? "prompt" : "prompts"}</span></div>
            <button type="button" onClick={onClearHistory} disabled={!historyEntries.length} className="cursor-pointer text-[9px] font-bold text-foreground-400 hover:text-red-600 disabled:opacity-40">Clear</button>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto p-2">
            {historyEntries.length ? historyEntries.map((entry) => (
              <button key={entry.id} type="button" onClick={() => reuse(entry)} className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition hover:bg-primary-50">
                <span className="flex items-center justify-between gap-2"><strong className="text-[9px] uppercase tracking-wide text-primary-700">{entry.kind}</strong><span className={`text-[8px] ${muted}`}>{new Date(entry.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span>
                <span className="mt-1 line-clamp-2 block text-[10px] leading-relaxed">{entry.prompt}</span>
              </button>
            )) : <p className={`px-3 py-8 text-center text-[10px] ${muted}`}>Your successful prompts will appear here.</p>}
          </div>
        </aside>
      )}

      <div ref={conversationRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-live="polite">
        {!hasConversation ? <EmptyConversation dark={dark} mode={mode} /> : (
          <div className="mx-auto max-w-xl space-y-4">
            {[...promptHistory].reverse().map((entry) => (
              <div key={entry.id} className="space-y-2">
                <div className="ml-auto max-w-[88%] break-words rounded-2xl rounded-br-md bg-primary-700 px-3.5 py-2.5 text-[11px] leading-relaxed text-white shadow-sm">
                  {entry.prompt}
                </div>
                {entry.response && (
                  <div className={`max-w-[92%] break-words rounded-2xl rounded-bl-md border px-3.5 py-3 text-[11px] leading-relaxed ${card}`}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary-700"><img src={AI_LOGO_SRC} alt="Connect767 AI" className="h-5 w-5 object-contain" /> AI response</div>
                    <p className={muted}>{entry.response}</p>
                    <div className="mt-2 flex items-center gap-1 text-foreground-400">
                      <button type="button" onClick={() => copyText(entry.response)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5" aria-label="Copy response"><i className="ri-file-copy-line" /></button>
                      <button type="button" onClick={() => setFeedback(feedback === `${entry.id}:up` ? "" : `${entry.id}:up`)} className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5 ${feedback === `${entry.id}:up` ? "text-primary-700" : ""}`} aria-label="Helpful response"><i className="ri-thumb-up-line" /></button>
                      <button type="button" onClick={() => setFeedback(feedback === `${entry.id}:down` ? "" : `${entry.id}:down`)} className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5 ${feedback === `${entry.id}:down` ? "text-accent-500" : ""}`} aria-label="Unhelpful response"><i className="ri-thumb-down-line" /></button>
                      <button type="button" onClick={() => reuse(entry)} className="ml-1 cursor-pointer text-[9px] font-bold hover:text-primary-700"><i className="ri-refresh-line" /> Reuse</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {generating && (
              <div className={`inline-flex items-center gap-2 rounded-2xl rounded-bl-md border px-3.5 py-3 text-[11px] ${card}`}>
                <span className="flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600 [animation-delay:-.3s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600 [animation-delay:-.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600" /></span>
                <span className={muted}>{generationPhase || (mode === "uniform" ? "Designing your uniform…" : "Creating transparent artwork…")}</span>
              </div>
            )}

            {artworkPreview && !generating && (
              <article className={`rounded-2xl border p-3 shadow-sm ${card}`}>
                <div className="rounded-xl bg-[linear-gradient(45deg,#ece9e1_25%,transparent_25%),linear-gradient(-45deg,#ece9e1_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ece9e1_75%),linear-gradient(-45deg,transparent_75%,#ece9e1_75%)] bg-[length:18px_18px] p-2"><img src={artworkPreview.src} alt="Generated transparent uniform artwork" className="mx-auto max-h-52 w-full object-contain" /></div>
                <div className="mt-3 flex gap-2"><button type="button" onClick={() => onPlaceArtwork(artworkPreview)} className="flex-1 cursor-pointer rounded-xl bg-primary-700 px-3 py-2.5 text-[10px] font-bold text-white hover:bg-primary-800"><i className="ri-add-circle-line mr-1" /> Place on uniform</button><button type="button" onClick={onClearArtwork} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-background-300" aria-label="Remove artwork preview"><i className="ri-delete-bin-line" /></button></div>
              </article>
            )}
          </div>
        )}
      </div>

      <div role="region" aria-label="AI command prompt" className={`relative min-w-0 flex-shrink-0 border-t px-2 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-3 sm:pb-[max(.75rem,env(safe-area-inset-bottom))] ${dark ? "border-white/10 bg-[#11140f]" : "border-background-200 bg-[#f8f7f2]"}`}>
        {error && <div role="alert" className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700"><span>{error}</span><button type="button" onClick={onRetry} className="shrink-0 cursor-pointer font-bold underline">Retry</button></div>}
        {accountRequired && <div role="alert" className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] text-amber-950"><strong className="block">Account Required</strong><span>Sign in or create an account before starting, saving or ordering a design.</span><div className="mt-2 flex gap-2"><a href={authHref("register")} className="rounded-lg bg-primary-700 px-2.5 py-1.5 font-bold text-white">Create Account</a><a href={authHref("login")} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-bold">Sign In</a></div></div>}
        {(uniformPlan || artworkPreview) && !downloadUnlocked && (
          <div role="status" className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-background-300 bg-white px-3 py-2 text-[10px] text-background-800">
            <span><i className="ri-lock-line mr-1 text-primary-700" />Complete your order to unlock high-resolution downloads and production-ready design files.</span>
            <button type="button" onClick={onCompleteOrder} className="shrink-0 rounded-lg bg-primary-700 px-2.5 py-1.5 font-bold text-white">Complete Order</button>
          </div>
        )}
        {(uniformPlan || artworkPreview) && renderTier === "preview" && !generating && (
          <div role="status" className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-[10px] text-primary-950">
            <span><i className="ri-flashlight-line mr-1 text-primary-700" />Fast preview ready. Render the final image when the direction is approved.</span>
            <button type="button" onClick={onGenerateProof} className="shrink-0 rounded-lg bg-primary-700 px-2.5 py-1.5 font-bold text-white hover:bg-primary-800">Final proof</button>
          </div>
        )}

        {settingsOpen && (
          <div data-ai-popover className={`absolute bottom-[calc(100%-4px)] left-3 right-3 z-20 max-h-72 overflow-y-auto rounded-2xl border p-3 shadow-2xl ${card}`}>
            <div className="flex items-center justify-between"><strong className="text-xs">Design Controls</strong><button type="button" onClick={() => setSettingsOpen(false)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5" aria-label="Close design controls"><i className="ri-close-line" /></button></div>
            <label className={`mt-3 block text-[9px] font-bold uppercase tracking-wide ${muted}`}>Team or brand</label>
            <input value={brandName} onChange={(event) => onBrandNameChange(event.target.value)} placeholder="e.g. Riverside FC" maxLength={80} className="mt-1 w-full rounded-xl border border-background-300 bg-white px-3 py-2.5 text-xs text-foreground-950 outline-none focus:border-primary-500" />
            <label className={`mt-3 block text-[9px] font-bold uppercase tracking-wide ${muted}`}>Creative direction</label>
            <select value={style} onChange={(event) => onStyleChange(event.target.value)} className="mt-1 w-full rounded-xl border border-background-300 bg-white px-3 py-2.5 text-xs text-foreground-950 outline-none focus:border-primary-500">{styles.map((option) => <option key={option}>{option}</option>)}</select>
            <div className="mt-3">{preservationControls}</div>
            {canUndo && <button type="button" onClick={onUndo} className="mt-3 w-full cursor-pointer rounded-xl border border-background-300 px-3 py-2 text-[10px] font-bold hover:bg-background-100"><i className="ri-arrow-go-back-line mr-1" /> Undo last AI design</button>}
          </div>
        )}

        {toolsOpen && (
          <div data-ai-popover className={`absolute bottom-[calc(100%-4px)] left-2 right-2 z-30 overflow-hidden rounded-2xl border p-2 shadow-2xl sm:left-3 sm:right-auto sm:w-64 ${card}`} role="menu" aria-label="AI composer tools">
            <button type="button" onClick={() => { fileInputRef.current?.click(); setToolsOpen(false); }} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className="ri-image-add-line" /></span><span><strong className="block text-[10px]">Upload Inspiration Image</strong><span className={`text-[8px] ${muted}`}>PNG, JPG or WebP · up to 10 MB</span></span></button>
            {mode === "artwork" && <button type="button" onClick={() => { onModeChange("uniform"); setToolsOpen(false); }} className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className="ri-shirt-line" /></span><span><strong className="block text-[10px]">Design Full Uniform</strong><span className={`text-[8px] ${muted}`}>Return to the complete kit designer</span></span></button>}
            {mode === "uniform" && !uniformPlan && <button type="button" onClick={() => { onModeChange("artwork"); setToolsOpen(false); }} className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><i className="ri-image-edit-line" /></span><span><strong className="block text-[10px]">Create Transparent Artwork</strong><span className={`text-[8px] ${muted}`}>Generate artwork to place on the kit</span></span></button>}
          </div>
        )}

        <div
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={acceptDroppedFile}
          className={`relative mx-auto w-full min-w-0 max-w-xl rounded-2xl border bg-white shadow-[0_4px_18px_rgba(31,43,35,.06)] transition ${dragging ? "border-primary-500 ring-4 ring-primary-100" : "border-background-300 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100"}`}
        >
          {typeof aiQuota?.remaining === "number" && <div className="flex items-center justify-between border-b border-background-200 px-3 py-1.5 text-[8px] font-semibold text-foreground-500"><span>{aiQuota.authenticated ? "Daily AI allowance" : "Free AI previews"}</span><span>{aiQuota.remaining} of {aiQuota.limit} remaining</span></div>}
          {dragging && <div className="absolute inset-1 z-10 flex items-center justify-center rounded-[18px] border-2 border-dashed border-primary-400 bg-primary-50/95 text-xs font-bold text-primary-800"><i className="ri-upload-cloud-2-line mr-2" /> Drop an image to use as reference</div>}
          {reference && <div className="flex items-center gap-2 border-b border-background-200 px-3 py-2"><img src={reference.src} alt="Attached uniform reference" className="h-9 w-9 rounded-lg border border-background-200 object-cover" /><div className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-foreground-700">{reference.name}</strong><span className="block text-[8px] text-foreground-400">Reference image</span></div><button type="button" onClick={onRemoveReference} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-foreground-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove reference image"><i className="ri-close-line" /></button></div>}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRefinement ? "Describe only what should change…" : MODE_COPY[mode].placeholder}
            maxLength={mode === "uniform" ? 900 : 600}
            rows={1}
            className="block min-h-[42px] w-full min-w-0 resize-none overflow-y-auto rounded-t-2xl bg-transparent px-4 pb-1 pt-3 text-xs leading-relaxed text-foreground-950 outline-none placeholder:text-foreground-400"
            aria-label="Message Connect767 AI"
          />
          <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 px-2 pb-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <button type="button" onClick={() => { setToolsOpen((value) => !value); setHistoryOpen(false); setSettingsOpen(false); }} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-background-200 bg-background-50 text-sm text-foreground-700 transition hover:bg-background-100" aria-label="Add attachment or AI tool" aria-expanded={toolsOpen} data-ai-popover-trigger><i className={toolsOpen ? "ri-close-line" : "ri-add-line"} /></button>
            </div>
            {generating && (
              <button type="button" onClick={onStop} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground-950 text-white transition hover:bg-red-600" aria-label="Stop generating"><i className="ri-stop-fill" /></button>
            )}
          </div>
        </div>
        <p className={`mx-auto mt-2 max-w-md break-words px-1 text-center text-[8px] leading-relaxed ${muted}`}>Enter creates a fast preview · Shift + Enter adds a new line · Final proof renders at high quality</p>
      </div>
    </section>
  );
}
