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

export function cssObjectPosition(value) {
  return POSITION_CHOICES.find((p) => p.value === value)?.css || "center";
}

export function clampZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
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
export function imageCropStyle(position, zoom) {
  const z = clampZoom(zoom ?? 1);
  return {
    objectPosition: cssObjectPosition(position),
    ...(z !== 1 ? { transform: `scale(${z})` } : {}),
  };
}
