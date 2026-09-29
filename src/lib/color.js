/**
 * Small hex color helpers used to turn a single "base" color into a
 * highlight/shadow pair for gradient fills — the same technique real
 * mockup generators (Placeit, Smartmockups, and Printful's own simple
 * color-swap previews) use: a shading map recolored dynamically, rather
 * than a flat fill or a real per-color photo for every combination.
 */

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export function shadeOf(hex, deltaL) {
  const { h, s, l } = hexToHsl(hex);
  const nextL = Math.max(4, Math.min(96, l + deltaL));
  return hslToHex(h, s, nextL);
}

/** { highlight, base, shadow } for a fabric-style gradient fill. */
export function fabricShades(hex) {
  return {
    highlight: shadeOf(hex, 16),
    base: hex,
    shadow: shadeOf(hex, -18),
  };
}
