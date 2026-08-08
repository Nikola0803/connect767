import { uniformImage } from "./content";

export const sports = [
  { slug: "soccer", icon: "ri-football-line", label: "Soccer" },
  { slug: "basketball", icon: "ri-basketball-line", label: "Basketball" },
  { slug: "baseball", icon: "ri-run-line", label: "Baseball" },
  { slug: "cricket", icon: "ri-trophy-line", label: "Cricket" },
];

export const templates = [
  {
    slug: "classic-crew",
    name: "Classic Crew",
    sportSlug: "soccer",
    description: "A round-neck jersey with a clean chest panel — the go-to starting point.",
    defaultCollar: "Crew",
    defaultSleeve: "Short",
  },
  {
    slug: "v-neck-pro",
    name: "V-Neck Pro",
    sportSlug: "soccer",
    description: "Tapered V-neck collar with raglan sleeves for a modern club look.",
    defaultCollar: "V-Neck",
    defaultSleeve: "Short",
  },
  {
    slug: "shooter-tank",
    name: "Shooter Tank",
    sportSlug: "basketball",
    description: "Classic sleeveless cut with side panel striping.",
    defaultCollar: "Crew",
    defaultSleeve: "Sleeveless",
  },
  {
    slug: "full-button",
    name: "Full Button",
    sportSlug: "baseball",
    description: "Traditional button-front jersey with piping trim.",
    defaultCollar: "Polo",
    defaultSleeve: "Short",
  },
  {
    slug: "raglan-tee",
    name: "Raglan Tee",
    sportSlug: "cricket",
    description: "Lightweight breathable cut built for long days on the pitch.",
    defaultCollar: "Crew",
    defaultSleeve: "Long",
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
export const sleeveOptions = ["Short", "Long", "Sleeveless", "Mixed"];

/**
 * Per-sport field rules, taken directly from the client's confirmed
 * "forms for new website.xlsx" — the reason the studio must NOT show the
 * same soccer form for every sport. Basketball jerseys have no sleeve
 * length choice (always sleeveless) and no Polo collar; only Soccer has a
 * separately-priced Socks item. Cricket/Baseball use "Pants" instead of
 * "Shorts" for the bottom garment. Everything not covered by the xlsx yet
 * (Cricket/Baseball pricing) falls back to the Soccer numbers until the
 * client confirms them — see docs/uniform-configurator-spec.docx §TBD.
 */
export const sportConfigs = {
  soccer: {
    collarOptions: ["Crew", "V-Neck", "Polo"],
    sleeveOptions: ["Short", "Long", "Sleeveless", "Mixed"],
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
  baseball: {
    collarOptions: ["Crew", "Polo"],
    sleeveOptions: ["Short", "Long"],
    hasSocks: true,
    bottomLabel: "Pants",
  },
};
export function sportConfigFor(slug) {
  return sportConfigs[slug] || sportConfigs.soccer;
}
export const fitTypeOptions = ["Men", "Women", "Youth"];
export const kitTypeOptions = ["Full", "Shirt", "Both"];
export const logoApplicationOptions = ["Sublimated", "Embroidery"];
export const shirtSizeOptions = ["YS", "YM", "YL", "AS", "AM", "AL", "AXL", "A2XL"];
export const shortSizeOptions = ["YS", "YM", "YL", "AS", "AM", "AL", "AXL", "A2XL"];

/**
 * Soccer/Football Kit pricing rules — the one preset with confirmed pricing
 * from the client (see docs/uniform-configurator-spec.docx §4). Base price
 * covers plain socks, plain shorts, and a short-sleeve crew or v-neck shirt;
 * everything below is an add-on. Kept as plain data (not hardcoded in the
 * component) so the numbers are a one-place edit once the client confirms
 * pricing for the other sports.
 */
export const BASE_KIT_PRICE = 25;
export const ADD_ON_PRICES = {
  // Confirmed against the client's "forms for new website.xlsx" (Soccer sheet):
  // Sleeves Options — Long or Short (Long Sleeve +$3).
  sleeveLong: 3, // Sleeve Length: Long
  sleeveMixed: 3, // Sleeve Length: Mixed — same as Long until the client says otherwise
  collarPolo: 2, // Collar Type: Polo-Style
  insideCollarMessage: 2, // Inside Shirt Collar: Yes
  logoEmbroidery: 1, // Team Logo application: Embroidery (Sublimated is included in base price)
  goalkeeperPadded: 5, // Goal Keeper "Padded?" option — confirmed in the xlsx (Yes: +$5)
};
/** Fan/Supporter Jersey — a derived, single-item add-on per team design, matching the existing "Fan Jersey" pricing tier below. */
export const FAN_JERSEY_PRICE = 34;

export function kitUnitPrice({ sleeve, collar, insideCollarMessage, logoApplication }) {
  let price = BASE_KIT_PRICE;
  if (sleeve === "Long") price += ADD_ON_PRICES.sleeveLong;
  if (sleeve === "Mixed") price += ADD_ON_PRICES.sleeveMixed;
  if (collar === "Polo") price += ADD_ON_PRICES.collarPolo;
  if (insideCollarMessage) price += ADD_ON_PRICES.insideCollarMessage;
  if (logoApplication === "Embroidery") price += ADD_ON_PRICES.logoEmbroidery;
  return price;
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
];

/**
 * `body`/`sleeve`/`trim`/`panel` are the original generic zones (kept for
 * backward compatibility with JerseyGraphic/JerseyStage's existing render
 * logic). `collar`, `shorts`, and `socks` are the additional garment parts
 * the Soccer Kit preset needs; `shirtStrip`/`sleeveStrip`/`shortsStrip` are
 * their separate contrast trim colors — see spec §4.1/§4.2. All default to
 * something sane so older code paths that only know about the original four
 * zones keep working unchanged.
 */
export const defaultZoneColors = {
  body: "#0c8a57",
  sleeve: "#086b44",
  trim: "#f6f1e7",
  panel: "#1b1a16",
  collar: "#f6f1e7",
  shorts: "#1b1a16",
  socks: "#1b1a16",
  shirtStrip: "#f6f1e7",
  sleeveStrip: "#f6f1e7",
  shortsStrip: "#f6f1e7",
};

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
    price: "$26",
    unit: "per shirt · 12+ team",
    description: "Full team orders with roster management.",
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
    a: "Yes. Team kit pricing applies automatically once your roster hits 12 shirts of the same design — fan jerseys ordered separately (or added on top) are priced individually and shipped separately since they route through print-on-demand rather than in-house production.",
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
