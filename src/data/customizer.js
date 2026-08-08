import { fontOptions } from "./uniforms";

export { fontOptions };

/**
 * A real apparel color grid — Printful's own product pages show 30+
 * swatches per product, not a curated handful. Organized in the same
 * rows-of-related-tones pattern real print-on-demand catalogs use:
 * neutrals, then a wide spread of saturated colors, then pastels/heathers.
 */
export const garmentColorPalette = [
  // Neutrals
  "#050505", "#1b1a16", "#3d3d3d", "#6b6b6b", "#9b9b9b", "#c9c9c9", "#f6f1e7", "#ffffff",
  // Blues & greens
  "#0c2340", "#1f5c7a", "#2f6690", "#2e8b57", "#0c8a57", "#3c7a4e", "#005f56",
  // Reds & pinks
  "#8b1e2f", "#c0392b", "#e4583a", "#d63864", "#f28ba0",
  // Purples
  "#4b2e83", "#6a4c93", "#9b59b6",
  // Yellows & oranges
  "#e4a11b", "#d98c3f", "#f39c12",
  // Earth tones
  "#7a6a53", "#8b5a2b", "#5c4033",
  // Pastels / heathers
  "#b8c4d9", "#d9c7b8", "#c9d9c4", "#e8d9c4", "#d4c4d9",
];

/**
 * Real placement zones, matching how Printful actually segments a
 * product — not just "front/back", but the specific printable areas each
 * garment has (sleeves, inside label, etc.), each independently
 * designable. `hasPrintArea: false` placements (like an inside label)
 * still get their own tab and layers, just without the dashed print-safe
 * guide since the whole small area effectively IS the safe zone.
 */
export const productTypes = [
  {
    slug: "tshirt",
    label: "T-Shirt",
    icon: "ri-t-shirt-line",
    basePrice: 22,
    modelUrl: null,
    placements: [
      { key: "front", label: "Front", allowText: true, allowLogo: true, allowRecolor: true },
      { key: "back", label: "Back", allowText: true, allowLogo: true, allowRecolor: true },
      { key: "sleeve-left", label: "Left sleeve", allowText: false, allowLogo: true, allowRecolor: true },
      { key: "sleeve-right", label: "Right sleeve", allowText: false, allowLogo: true, allowRecolor: true },
      { key: "inside-label", label: "Inside label", allowText: true, allowLogo: false, allowRecolor: false },
    ],
  },
  {
    slug: "hoodie",
    label: "Hoodie",
    icon: "ri-shirt-line",
    basePrice: 42,
    modelUrl: null,
    placements: [
      { key: "front", label: "Front" },
      { key: "back", label: "Back" },
      { key: "sleeve-left", label: "Left sleeve" },
      { key: "sleeve-right", label: "Right sleeve" },
    ],
  },
  {
    slug: "socks",
    label: "Socks",
    icon: "ri-footprint-line",
    basePrice: 14,
    modelUrl: null,
    placements: [{ key: "front", label: "Side" }],
  },
  {
    slug: "cap",
    label: "Cap",
    icon: "ri-shirt-fill",
    basePrice: 18,
    modelUrl: null,
    placements: [
      { key: "front", label: "Front panel" },
      { key: "back", label: "Back panel" },
    ],
  },
];

export function findProductType(slug) {
  return productTypes.find((p) => p.slug === slug) || productTypes[0];
}

/** Printing techniques — a real configuration choice Printful surfaces prominently. */
export const printingTechniques = [
  {
    key: "dtg",
    label: "DTG printing",
    group: "Printing",
    description: "Full-color detail, best for photographic designs.",
  },
  {
    key: "dtflex",
    label: "DTFlex",
    group: "Printing",
    badge: "New",
    description: "Vibrant colors with a soft, flexible finish.",
  },
  {
    key: "embroidery",
    label: "Embroidery",
    group: "Embroidery",
    description: "Stitched thread — best for logos and simple shapes.",
  },
];

/**
 * Built-in clipart — colorable Remix Icon glyphs a customer can drop onto
 * a design without needing their own artwork. Renders as a real layer
 * (see ProductDraggableLayer.jsx's `type === "clipart"` case), fully
 * draggable/resizable/rotatable/recolorable like any other layer.
 */
export const clipartLibrary = [
  { key: "star", icon: "ri-star-fill", label: "Star" },
  { key: "heart", icon: "ri-heart-fill", label: "Heart" },
  { key: "flash", icon: "ri-flashlight-fill", label: "Bolt" },
  { key: "fire", icon: "ri-fire-fill", label: "Flame" },
  { key: "crown", icon: "ri-vip-crown-fill", label: "Crown" },
  { key: "sun", icon: "ri-sun-fill", label: "Sun" },
  { key: "moon", icon: "ri-moon-fill", label: "Moon" },
  { key: "leaf", icon: "ri-leaf-fill", label: "Leaf" },
  { key: "trophy", icon: "ri-trophy-fill", label: "Trophy" },
  { key: "medal", icon: "ri-medal-fill", label: "Medal" },
  { key: "shield", icon: "ri-shield-star-fill", label: "Shield" },
  { key: "target", icon: "ri-focus-3-fill", label: "Target" },
  { key: "wave", icon: "ri-water-flash-fill", label: "Wave" },
  { key: "anchor", icon: "ri-anchor-fill", label: "Anchor" },
  { key: "compass", icon: "ri-compass-3-fill", label: "Compass" },
  { key: "palm", icon: "ri-plant-fill", label: "Palm" },
  { key: "skull", icon: "ri-ghost-fill", label: "Ghost" },
  { key: "diamond", icon: "ri-gem-fill", label: "Gem" },
  { key: "paw", icon: "ri-footprint-fill", label: "Paw" },
  { key: "music", icon: "ri-music-2-fill", label: "Note" },
];

// Premium clipart tiers, Quick Designs starter layouts, a Fill/pattern tool,
// and a session-only Saved Designs list used to live here. All four were
// demo padding for this catalog (Connect767 sells team apparel, not a
// general print-on-demand storefront) and were removed along with their
// tabs in ProductCustomizerPage — see that file's `tools` list.

/** 3D model URL per product type — set by an admin in wp-admin (product_type
 * CPT's "3D model URL" field) once real GLTF garment scans/models exist.
 * Left null here since local fixtures have no backend to upload to; the 3D
 * preview (Product3DStage) falls back to a procedural placeholder mesh
 * whenever this is empty. */
export const defaultModelUrl = null;
