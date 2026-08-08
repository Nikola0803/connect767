/**
 * Maps a product's 2D placement keys (front / back / sleeve-left / ...) to a
 * 3D anchor on the procedural garment mesh — position, rotation (facing
 * direction) and the plane size the flat design gets projected onto.
 *
 * These are sensible defaults for the built-in product types. Zones an
 * admin adds through wp-admin (see connect767-cms's `product_type` CPT)
 * that don't match a known key still get a reasonable spot via
 * `resolveAnchor()`'s fuzzy fallback below, rather than crashing or
 * silently not rendering — new zones just default to a front-ish position
 * until someone (a developer) adds a precise anchor for that shape.
 */

const TAU = Math.PI * 2;

// Per-product-type named anchors, in the same local space GarmentModel.jsx
// builds each mesh in (see PRODUCT_DIMENSIONS there).
const ANCHORS = {
  // Rodin-generated jersey GLB: ~1.9m tall, sits on Y=0, depth ~0.43m.
  // Anchors tuned for the PBR model — adjust once we can see it live.
  jersey: {
    front: { position: [0, 0.9, 0.22], rotation: [0, 0, 0], size: [0.38, 0.5] },
    back:  { position: [0, 0.9, -0.22], rotation: [0, Math.PI, 0], size: [0.38, 0.5] },
    "sleeve-left":  { position: [-0.28, 1.3, 0.05], rotation: [0, -0.8, 0], size: [0.18, 0.18] },
    "sleeve-right": { position: [ 0.28, 1.3, 0.05], rotation: [0, 0.8, 0], size: [0.18, 0.18] },
  },
  tshirt: {
    front: { position: [0, 0.05, 0.62], rotation: [0, 0, 0], size: [0.85, 1.05] },
    back: { position: [0, 0.05, -0.62], rotation: [0, Math.PI, 0], size: [0.85, 1.05] },
    "sleeve-left": { position: [-1.32, 0.55, 0.18], rotation: [0, -0.95, 0], size: [0.38, 0.38] },
    "sleeve-right": { position: [1.32, 0.55, 0.18], rotation: [0, 0.95, 0], size: [0.38, 0.38] },
    "inside-label": { position: [0, 1.18, -0.18], rotation: [0, Math.PI, 0], size: [0.22, 0.22] },
  },
  hoodie: {
    front: { position: [0, -0.05, 0.68], rotation: [0, 0, 0], size: [0.85, 1.05] },
    back: { position: [0, -0.05, -0.68], rotation: [0, Math.PI, 0], size: [0.85, 1.05] },
    "sleeve-left": { position: [-1.4, 0.45, 0.2], rotation: [0, -0.95, 0], size: [0.4, 0.4] },
    "sleeve-right": { position: [1.4, 0.45, 0.2], rotation: [0, 0.95, 0], size: [0.4, 0.4] },
  },
  cap: {
    front: { position: [0, 0.1, 1.0], rotation: [0, 0, 0], size: [0.5, 0.38] },
    back: { position: [0, 0.15, -1.0], rotation: [0, Math.PI, 0], size: [0.42, 0.34] },
  },
  socks: {
    front: { position: [0, 0.1, 0.5], rotation: [0, 0, 0], size: [0.46, 0.85] },
  },
};

function fuzzyAnchor(key = "") {
  const k = key.toLowerCase();
  if (k.includes("back")) return { position: [0, 0.05, -0.62], rotation: [0, Math.PI, 0], size: [0.85, 1.05] };
  if (k.includes("left")) return { position: [-1.32, 0.55, 0.18], rotation: [0, -0.95, 0], size: [0.38, 0.38] };
  if (k.includes("right")) return { position: [1.32, 0.55, 0.18], rotation: [0, 0.95, 0], size: [0.38, 0.38] };
  if (k.includes("sleeve")) return { position: [-1.32, 0.55, 0.18], rotation: [0, -0.95, 0], size: [0.38, 0.38] };
  if (k.includes("label") || k.includes("inside"))
    return { position: [0, 1.18, -0.18], rotation: [0, Math.PI, 0], size: [0.22, 0.22] };
  // Unknown zone — default to front-facing.
  return { position: [0, 0.05, 0.62], rotation: [0, 0, 0], size: [0.85, 1.05] };
}

/** Resolve a placement key to a 3D anchor for the given product type slug. */
export function resolveAnchor(productSlug, placementKey) {
  const table = ANCHORS[productSlug] || ANCHORS.tshirt;
  return table[placementKey] || fuzzyAnchor(placementKey);
}

export { TAU };
