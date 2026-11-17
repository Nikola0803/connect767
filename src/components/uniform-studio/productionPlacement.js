const VIEW_PRINT_AREAS = {
  front: { left: 36, right: 64, top: 15, bottom: 64, artworkScale: 0.42 },
  side: { left: 43, right: 57, top: 15, bottom: 66, artworkScale: 0.28 },
  back: { left: 36, right: 64, top: 15, bottom: 64, artworkScale: 0.42 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Convert AI printable-surface percentages into the editor card coordinates. */
export function mapProductionElementToGarment(element = {}) {
  const view = ["front", "side", "back"].includes(element.view) ? element.view : "front";
  const area = VIEW_PRINT_AREAS[view];
  const sourceX = clamp(Number(element.x) || 50, 0, 100);
  const sourceY = clamp(Number(element.y) || 35, 0, 100);
  const requestedSize = clamp(
    Number(element.size) || (element.kind === "artwork" ? 20 : 14),
    1,
    120,
  );
  const content = String(element.content || "TEAM").trim();

  let size = requestedSize;
  if (element.kind === "artwork") {
    size = clamp(requestedSize * area.artworkScale, 3, view === "side" ? 12 : 18);
  } else if (content.length > 3) {
    // Prevent team and sponsor names from extending over the armholes.
    size = Math.min(requestedSize, Math.max(1, 31 / content.length));
  }

  return {
    view,
    x: area.left + ((area.right - area.left) * sourceX) / 100,
    y: area.top + ((area.bottom - area.top) * sourceY) / 100,
    size,
  };
}

export function normalizeStoredProductionLayer(layer = {}) {
  if (layer.source !== "ai-uniform-element" || layer.placementSpace === "garment-v1") return layer;
  const placement = mapProductionElementToGarment({
    kind: layer.type === "logo" ? "artwork" : "text",
    view: layer.view,
    x: layer.x,
    y: layer.y,
    size: layer.size,
    content: layer.text,
  });
  return { ...layer, ...placement, placementSpace: "garment-v1" };
}

export { VIEW_PRINT_AREAS };
