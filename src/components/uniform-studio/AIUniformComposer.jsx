import { useEffect, useRef, useState } from "react";

const AI_LOGO_SRC = "/connect767-ai-logo-transparent.png?v=20261117";
const AI_COMMAND_LOGO_SRC = "/connect767-ai-command-logo.png?v=20261117";

const MODE_COPY = {
  uniform: {
    label: "Full uniform",
    icon: "ri-shirt-line",
    placeholder: "Describe the uniform you want to design…",
  },
  artwork: {
    label: "Transparent artwork",
    icon: "ri-image-edit-line",
    placeholder: "Describe the crest, graphic or pattern you want…",
  },
};

function EmptyConversation({ dark }) {
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center px-5 py-8 text-center">
      <img src={AI_COMMAND_LOGO_SRC} alt="Connect767 AI" className="h-28 w-44 object-contain drop-shadow-[0_12px_24px_rgba(0,116,73,.18)]" />
      <h3 className={`mt-4 font-heading text-xl font-semibold ${dark ? "text-white" : "text-foreground-950"}`}>Design your uniform</h3>
      <p className={`mt-2 text-[11px] leading-relaxed ${dark ? "text-white/55" : "text-foreground-500"}`}>
        Describe a complete kit or create transparent artwork. Full-uniform results open as AI-only previews and can be changed with AI instructions.
      </p>
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
  canSend,
  onSend,
  renderTier = "preview",
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
  onSavePreview,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetMenuOpen, setResetMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    textarea.style.height = `${Math.min(176, Math.max(48, textarea.scrollHeight))}px`;
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
    if (canSend && !generating) onSend(requestedTier);
  };

  const closePopovers = () => {
    setToolsOpen(false);
    setHistoryOpen(false);
    setResetMenuOpen(false);
    setSettingsOpen(false);
  };

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

  const startDesign = (nextMode) => {
    closePopovers();
    onModeChange(nextMode);
    onNewChat();
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* Clipboard access can be blocked by the browser. */ }
  };

  const hasConversation = promptHistory.length > 0 || uniformPlan || artworkPreview || generating;
  const previousVersion = versions.length > 1 ? versions[versions.length - 2] : null;
  const originalVersion = versions[0] || null;
  const surface = dark ? "bg-[#11140f] text-white" : "bg-[#f8f7f2] text-foreground-950";
  const card = dark ? "border-white/10 bg-white/[0.055] text-white" : "border-background-200 bg-white text-foreground-950";
  const muted = dark ? "text-white/50" : "text-foreground-500";

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

      <header className={`flex flex-shrink-0 items-center justify-between gap-3 border-b px-4 py-3 ${dark ? "border-white/10" : "border-background-200"}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src={AI_LOGO_SRC} alt="Connect767 AI" className="h-8 w-12 shrink-0 object-contain drop-shadow-sm" />
              <span className={`h-1.5 w-1.5 rounded-full ${connection === "connected" ? "bg-emerald-500" : connection === "checking" ? "bg-amber-400" : "bg-red-400"}`} />
            </div>
            <p className={`truncate text-[9px] ${muted}`}>Uniform design assistant · {MODE_COPY[mode].label}</p>
          </div>
        </div>
        <div className="relative flex items-center">
          <div className="flex h-9 overflow-hidden rounded-xl bg-primary-700 text-white shadow-sm">
            <button
              type="button"
              onClick={() => { closePopovers(); onNewChat(); }}
              className="inline-flex cursor-pointer items-center gap-1.5 px-3 text-[10px] font-bold transition hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
            >
              <i className="ri-chat-new-line" /> New design
            </button>
            <button
              type="button"
              onClick={() => {
                setResetMenuOpen((value) => !value);
                setHistoryOpen(false);
                setToolsOpen(false);
                setSettingsOpen(false);
              }}
              className="flex w-8 cursor-pointer items-center justify-center border-l border-white/20 transition hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
              aria-label="Open design reset options"
              aria-expanded={resetMenuOpen}
              aria-haspopup="menu"
              data-ai-popover-trigger
            >
              <i className="ri-arrow-down-s-line" />
            </button>
          </div>

          {resetMenuOpen && (
            <div data-ai-popover className={`absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border p-1.5 shadow-2xl ${card}`} role="menu" aria-label="Design reset options">
              <p className={`px-3 pb-1 pt-1.5 text-[8px] font-bold uppercase tracking-[0.14em] ${muted}`}>Create new</p>
              <button
                type="button"
                onClick={() => startDesign("uniform")}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold transition hover:bg-primary-50 hover:text-primary-800"
                role="menuitem"
              >
                <i className="ri-shirt-line text-sm" />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2"><span>Full uniform</span>{mode === "uniform" && <i className="ri-check-line text-primary-700" />}</span>
              </button>
              <button
                type="button"
                onClick={() => startDesign("artwork")}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[9px] font-semibold transition hover:bg-primary-50 hover:text-primary-800"
                role="menuitem"
              >
                <i className="ri-image-edit-line text-sm" />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2"><span>Transparent artwork</span>{mode === "artwork" && <i className="ri-check-line text-primary-700" />}</span>
              </button>
              <div className="my-1 border-t border-current/10" />
              <button
                type="button"
                onClick={() => { setResetMenuOpen(false); setHistoryOpen(true); }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] font-semibold transition hover:bg-primary-50 hover:text-primary-800"
                role="menuitem"
              >
                <i className="ri-history-line text-sm" />
                <span><strong className="block">Design history</strong><span className={`block text-[8px] font-normal ${muted}`}>Review and reuse saved prompts</span></span>
              </button>
              {(uniformPlan || artworkPreview) && (
                <button
                  type="button"
                  onClick={() => { setResetMenuOpen(false); onClearCurrentDesign(); }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] font-semibold transition hover:bg-red-50 hover:text-red-700"
                  role="menuitem"
                >
                  <i className="ri-delete-bin-6-line text-sm" />
                  <span><strong className="block">Clear current design</strong><span className={`block text-[8px] font-normal ${muted}`}>Remove the concept from the canvas</span></span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {historyOpen && (
        <aside data-ai-popover className={`absolute inset-x-3 top-[68px] z-30 max-h-[60%] overflow-hidden rounded-2xl border shadow-2xl ${card}`} aria-label="AI design conversation history">
          <div className="flex items-center justify-between border-b border-current/10 px-3 py-2.5">
              <div><strong className="block text-xs">Design history</strong><span className={`text-[9px] ${muted}`}>{historyEntries.length} saved {historyEntries.length === 1 ? "prompt" : "prompts"}</span></div>
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

      <div ref={conversationRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-live="polite">
        {!hasConversation ? <EmptyConversation dark={dark} /> : (
          <div className="mx-auto max-w-xl space-y-4">
            {mode === "uniform" && uniformPlan && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/75 p-3.5" aria-label="AI preview controls">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-amber-900"><i className="ri-eye-line" /> Preview Only</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-primary-900"><i className="ri-sparkling-2-fill" /> AI Editing Available</span>
                </div>
                <h3 className="mt-3 font-heading text-lg font-semibold text-foreground-950">Refine with AI</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-foreground-600">Manual garment tools stay locked. Describe changes below or generate another variation; every successful result is preserved as a separate version.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => previousVersion && onRestoreVersion?.(previousVersion)} disabled={!previousVersion || generating} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-background-300 bg-white px-2.5 py-2 text-[9px] font-bold text-foreground-700 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"><i className="ri-arrow-left-line" /> Previous version</button>
                  <button type="button" onClick={() => onCompareVersions?.(comparisonActive ? null : previousVersion)} disabled={!previousVersion || generating} className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${comparisonActive ? "border-primary-600 bg-primary-700 text-white" : "border-background-300 bg-white text-foreground-700 hover:bg-background-100"}`}><i className="ri-split-cells-horizontal" /> {comparisonActive ? "Close comparison" : "Compare versions"}</button>
                  <button type="button" onClick={() => originalVersion && onRestoreVersion?.(originalVersion)} disabled={!originalVersion || versions.length < 2 || generating} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-background-300 bg-white px-2.5 py-2 text-[9px] font-bold text-foreground-700 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"><i className="ri-restart-line" /> Restore original</button>
                  <button type="button" onClick={onGenerateVariation} disabled={generating || connection !== "connected"} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary-700 px-2.5 py-2 text-[9px] font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-45"><i className="ri-refresh-line" /> New variation</button>
                </div>
                <div className="mt-3">
                  <button type="button" onClick={onSavePreview} aria-label="Save image to project" className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-[9px] font-bold text-primary-900 hover:bg-primary-100"><i className="ri-check-line" /> Accept &amp; save to project</button>
                </div>
                {connection !== "connected" && <p className="mt-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[9px] leading-relaxed text-amber-800">AI image editing is not configured or is currently unavailable. Your existing preview remains unchanged.</p>}
              </section>
            )}
            {[...promptHistory].reverse().map((entry) => (
              <div key={entry.id} className="space-y-2">
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary-700 px-3.5 py-2.5 text-[11px] leading-relaxed text-white shadow-sm">
                  {entry.prompt}
                </div>
                {entry.response && (
                  <div className={`max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-3 text-[11px] leading-relaxed ${card}`}>
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
                <span className={muted}>{mode === "uniform" ? "Designing your uniform…" : "Creating transparent artwork…"}</span>
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

      <div className={`relative flex-shrink-0 border-t p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] ${dark ? "border-white/10 bg-[#11140f]" : "border-background-200 bg-[#f8f7f2]"}`}>
        {error && <div role="alert" className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700"><span>{error}</span><button type="button" onClick={onRetry} className="shrink-0 cursor-pointer font-bold underline">Retry</button></div>}

        {settingsOpen && (
          <div data-ai-popover className={`absolute bottom-[calc(100%-4px)] left-3 right-3 z-20 max-h-72 overflow-y-auto rounded-2xl border p-3 shadow-2xl ${card}`}>
            <div className="flex items-center justify-between"><strong className="text-xs">Design controls</strong><button type="button" onClick={() => setSettingsOpen(false)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-black/5" aria-label="Close design controls"><i className="ri-close-line" /></button></div>
            <label className={`mt-3 block text-[9px] font-bold uppercase tracking-wide ${muted}`}>Team or brand</label>
            <input value={brandName} onChange={(event) => onBrandNameChange(event.target.value)} placeholder="e.g. Riverside FC" maxLength={80} className="mt-1 w-full rounded-xl border border-background-300 bg-white px-3 py-2.5 text-xs text-foreground-950 outline-none focus:border-primary-500" />
            <label className={`mt-3 block text-[9px] font-bold uppercase tracking-wide ${muted}`}>Creative direction</label>
            <select value={style} onChange={(event) => onStyleChange(event.target.value)} className="mt-1 w-full rounded-xl border border-background-300 bg-white px-3 py-2.5 text-xs text-foreground-950 outline-none focus:border-primary-500">{styles.map((option) => <option key={option}>{option}</option>)}</select>
            <div className="mt-3">{preservationControls}</div>
            {canUndo && <button type="button" onClick={onUndo} className="mt-3 w-full cursor-pointer rounded-xl border border-background-300 px-3 py-2 text-[10px] font-bold hover:bg-background-100"><i className="ri-arrow-go-back-line mr-1" /> Undo last AI design</button>}
          </div>
        )}

        {toolsOpen && (
          <div data-ai-popover className={`absolute bottom-[calc(100%-4px)] left-3 z-30 w-64 overflow-hidden rounded-2xl border p-2 shadow-2xl ${card}`} role="menu" aria-label="AI composer tools">
            <button type="button" onClick={() => { fileInputRef.current?.click(); setToolsOpen(false); }} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className="ri-image-add-line" /></span><span><strong className="block text-[10px]">Upload inspiration image</strong><span className={`text-[8px] ${muted}`}>PNG, JPG or WebP · up to 10 MB</span></span></button>
            {mode === "artwork" && <button type="button" onClick={() => { onModeChange("uniform"); setToolsOpen(false); }} className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className="ri-shirt-line" /></span><span><strong className="block text-[10px]">Design full uniform</strong><span className={`text-[8px] ${muted}`}>Return to the complete kit designer</span></span></button>}
            {mode === "uniform" && !uniformPlan && <button type="button" onClick={() => { onModeChange("artwork"); setToolsOpen(false); }} className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary-50" role="menuitem"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><i className="ri-image-edit-line" /></span><span><strong className="block text-[10px]">Create transparent artwork</strong><span className={`text-[8px] ${muted}`}>Generate artwork to place on the kit</span></span></button>}
          </div>
        )}

        <div
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={acceptDroppedFile}
          className={`relative mx-auto max-w-xl rounded-[22px] border bg-white shadow-[0_10px_30px_rgba(31,43,35,.09)] transition ${dragging ? "border-primary-500 ring-4 ring-primary-100" : "border-background-300 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100"}`}
        >
          {dragging && <div className="absolute inset-1 z-10 flex items-center justify-center rounded-[18px] border-2 border-dashed border-primary-400 bg-primary-50/95 text-xs font-bold text-primary-800"><i className="ri-upload-cloud-2-line mr-2" /> Drop an image to use as reference</div>}
          {reference && <div className="flex items-center gap-2 border-b border-background-200 px-3 py-2"><img src={reference.src} alt="Attached uniform reference" className="h-9 w-9 rounded-lg border border-background-200 object-cover" /><div className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-foreground-700">{reference.name}</strong><span className="block text-[8px] text-foreground-400">Reference image</span></div><button type="button" onClick={onRemoveReference} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-foreground-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove reference image"><i className="ri-close-line" /></button></div>}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRefinement ? "Describe only what should change…" : MODE_COPY[mode].placeholder}
            maxLength={mode === "uniform" ? 900 : 600}
            rows={2}
            className="block min-h-[48px] w-full resize-none overflow-y-auto rounded-t-[22px] bg-transparent px-4 pb-1.5 pt-3 text-xs leading-relaxed text-foreground-950 outline-none placeholder:text-foreground-400"
            aria-label="Message Connect767 AI"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <button type="button" onClick={() => { setToolsOpen((value) => !value); setHistoryOpen(false); setResetMenuOpen(false); setSettingsOpen(false); }} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-background-200 bg-background-50 text-sm text-foreground-700 transition hover:bg-background-100" aria-label="Add attachment or AI tool" aria-expanded={toolsOpen} data-ai-popover-trigger><i className={toolsOpen ? "ri-close-line" : "ri-add-line"} /></button>
              <button type="button" onClick={() => { setSettingsOpen((value) => !value); setHistoryOpen(false); setResetMenuOpen(false); setToolsOpen(false); }} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center gap-1 rounded-full border border-background-200 bg-background-50 text-[9px] font-bold text-foreground-600 hover:bg-background-100 sm:w-auto sm:px-2.5" data-ai-popover-trigger><i className="ri-equalizer-2-line" /><span className="hidden sm:inline">Controls</span></button>
            </div>
            {generating ? (
              <button type="button" onClick={onStop} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground-950 text-white transition hover:bg-red-600" aria-label="Stop generating"><i className="ri-stop-fill" /></button>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => submit("proof")} disabled={!canSend} className="inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 text-[8px] font-bold text-primary-800 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:border-background-200 disabled:bg-background-100 disabled:text-foreground-400" aria-label="Render high-quality proof" title={mode === "uniform" ? "1536 × 1024 landscape · high quality" : "1024 × 1024 transparent artwork · high quality"}><i className="ri-hd-line" /> HQ proof</button>
                <button type="button" onClick={() => submit("preview")} disabled={!canSend} className={`flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary-700 text-white shadow-sm transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:bg-background-300 disabled:text-foreground-400 ${isRefinement ? "px-3" : "w-8"}`} aria-label={isRefinement ? "Generate Changes" : "Generate preview"} title="1024 × 1024 · medium quality"><i className={isRefinement ? "ri-sparkling-2-fill" : "ri-arrow-up-line"} />{isRefinement && <span className="text-[9px] font-bold">Generate Changes</span>}</button>
              </div>
            )}
          </div>
        </div>
        <p className={`mt-2 text-center text-[8px] ${muted}`}>{renderTier === "proof" ? `Last render: high-quality ${mode === "uniform" ? "landscape proof" : "transparent artwork"}` : "Enter generates a fast preview"} · Shift + Enter for a new line · AI concepts require production review</p>
      </div>
    </section>
  );
}
