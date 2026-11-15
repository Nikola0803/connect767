export const DEFAULT_STUDIO_BACKGROUND = "#F5F0E7";

export const STUDIO_BACKGROUND_PRESETS = [
  { name: "Warm studio", color: DEFAULT_STUDIO_BACKGROUND, use: "Best for everyday designing" },
  { name: "Proof white", color: "#FFFFFF", use: "Best for print and export checks" },
  { name: "Soft gray", color: "#D9DEDC", use: "Shows white and pale garments clearly" },
  { name: "Charcoal", color: "#252824", use: "Best contrast for light artwork" },
  { name: "Brand green", color: "#063F2C", use: "Best for presentation previews" },
];

export const isStudioHex = (value) => /^#[0-9a-fA-F]{6}$/.test(value || "");

export function normalizeStudioBackground(value) {
  return isStudioHex(value) ? value.toUpperCase() : DEFAULT_STUDIO_BACKGROUND;
}

function mix(hex, target, amount) {
  const source = hex.replace("#", "");
  const rgb = [0, 2, 4].map((index) => parseInt(source.slice(index, index + 2), 16));
  const targetRgb = target === "white" ? 255 : 0;
  const result = rgb.map((channel) => Math.round(channel + (targetRgb - channel) * amount));
  return `#${result.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function studioBackgroundGradient(value) {
  const color = normalizeStudioBackground(value);
  return `radial-gradient(circle at 50% 34%, ${mix(color, "white", 0.2)} 0%, ${color} 70%, ${mix(color, "black", 0.1)} 100%)`;
}

export function isDarkStudioBackground(value) {
  const hex = normalizeStudioBackground(value).replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 130;
}
