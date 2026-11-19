import { uniformImage } from "./content";

/**
 * `modelUrl` is the GLB the 3D preview loads for that sport, served from
 * /public/models/. A sport with `modelUrl: null` falls back to the
 * procedural mesh in GarmentModel.jsx rather than showing another sport's
 * kit — a wrong-shape garment reads as a bug, an obvious placeholder reads
 * as "not built yet." Drop a file in /public/models/ and point a slug at it
 * to light that sport up; no component changes needed.
 */
export const sports = [
  {
    slug: "soccer",
    icon: "ri-football-line",
    label: "Soccer",
    // PBR over the `_shaded` variant of the same scan: shaded bakes lighting
    // into the texture, which fights live recoloring — the whole point of
    // this tool. PBR keeps albedo separate so material.color actually reads.
    //
    // Serving from /opt/: Draco-compressed + decimated copies built by
    // scripts/optimize-models.mjs. 30MB -> 864KB, 339k -> 100k verts. The
    // raw exports stay in /models/ as the source of truth. Decal projection
    // cost scales with triangle count, so this is what makes dragging a logo
    // across the mesh feel immediate rather than sludgy.
    modelUrl: "/models/opt/base_basic_pbr.glb",
  },
  {
    slug: "basketball",
    icon: "ri-basketball-line",
    label: "Basketball",
    modelUrl: "/models/opt/jersey.glb",
  },
  { slug: "netball", icon: "ri-basketball-line", label: "Netball", modelUrl: null },
  { slug: "cricket", icon: "ri-trophy-line", label: "Cricket", modelUrl: null },
  // Goalkeeper kit is priced and specced separately from outfield soccer
  // (padding is a paid add-on, and long sleeve is the norm rather than an
  // upgrade), so it's its own category rather than a soccer option.
  { slug: "goalkeeper", icon: "ri-hand-coin-line", label: "Goal Keeper", modelUrl: null },
  // Catch-all for kit that doesn't fit the named sports — the configurator
  // still works, and the quote carries whatever the customer describes.
  { slug: "other", icon: "ri-shirt-line", label: "Other", modelUrl: null },
];

/** GLB for a sport slug, or null when that sport has no model yet. */
export function sportModelUrl(slug) {
  return sports.find((s) => s.slug === slug)?.modelUrl ?? null;
}

export const templates = [
  {
    slug: "classic-crew",
    name: "Classic Crew",
    sportSlug: "soccer",
    description: "A round-neck jersey with a clean chest panel — the go-to starting point.",
    image: "/uploads/uniform-templates/soccer-classic-crew.png",
    defaultCollar: "Crew",
    defaultSleeve: "Short",
  },
  {
    slug: "shooter-tank",
    name: "Shooter Tank",
    sportSlug: "basketball",
    description: "Classic sleeveless cut with side panel striping.",
    image: "/uploads/uniform-templates/basketball-shooter-tank.png",
    defaultCollar: "V-Neck",
    defaultSleeve: "Sleeveless",
  },
  {
    slug: "court-dress",
    name: "Court Dress",
    sportSlug: "netball",
    description: "Modern sleeveless netball dress with a shaped court-ready silhouette.",
    image: "/uploads/uniform-templates/netball-court-dress.png",
    defaultCollar: "Crew",
    defaultSleeve: "Sleeveless",
  },
  {
    slug: "raglan-tee",
    name: "Matchday Long Sleeve",
    sportSlug: "cricket",
    description: "Lightweight breathable cut built for long days on the pitch.",
    image: "/uploads/uniform-templates/cricket-match-polo.png",
    defaultCollar: "Polo",
    defaultSleeve: "Long",
  },
  {
    slug: "guardian-pro",
    name: "Guardian Pro",
    sportSlug: "goalkeeper",
    description: "Long-sleeve keeper cut with padded impact zones and a strong modern silhouette.",
    image: "/uploads/uniform-templates/goalkeeper-guardian-pro.png",
    defaultCollar: "Crew",
    defaultSleeve: "Long",
  },
  {
    slug: "performance-polo",
    name: "Performance Polo",
    sportSlug: "other",
    description: "A versatile premium teamwear cut for training, clubs, staff and emerging sports.",
    image: "/uploads/uniform-templates/all-sport-performance-polo.png",
    defaultCollar: "Polo",
    defaultSleeve: "Short",
  },
  {
    slug: "blank-canvas",
    name: "Blank Canvas",
    sportSlug: "soccer",
    description: "Start from nothing — every panel, color, and placement is yours.",
    defaultCollar: "Crew",
    defaultSleeve: "Short",
  },
];

