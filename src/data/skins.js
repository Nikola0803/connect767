/**
 * Placeable graphic "skins" — flags, bands, shapes and textures a customer
 * can drop onto the kit and drag anywhere, exactly like an uploaded logo.
 *
 * Every skin is generated as an SVG string from the two colours the customer
 * has already chosen, rather than shipped as a fixed image. That means a skin
 * always lands in the team's palette instead of importing a stranger's, and
 * adding one costs a few lines here with no asset pipeline.
 *
 * They render through the same decal path as logos (see layerTexture.js), so
 * they conform to the garment surface and are moved and resized with the same
 * handles. Skins use multiply blending so the fabric's shading reads through
 * them — printed into the cloth rather than stuck on top.
 */

const svg = (inner, w = 200, h = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;

/**
 * Each entry draws with `a` (primary) and `b` (secondary). Keep shapes bold
 * and high-contrast: a skin is viewed at roughly thumbnail size on a curved
 * surface, where fine detail turns to mush.
 */
export const skinLibrary = [
  {
    key: "bands-h",
    label: "Bands",
    group: "Stripes",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          [0, 2, 4].map((i) => `<rect y="${i * 40}" width="200" height="40" fill="${b}"/>`).join(""),
      ),
  },
  {
    key: "bands-v",
    label: "Vertical",
    group: "Stripes",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          [0, 2, 4].map((i) => `<rect x="${i * 40}" width="40" height="200" fill="${b}"/>`).join(""),
      ),
  },
  {
    key: "diagonal",
    label: "Diagonal",
    group: "Stripes",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<path d="M-40 200 L200 -40 L260 20 L20 260 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "chevron",
    label: "Chevron",
    group: "Shapes",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<path d="M0 60 L100 130 L200 60 L200 120 L100 190 L0 120 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "sash",
    label: "Sash",
    group: "Shapes",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<path d="M-20 140 L140 -20 L200 20 L40 180 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "halves",
    label: "Halves",
    group: "Shapes",
    render: (a, b) =>
      svg(`<rect width="200" height="200" fill="${a}"/><rect width="100" height="200" fill="${b}"/>`),
  },
  {
    key: "shield",
    label: "Shield",
    group: "Shapes",
    render: (a, b) =>
      svg(
        `<path d="M100 8 L184 40 v66 c0 48 -38 72 -84 86 c-46 -14 -84 -38 -84 -86 V40 Z" fill="${a}"/>` +
          `<path d="M100 30 L162 54 v52 c0 36 -28 55 -62 66 c-34 -11 -62 -30 -62 -66 V54 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "star",
    label: "Star",
    group: "Shapes",
    render: (a, b) =>
      svg(
        `<circle cx="100" cy="100" r="92" fill="${a}"/>` +
          `<path d="M100 26 L122 80 L180 84 L136 122 L150 178 L100 148 L50 178 L64 122 L20 84 L78 80 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "tricolour",
    label: "Tricolour",
    group: "Flags",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${b}"/>` +
          `<rect width="67" height="200" fill="${a}"/>` +
          `<rect x="133" width="67" height="200" fill="${a}"/>`,
      ),
  },
  {
    key: "cross",
    label: "Cross",
    group: "Flags",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<rect y="76" width="200" height="48" fill="${b}"/>` +
          `<rect x="60" width="48" height="200" fill="${b}"/>`,
      ),
  },
  {
    key: "quarters",
    label: "Quarters",
    group: "Flags",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<rect width="100" height="100" fill="${b}"/>` +
          `<rect x="100" y="100" width="100" height="100" fill="${b}"/>`,
      ),
  },
  {
    key: "camo",
    label: "Camo",
    group: "Texture",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<path d="M18 30 q30 -22 56 -2 q26 20 4 44 q-22 24 -54 10 q-32 -14 -6 -52 Z" fill="${b}"/>` +
          `<path d="M118 14 q34 -10 52 16 q18 26 -10 44 q-28 18 -50 -6 q-22 -24 8 -54 Z" fill="${b}"/>` +
          `<path d="M30 120 q36 -14 58 12 q22 26 -8 46 q-30 20 -56 -4 q-26 -24 6 -54 Z" fill="${b}"/>` +
          `<path d="M130 116 q32 -8 46 18 q14 26 -14 40 q-28 14 -44 -10 q-16 -24 12 -48 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "splash",
    label: "Splash",
    group: "Texture",
    render: (a, b) =>
      svg(
        `<rect width="200" height="200" fill="${a}"/>` +
          `<path d="M40 100 q10 -44 48 -40 q38 4 30 40 q-8 36 20 40 q28 4 22 30 q-6 26 -50 22 q-44 -4 -60 -34 q-16 -30 -10 -58 Z" fill="${b}"/>`,
      ),
  },
  {
    key: "fade",
    label: "Fade",
    group: "Texture",
    render: (a, b) =>
      svg(
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0%" stop-color="${b}"/><stop offset="100%" stop-color="${a}"/>` +
          `</linearGradient></defs><rect width="200" height="200" fill="url(#g)"/>`,
      ),
  },
];

export const skinGroups = [...new Set(skinLibrary.map((s) => s.group))];

export function findSkin(key) {
  return skinLibrary.find((s) => s.key === key) || null;
}

/** SVG source for a skin, as a data URI ready to hand to an Image. */
export function skinDataUri(key, colorA, colorB) {
  const skin = findSkin(key);
  if (!skin) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(skin.render(colorA, colorB))}`;
}
