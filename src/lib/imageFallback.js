/**
 * Global fallback for broken images. Roughly 50 images across the site rely
 * on readdy.ai's search-image endpoint (stock photography for the original
 * site-builder export) — a third-party API this app doesn't control and
 * can't guarantee stays reachable outside the tool it was generated from.
 * Rather than patch every <img> individually (or trust a URL that may not
 * be a stable, long-term public host), this listens for any image load
 * failure anywhere in the app and swaps in a branded placeholder instead of
 * the browser's broken-image icon — so a dead image never looks like a bug,
 * even if the underlying photo host is unavailable.
 *
 * Call once, at app startup (see main.jsx).
 */

const FALLBACK_SRC =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f6f1e7" />
          <stop offset="100%" stop-color="#e8dfcd" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#g)" />
      <g transform="translate(200,190)" fill="none" stroke="#a89a7d" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="-60" y="-45" width="120" height="90" rx="10" />
        <circle cx="-25" cy="-15" r="12" />
        <path d="M -60 25 L -15 -10 L 20 15 L 60 -20 L 60 45 L -60 45 Z" fill="#a89a7d" stroke="none" opacity="0.6" />
      </g>
    </svg>
  `);

export function installImageFallback() {
  document.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLImageElement &&
        target.src !== FALLBACK_SRC &&
        !target.dataset.fallbackApplied
      ) {
        target.dataset.fallbackApplied = "true";
        target.src = FALLBACK_SRC;
        target.classList.add("object-contain", "p-8", "opacity-60");
      }
    },
    true // capture phase — image "error" events don't bubble
  );
}