export const collarOptions = ["Crew", "V-Neck", "Polo"];
export const sleeveOptions = ["Short", "Long", "Mixed"];

/**
 * Per-sport field rules, taken directly from the client's confirmed
 * "forms for new website.xlsx" — the reason the studio must NOT show the
 * same soccer form for every sport. Basketball jerseys have no sleeve
 * length choice (always sleeveless) and no Polo collar; only Soccer has a
 * separately-priced Socks item. Cricket uses "Pants" instead of "Shorts"
 * for the bottom garment. Everything not covered by the xlsx yet
 * (Cricket/Netball pricing) falls back to the Soccer numbers until the
 * client confirms them — see docs/uniform-configurator-spec.docx §TBD.
 */
export const sportConfigs = {
  soccer: {
    collarOptions: ["Crew", "V-Neck", "Polo"],
    sleeveOptions: ["Short", "Long", "Mixed"],
    hasSocks: true,
    bottomLabel: "Shorts",
  },
  basketball: {
    collarOptions: ["Crew", "V-Neck"],
    sleeveOptions: null,
    hasSocks: false,
    bottomLabel: "Shorts",
  },
  cricket: {
    collarOptions: ["Crew", "V-Neck", "Polo"],
    sleeveOptions: ["Short", "Long"],
    hasSocks: false,
    bottomLabel: "Pants",
  },
  netball: {
    collarOptions: ["Crew", "V-Neck"],
    sleeveOptions: null,
    hasSocks: false,
    bottomLabel: "Shorts",
  },
  goalkeeper: {
    collarOptions: ["Crew", "V-Neck", "Polo"],
    // Long first: it's the default choice for keepers, and the option list
    // order decides what a new template starts on.
    sleeveOptions: ["Long", "Short", "Mixed"],
    hasSocks: true,
    bottomLabel: "Shorts",
  },
  other: {
    collarOptions: ["Crew", "V-Neck", "Polo"],
    sleeveOptions: ["Short", "Long", "Mixed"],
    hasSocks: false,
    bottomLabel: "Shorts",
  },
};
export function sportConfigFor(slug) {
  return sportConfigs[slug] || sportConfigs.soccer;
}
export const fitTypeOptions = ["Men", "Women", "Youth"];
export const kitTypeOptions = ["Full", "Shirt"];
export const logoApplicationOptions = ["Sublimated", "Embroidery"];
export const shirtSizeOptions = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
export const shortSizeOptions = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
export const sockSizeOptions = ["Youth", "Small", "Medium", "Large", "XL"];
export const bottomLengthOptions = ["Short", "Regular", "Long"];
export const playerRoleOptions = ["Player", "Goalkeeper", "Coach / Staff"];

/**
 * Soccer/Football Kit pricing rules — the one preset with confirmed pricing
 * from the client (see docs/uniform-configurator-spec.docx §4). Base price
 * covers plain socks, plain shorts, and a short-sleeve crew or v-neck shirt;
 * everything below is an add-on. Kept as plain data (not hardcoded in the
 * component) so the numbers are a one-place edit once the client confirms
 * pricing for the other sports.
 */
export const BASE_KIT_PRICE = 35;
export const SHIRT_ONLY_PRICE = 12;
export function minimumFullKitsFor(sport) {
  return { soccer: 22, basketball: 10, cricket: 15, netball: 10 }[sport] || 1;
}

export const fullKitCount = (roster = []) => roster.reduce((total, entry) =>
  total + (entry?.name?.trim() ? Math.max(1, Math.min(99, Number.parseInt(entry.quantity, 10) || 1)) : 0), 0);

