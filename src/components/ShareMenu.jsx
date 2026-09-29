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

export default function ShareMenu({ title, url, className = "" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const wrapRef = useRef(null);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title || "");

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
      key: "email",
      label: "Email",
      icon: "ri-mail-line",
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
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
      await navigator.share({ title, url: shareUrl });
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
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-background-300 text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
      >
        <i className="ri-share-forward-line" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-40 w-56 rounded-xl border border-background-200/70 bg-background-50 shadow-xl p-1.5"
        >
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
              Share via…
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

          {targets.map((t) => (
            <a
              key={t.key}
              role="menuitem"
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground-800 hover:bg-background-100 cursor-pointer"
            >
              <i className={`${t.icon} text-foreground-500`} />
              {t.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
