import { useEffect, useRef, useState } from "react";

/**
 * Share menu for a listing profile.
 *
 * The old button called `navigator.share` and, when that didn't exist (every
 * desktop browser except Safari), fell back to `navigator.clipboard` — whose
 * failure path was an empty catch block. So on desktop the button either
 * copied silently with no feedback, or did literally nothing, with no way to
 * tell which. This gives the destinations people actually expect, and always
 * confirms what happened.
 */

/** Clipboard with a fallback for insecure origins, where the async API is unavailable. */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path below */
  }

  // execCommand is deprecated but still the only thing that works on
  // http:// origins and in older browsers — worth keeping as a backstop
  // rather than leaving the user with a dead button.
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareMenu({
  title,
  url,
  className = "",
  buttonClassName = "",
  iconOnly = false,
  placement = "bottom",
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const wrapRef = useRef(null);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const shareTitle = title || "Connect767 listing";
  const encodedTitle = encodeURIComponent(shareTitle);
  const encodedMessage = encodeURIComponent(`${shareTitle} ${shareUrl}`);
  const desktopPosition = placement === "top"
    ? "sm:bottom-full sm:top-auto sm:mb-2 sm:mt-0"
    : "sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2";

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const targets = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: "ri-whatsapp-line",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: "ri-facebook-circle-line",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      key: "x",
      label: "X / Twitter",
      icon: "ri-twitter-x-line",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: "ri-linkedin-line",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      key: "threads",
      label: "Threads",
      icon: "ri-threads-line",
      href: `https://www.threads.net/intent/post?text=${encodedMessage}`,
    },
    {
      key: "bluesky",
      label: "Bluesky",
      icon: "ri-cloud-line",
      href: `https://bsky.app/intent/compose?text=${encodedMessage}`,
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: "ri-telegram-2-line",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      key: "reddit",
      label: "Reddit",
      icon: "ri-reddit-line",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      key: "pinterest",
      label: "Pinterest",
      icon: "ri-pinterest-line",
      href: `https://www.pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    },
    {
      key: "email",
      label: "Email",
      icon: "ri-mail-line",
      href: `mailto:?subject=${encodedTitle}&body=${encodedMessage}`,
    },
    {
      key: "sms",
      label: "Text message",
      icon: "ri-message-2-line",
      href: `sms:?&body=${encodedMessage}`,
    },
  ];

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl);
    setCopied(ok);
    setCopyFailed(!ok);
    setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 2500);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: shareTitle, url: shareUrl });
      setOpen(false);
    } catch {
      /* user dismissed the sheet */
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={iconOnly ? "Share listing" : undefined}
        className={iconOnly
          ? `flex h-9 w-9 items-center justify-center rounded-full bg-background-50/95 text-foreground-700 shadow-sm backdrop-blur transition-colors hover:text-primary-700 cursor-pointer ${buttonClassName}`
          : `inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-background-300 text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors ${buttonClassName}`}
      >
        <i className="ri-share-forward-line" />
        {!iconOnly && <span className="hidden sm:inline">Share</span>}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close share menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[69] cursor-default bg-foreground-950/35 sm:hidden"
          />
          <div
            role="menu"
            data-placement={placement}
            className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[70] max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] touch-pan-y overscroll-contain overflow-y-auto rounded-xl border border-background-200/70 bg-background-50 p-1.5 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:w-72 ${desktopPosition}`}
          >
            <div className="flex items-center justify-between px-3 py-2 sm:hidden">
              <span className="text-sm font-semibold text-foreground-950">Share</span>
              <button
                type="button"
                aria-label="Close share menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background-100 text-foreground-700"
              >
                <i className="ri-close-line text-lg" aria-hidden="true" />
              </button>
            </div>
            {/* Native sheet first where it exists (phones, Safari) — it reaches
                apps we can't link to directly. Desktop simply won't see it. */}
            {typeof navigator !== "undefined" && navigator.share && (
            <button
              type="button"
              role="menuitem"
              onClick={handleNativeShare}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-800 hover:bg-background-100 cursor-pointer"
            >
              <i className="ri-share-line text-foreground-500" />
              More apps…
            </button>
            )}

          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-800 hover:bg-background-100 cursor-pointer"
          >
            <i
              className={
                copied ? "ri-check-line text-primary-600" : "ri-link text-foreground-500"
              }
            />
            {copied ? "Link copied" : copyFailed ? "Press Ctrl+C to copy" : "Copy link"}
          </button>

          {copyFailed && (
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              // Shown only when copying was blocked, so there's still a way to
              // get the URL rather than a button that quietly failed.
              className="w-full mt-1 mb-1 px-2 py-1.5 text-[11px] font-mono rounded border border-background-300 bg-background-100 text-foreground-700"
            />
          )}

          <div className="h-px bg-background-200/70 my-1.5" />

          <p className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-500">
            Share to
          </p>

          <div className="grid max-h-72 grid-cols-2 gap-0.5 overflow-y-auto">
            {targets.map((t) => (
              <a
                key={t.key}
                role="menuitem"
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex min-w-0 items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground-800 hover:bg-background-100 cursor-pointer"
              >
                <i className={`${t.icon} shrink-0 text-foreground-500`} />
                <span className="truncate">{t.label}</span>
              </a>
            ))}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
