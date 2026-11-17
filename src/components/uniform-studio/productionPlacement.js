const BASE_VIEW_PRINT_AREAS = {
  front: { left: 36, right: 64, top: 13, bottom: 35, artworkScale: 0.42 },
  side: { left: 43, right: 57, top: 13, bottom: 36, artworkScale: 0.28 },
  back: { left: 36, right: 64, top: 13, bottom: 35, artworkScale: 0.42 },
};

const SPORT_VERTICAL_PRINT_AREAS = {
  soccer: { front: [13, 35], side: [13, 36], back: [13, 35] },
  basketball: { front: [17, 42], side: [16, 43], back: [16, 41] },
  netball: { front: [14, 39], side: [14, 40], back: [14, 39] },
  cricket: { front: [11, 34], side: [11, 35], back: [11, 34] },
  goalkeeper: { front: [10, 33], side: [10, 34], back: [10, 33] },
  other: { front: [22, 45], side: [21, 46], back: [22, 45] },
};

const LEGACY_VIEW_PRINT_AREAS = {
  front: { top: 15, bottom: 64 },
  side: { top: 15, bottom: 66 },
  back: { top: 15, bottom: 64 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Convert AI printable-surface percentages into the editor card coordinates. */
const printAreaFor = (view, sport) => {
  const area = BASE_VIEW_PRINT_AREAS[view];
  const vertical = SPORT_VERTICAL_PRINT_AREAS[sport]?.[view];
  return vertical ? { ...area, top: vertical[0], bottom: vertical[1] } : area;
};

export function mapProductionElementToGarment(element = {}, sport = "soccer") {
  const view = ["front", "side", "back"].includes(element.view) ? element.view : "front";
  const area = printAreaFor(view, sport);
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

export function normalizeStoredProductionLayer(layer = {}, sport = "soccer") {
  if (layer.source !== "ai-uniform-element" || layer.placementSpace === "garment-v2") return layer;
  if (layer.placementSpace === "garment-v1") {
    const view = ["front", "side", "back"].includes(layer.view) ? layer.view : "front";
    const legacyArea = LEGACY_VIEW_PRINT_AREAS[view];
    const area = printAreaFor(view, sport);
    const sourceY = clamp(((Number(layer.y) - legacyArea.top) / (legacyArea.bottom - legacyArea.top)) * 100, 0, 100);
    return {
      ...layer,
      y: area.top + ((area.bottom - area.top) * sourceY) / 100,
      placementSpace: "garment-v2",
    };
  }
  const placement = mapProductionElementToGarment({
    kind: layer.type === "logo" ? "artwork" : "text",
    view: layer.view,
    x: layer.x,
    y: layer.y,
    size: layer.size,
    content: layer.text,
  }, sport);
  return { ...layer, ...placement, placementSpace: "garment-v2" };
}

export { BASE_VIEW_PRINT_AREAS as VIEW_PRINT_AREAS, SPORT_VERTICAL_PRINT_AREAS };