export function normalizeExtraTeamShirts(rows = []) {
  if (!Array.isArray(rows)) return [];
  const quantities = new Map();
  for (const row of rows) {
    if (!row || !shirtSizeOptions.includes(row.size)) continue;
    const quantity = Math.max(1, Math.min(99, parseInt(row.quantity, 10) || 1));
    quantities.set(row.size, Math.min(99, (quantities.get(row.size) || 0) + quantity));
  }
  return [...quantities].map(([size, quantity]) => ({ size, quantity }));
}
export const extraTeamShirtCount = (rows) => normalizeExtraTeamShirts(rows).reduce((sum, row) => sum + row.quantity, 0);
export const ADD_ON_PRICES = {
  // Short sleeves are included; mixed orders charge only long-sleeve kits.
  sleeveLong: 2,
  collarPolo: 2, // Collar Type: Polo-Style
  // Client-confirmed 2026-08-10 (WhatsApp): "Custom Logo/Message in Collar
  // +1/Kit" and "Embroidery Logo: +1.50/Kit". Both superseded the earlier
  // xlsx figures ($2 and $1 respectively).
  insideCollarMessage: 1, // Custom Logo/Message in Collar
  logoEmbroidery: 1.5, // Team Logo application: Embroidery (Sublimated included in base)
  goalkeeperPadded: 5, // Goal Keeper "Padded?" option — confirmed in the xlsx (Yes: +$5)
};
/** Kept for integrations that still read the legacy name; supporter jerseys use the Step 1 Shirt Only price. */
export const FAN_JERSEY_PRICE = SHIRT_ONLY_PRICE;

export function kitUnitPrice({ sleeve, collar, insideCollarMessage, logoApplication }) {
  let price = BASE_KIT_PRICE;
  if (sleeve === "Long") price += ADD_ON_PRICES.sleeveLong;
  if (collar === "Polo") price += ADD_ON_PRICES.collarPolo;
  if (insideCollarMessage) price += ADD_ON_PRICES.insideCollarMessage;
  if (logoApplication === "Embroidery") price += ADD_ON_PRICES.logoEmbroidery;
  return price;
}

export function mixedSleeveSurcharge(sleeve, roster = []) {
  if (sleeve !== "Mixed") return 0;
  return roster.reduce((total, entry) => total + (entry.sleevePreference === "Long"
    ? Math.max(1, Math.min(99, parseInt(entry.quantity, 10) || 1)) * ADD_ON_PRICES.sleeveLong : 0), 0);
}

export function kitAddOnBreakdown({
  sleeve,
  collar,
  insideCollarMessage,
  logoApplication,
  unitCount = 0,
  roster = [],
}) {
  const kits = Math.max(0, Number.parseInt(unitCount, 10) || 0);
  const items = [];
  const add = (key, label, count, unitPrice) => {
    if (count > 0) items.push({ key, label, count, unitPrice, total: count * unitPrice });
  };

  if (sleeve === "Long") add("long-sleeves", "Long sleeves", kits, ADD_ON_PRICES.sleeveLong);
  if (sleeve === "Mixed") {
    const longSleeveKits = roster.reduce((total, entry) => total + (entry?.sleevePreference === "Long"
      ? Math.max(1, Math.min(99, Number.parseInt(entry.quantity, 10) || 1)) : 0), 0);
    add("mixed-long-sleeves", "Long-sleeve upgrades", longSleeveKits, ADD_ON_PRICES.sleeveLong);
  }
  if (collar === "Polo") add("polo-collars", "Polo-style collars", kits, ADD_ON_PRICES.collarPolo);
  if (insideCollarMessage) add("inside-collar", "Inside-collar logo/message", kits, ADD_ON_PRICES.insideCollarMessage);
  if (logoApplication === "Embroidery") add("embroidery", "Embroidered team logo", kits, ADD_ON_PRICES.logoEmbroidery);

  return items;
}

export const colorways = [
  { name: "Emerald", hex: "#0c8a57" },
  { name: "Terracotta", hex: "#e4583a" },
  { name: "Ink", hex: "#1b1a16" },
  { name: "Cream", hex: "#f6f1e7" },
  { name: "Ocean", hex: "#1f5c7a" },
  { name: "Sunset", hex: "#d98c3f" },
];

// Palette used per-zone in the advanced customizer (body / sleeves / trim / panels).
export const zoneColorPalette = [
  "#0c8a57", // primary green
  "#086b44",
  "#e4583a", // accent terracotta
  "#cf4a2f",
  "#1b1a16", // ink
  "#f6f1e7", // cream
  "#1f5c7a", // ocean
  "#d98c3f", // sunset
  "#7a6a53", // khaki
  "#ffffff",
];

