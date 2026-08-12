import * as THREE from "three";

/**
 * Builds a standalone THREE texture for a SINGLE design layer.
 *
 * The old pipeline (DesignCapture.jsx) rendered every layer of a placement
 * into one 900x1125 sheet and mapped that whole sheet onto a flat plane
 * hovering in front of the garment. That's why nothing could be moved or
 * scaled in 3D: there was one texture for everything, and no per-item
 * geometry to grab. One texture per layer is the prerequisite for making
 * each logo and each line of text independently draggable on the mesh.
 *
 * Canvases are sized to the content's aspect ratio and drawn with a
 * transparent background, so the decal's alpha does the masking and no
 * rectangle edge is ever visible on the fabric.
 */

// Texture budget per layer. Decals are small on screen, but a team name can
// be read close-up in the 3D view, so this is deliberately generous —
// undersizing here is what makes configurator text look fuzzy and cheap.
const MAX_DIM = 1024;
const TEXT_PAD = 0.18; // fraction of font size, keeps glyph tails off the edge

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

function finish(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // Decals never tile — clamping avoids a 1px wrap seam bleeding the
  // opposite edge of the glyph into the projection.
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

/** Renders one line of text to a tightly-cropped transparent canvas. */
function textTexture(layer) {
  const fontSize = 256;
  const family = layer.fontFamily || "sans-serif";
  const weight = layer.fontWeight || "700";
  const font = `${weight} ${fontSize}px ${family}`;

  // Measure on a throwaway context first so the real canvas can be sized to
  // the glyphs rather than to a guessed box.
  const probe = makeCanvas(2, 2).getContext("2d");
  probe.font = font;
  const text = layer.text || " ";
  const m = probe.measureText(text);

  const ascent = m.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = m.actualBoundingBoxDescent || fontSize * 0.2;
  const pad = fontSize * TEXT_PAD;

  const w = Math.ceil(m.width + pad * 2);
  const h = Math.ceil(ascent + descent + pad * 2);

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (layer.outlineColor && layer.outlineWidth) {
    ctx.lineWidth = layer.outlineWidth * (fontSize / 16);
    ctx.strokeStyle = layer.outlineColor;
    ctx.lineJoin = "round";
    ctx.strokeText(text, pad, pad + ascent);
  }

  // Gradient fill runs top-to-bottom across the glyphs, which is how team
  // lettering is normally graded. Built across the text's own bounds rather
  // than the canvas so the ramp doesn't get clipped by the padding.
  if (layer.gradient && layer.color2) {
    const grad = ctx.createLinearGradient(0, pad, 0, pad + ascent + descent);
    grad.addColorStop(0, layer.color || "#ffffff");
    grad.addColorStop(1, layer.color2);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = layer.color || "#ffffff";
  }
  ctx.fillText(text, pad, pad + ascent);

  return { texture: finish(canvas), aspect: w / h };
}

/** Renders a Remix Icon glyph as artwork, using the already-loaded icon font. */
function clipartTexture(layer) {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // remixicon exposes glyphs through a font family + CSS content codepoint.
  // Reading the codepoint off a probe element keeps this working if the icon
  // set is upgraded, instead of hardcoding a private-use-area table.
  const probe = document.createElement("i");
  probe.className = layer.icon || "";
  probe.style.display = "none";
  document.body.appendChild(probe);
  const content = getComputedStyle(probe, "::before").content || "";
  document.body.removeChild(probe);

  const glyph = content.replace(/["']/g, "") || "?";

  ctx.font = `${size * 0.8}px remixicon`;
  ctx.fillStyle = layer.color || "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, size / 2, size / 2);

  return { texture: finish(canvas), aspect: 1 };
}

/**
 * Loads an uploaded logo. Async because the bitmap has to decode before its
 * aspect ratio is known, and guessing that would squash non-square logos.
 */
function logoTexture(layer) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = img.width * scale;
      const h = img.height * scale;
      const canvas = makeCanvas(w, h);
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve({ texture: finish(canvas), aspect: w / h });
    };
    img.onerror = () => reject(new Error("Could not decode uploaded artwork"));
    img.src = layer.src;
  });
}

/**
 * Resolve any layer to `{ texture, aspect }`.
 *
 * `aspect` matters as much as the texture: DecalGeometry takes a box size,
 * and feeding it a square box would stretch a wide logo or a long team name.
 * Callers derive decal width/height from this so artwork keeps its
 * proportions on the garment.
 */
export async function buildLayerTexture(layer) {
  if (!layer) return null;
  if (layer.type === "text") return textTexture(layer);
  if (layer.type === "clipart") return clipartTexture(layer);
  // Skins are SVG data URIs generated from the customer's own colours (see
  // data/skins.js), so they decode through exactly the same path as an
  // uploaded logo — no separate rendering branch to keep in sync.
  if (layer.type === "logo" || layer.type === "skin") return logoTexture(layer);
  return null;
}
