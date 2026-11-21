/**
 * Shared crop-anchor + zoom helper for the logo/cover photo position picker
 * (AddListingPage.jsx's PositionPicker) and wherever those images are
 * actually rendered (ListingProfile.jsx, DirectoryListingCard.jsx,
 * Featured.jsx, ListingsGrid.jsx). A full 3x3 grid (not just vertical
 * top/center/bottom) plus a zoom scale — still a closed/clamped set rather
 * than a free-form drag-to-reposition editor, kept simple on purpose. See
 * class-rest-listings.php's sanitize_position()/sanitize_zoom() for the
 * matching server-side whitelist/clamp.
 */
export const POSITION_CHOICES = [
  { value: "top-left", label: "↖", title: "Top left", css: "left top" },
  { value: "top", label: "↑", title: "Top", css: "center top" },
  { value: "top-right", label: "↗", title: "Top right", css: "right top" },
  { value: "left", label: "←", title: "Left", css: "left center" },
  { value: "center", label: "•", title: "Center", css: "center" },
  { value: "right", label: "→", title: "Right", css: "right center" },
  { value: "bottom-left", label: "↙", title: "Bottom left", css: "left bottom" },
  { value: "bottom", label: "↓", title: "Bottom", css: "center bottom" },
  { value: "bottom-right", label: "↘", title: "Bottom right", css: "right bottom" },
];

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.5;

/** Smart is the default; contain and cover remain explicit owner choices. */
export function normalizeImageFit(value, fallback = "cover") {
  return value === "smart" || value === "contain" || value === "cover" ? value : fallback;
}

/**
 * Choose a stable card treatment from the source image's natural ratio.
 * Ordinary square/landscape photography fills the 4:3 frame. Very tall
 * flyers/portraits and extra-wide logo banners stay complete on a soft
 * canvas instead of being aggressively cropped.
 */
export function resolveSmartImageFit(fit, naturalRatio) {
  const mode = normalizeImageFit(fit, "smart");
  if (mode !== "smart") return mode;
  const ratio = Number(naturalRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) return "contain";
  return ratio >= 0.85 && ratio <= 1.9 ? "cover" : "contain";
}

/** Matches a free-form "37% 62%" position produced by dragging. */
const PERCENT_POSITION = /^(-?\d{1,3}(?:\.\d+)?)%\s+(-?\d{1,3}(?:\.\d+)?)%$/;

/** "37% 62%" -> { x: 37, y: 62 }, or null for a keyword/legacy value. */
export function parsePosition(value) {
  const m = PERCENT_POSITION.exec(String(value || "").trim());
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

export const formatPosition = (x, y) =>
  `${Math.round(clampPercent(x))}% ${Math.round(clampPercent(y))}%`;

const clampPercent = (n) => Math.min(100, Math.max(0, Number(n) || 0));

/**
 * Position as it goes into CSS `object-position`.
 *
 * Accepts BOTH the free-form percentages the drag editor now writes and the
 * nine keyword anchors it replaced. Listings saved before the change keep
 * rendering exactly as they did — "center", "top-left" and friends are still
 * resolved — so no migration is needed and nothing already published shifts.
 */
export function cssObjectPosition(value) {
  const pct = parsePosition(value);
  if (pct) return `${pct.x}% ${pct.y}%`;
  return POSITION_CHOICES.find((p) => p.value === value)?.css || "center";
}

/**
 * Any stored value -> {x, y} percentages, so the drag editor can start from
 * whatever is already saved rather than snapping a legacy listing to centre
 * the moment someone opens it.
 */
export function positionToPercent(value) {
  const pct = parsePosition(value);
  if (pct) return pct;
  const css = POSITION_CHOICES.find((p) => p.value === value)?.css || "center";
  const x = css.includes("left") ? 0 : css.includes("right") ? 100 : 50;
  const y = css.includes("top") ? 0 : css.includes("bottom") ? 100 : 50;
  return { x, y };
}

export function clampZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
}

/**
 * Pixel travel available on each axis after object-fit: cover and zoom are
 * applied. Dragging should be normalized against the real overflow, not the
 * frame size: a square logo in a wide cover has substantial vertical travel
 * but very little horizontal travel, while a banner has the inverse.
 */
export function coverDragTravel(frameWidth, frameHeight, naturalRatio, zoom = 1) {
  const width = Math.max(0, Number(frameWidth) || 0);
  const height = Math.max(0, Number(frameHeight) || 0);
  const ratio = Number(naturalRatio);
  const z = clampZoom(zoom);
  if (!width || !height) return { x: 1, y: 1 };

  if (!Number.isFinite(ratio) || ratio <= 0) {
    const fallback = Math.max(0.1, z - 1);
    return {
      x: Math.max(1, width * fallback),
      y: Math.max(1, height * fallback),
    };
  }

  const frameRatio = width / height;
  const renderedWidth = ratio >= frameRatio ? height * ratio : width;
  const renderedHeight = ratio >= frameRatio ? height : width / ratio;
  return {
    x: Math.max(1, renderedWidth * z - width),
    y: Math.max(1, renderedHeight * z - height),
  };
}

/**
 * Combined inline style for an <img> using object-fit: cover, rendered
 * inside a SEPARATE overflow-hidden wrapper (not on the img's own
 * border-radius) — putting both the shape/clip and the zoom transform on
 * the same element scales the clip boundary right along with the image,
 * which just draws a bigger shape showing the same crop instead of
 * actually zooming in. `transform` is only included when zoom isn't the
 * 1x default, so cards that also have a CSS hover-scale class (e.g.
 * `group-hover:scale-105`) keep working normally for the common case of
 * no zoom set — an inline `transform` would otherwise permanently
 * override that class regardless of hover state.
 */
export function imageCropStyle(position, zoom, fit = "cover") {
  if (normalizeImageFit(fit) !== "cover") {
    return { objectPosition: "center" };
  }
  const z = clampZoom(zoom ?? 1);
  return {
    objectPosition: cssObjectPosition(position),
    ...(z !== 1
      ? {
          transform: `scale(${z})`,
          // A scaled image has no object-position travel when its intrinsic
          // ratio matches the frame (especially common for square profile
          // photos). Moving the transform origin makes the saved x/y focal
          // point visibly pan the zoomed image in every aspect ratio.
          transformOrigin: cssObjectPosition(position),
        }
      : {}),
  };
}