export const fontOptions = [
  { key: "athletic", label: "Athletic", family: "'Oswald', sans-serif", weight: 600 },
  { key: "clean", label: "Clean", family: "'Manrope', sans-serif", weight: 700 },
  { key: "classic", label: "Classic", family: "'Fraunces', serif", weight: 600 },
  { key: "varsity", label: "Varsity block", family: "Impact, 'Arial Black', sans-serif", weight: 700 },
  { key: "condensed", label: "Condensed", family: "'Arial Narrow', 'Roboto Condensed', sans-serif", weight: 700 },
  { key: "modern", label: "Modern", family: "Montserrat, Arial, sans-serif", weight: 700 },
  { key: "collegiate", label: "Collegiate serif", family: "Rockwell, 'Roboto Slab', serif", weight: 700 },
  { key: "script", label: "Script", family: "'Brush Script MT', 'Segoe Script', cursive", weight: 600 },
];

/** Active editor zones. Side panels and the catch-all `trim` zone were
 * removed because they made one color control affect several unrelated
 * garment areas. Every stored key below now corresponds to one visible,
 * customer-facing control in DesignPanel. */
/**
 * Blank canvas, deliberately. This used to open on a green/black colourway,
 * which reads as "here is a design" rather than "here is your starting
 * point" — customers were recolouring away from someone else's kit instead
 * of building their own. White also shows uploaded artwork honestly: a logo
 * that disappears against a dark shirt looks like a broken upload.
 */
export const defaultZoneColors = {
  body: "#ffffff",
  sleeve: "#ffffff",
  // The blank garment is white, so its collar must begin as the same fabric
  // color. Customers can still recolor it independently in DesignPanel.
  collar: "#ffffff",
  shorts: "#ffffff",
  socks: "#ffffff",
  shirtStrip: "#e8e4da",
  sleeveStrip: "#e8e4da",
  shortsStrip: "#e8e4da",
};

/** Discard legacy `panel`/`trim` keys when an older saved design is opened.
 * This keeps the current editor and submitted quote payload limited to the
 * eight garment regions customers can actually see and control. */
export function normalizeZoneColors(saved = {}) {
  return Object.fromEntries(
    Object.keys(defaultZoneColors).map((key) => [key, saved[key] || defaultZoneColors[key]]),
  );
}

export const pricingTiers = [
  {
    name: "Fan Jersey",
    price: "$34",
    unit: "per shirt",
    description: "Single-item orders, no minimum.",
    features: [
      "Print-on-demand, ships in 3–5 days",
      "Name & number customization",
      "Any template, any colorway",
      "One-off gift orders welcome",
    ],
  },
  {
    name: "Team Kit",
    price: "$30",
    unit: "per full kit",
    description: "Minimum full kits: Soccer 22 · Basketball 10 · Cricket 15 · Netball 10.",
    highlight: true,
    features: [
      "In-house production, faster turnaround",
      "Roster table for sizes, names & numbers",
      "Shirt, shorts & socks bundled",
      "Dedicated design proof before printing",
    ],
  },
  {
    name: "Club Partner",
    price: "Custom",
    unit: "season-round pricing",
    description: "Multi-team clubs and recurring seasonal orders.",
    features: [
      "Locked-in season pricing",
      "Priority production slots",
      "Club branding across all templates",
      "Dedicated account contact",
    ],
  },
];

export const faqs = [
  {
    q: "How does sizing work for a full roster?",
    a: "The roster table lets you enter each player's name, number, and size in one pass. We use standard youth and adult sizing charts — a downloadable size-guide PDF is available on the roster step so you can measure before ordering.",
  },
  {
    q: "Can I mix fan jerseys and team kits in one order?",
    a: "Yes. Full-kit minimums are 22 for soccer, 10 for basketball, 15 for cricket and 10 for netball. Extra team shirts and fan jerseys are priced separately and do not count toward those minimums.",
  },
  {
    q: "What file formats can I upload for a logo?",
    a: "Transparent PNG works best for the live preview. For final production we'll ask for a vector file (AI, EPS, or high-res SVG) if you have one — if not, our team can trace a clean logo from a high-resolution PNG at no extra cost.",
  },
  {
    q: "How long does a team order take?",
    a: "Team kits (12+, in-house production) typically ship in 7–10 business days after you approve the design proof. Fan jerseys ship in 3–5 days via print-on-demand. Rush production is available for an additional fee — ask in the studio before checkout.",
  },
  {
    q: "Can I reorder the same design later in the season?",
    a: "Every saved design gets a reorder link. Club Partner accounts also get season-round pricing locked in, so a reorder mid-season costs the same as the original batch.",
  },
];

export { uniformImage };
