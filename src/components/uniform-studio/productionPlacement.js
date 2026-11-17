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

export function productionTextLayout(element = {}) {
  if (element.layout === "stacked" || element.textLayout === "stacked") return "stacked";
  if (element.layout === "single-line" || element.textLayout === "single-line") return "single-line";
  const words = String(element.content || element.text || "").trim().split(/\s+/).filter(Boolean);
  return words.length === 2 && words.join(" ").length >= 10 ? "stacked" : "single-line";
}

export function formatProductionText(content = "", layout = "single-line") {
  const explicitLines = String(content)
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (explicitLines.length > 1) return explicitLines.join("\n");
  const normalized = explicitLines[0] || "";
  if (layout !== "stacked") return normalized;
  const words = normalized.split(" ");
  if (words.length < 2) return normalized;
  if (words.length === 2) return words.join("\n");
  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
}

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
  const textLayout = productionTextLayout(element);
  const formattedText = formatProductionText(content, textLayout);
  const longestLine = Math.max(...formattedText.split("\n").map((line) => line.length));

  let size = requestedSize;
  if (element.kind === "artwork") {
    size = clamp(requestedSize * area.artworkScale, 3, view === "side" ? 12 : 18);
  } else if (longestLine > 3) {
    // Prevent team and sponsor names from extending over the armholes.
    size = Math.min(requestedSize, Math.max(1, 31 / longestLine));
  }

  return {
    view,
    x: Math.abs(sourceX - 50) <= 5
      ? 50
      : area.left + ((area.right - area.left) * sourceX) / 100,
    y: area.top + ((area.bottom - area.top) * sourceY) / 100,
    size,
  };
}

export function normalizeStoredProductionLayer(layer = {}, sport = "soccer") {
  if (layer.source !== "ai-uniform-element" || layer.placementSpace === "garment-v3") return layer;
  const textLayout = layer.type === "text" ? productionTextLayout(layer) : layer.textLayout;
  const text = layer.type === "text" ? formatProductionText(layer.text, textLayout) : layer.text;
  if (layer.placementSpace === "garment-v2") {
    return {
      ...layer,
      x: Math.abs(Number(layer.x) - 50) <= 3 ? 50 : layer.x,
      text,
      textLayout,
      placementSpace: "garment-v3",
    };
  }
  if (layer.placementSpace === "garment-v1") {
    const view = ["front", "side", "back"].includes(layer.view) ? layer.view : "front";
    const legacyArea = LEGACY_VIEW_PRINT_AREAS[view];
    const area = printAreaFor(view, sport);
    const sourceY = clamp(((Number(layer.y) - legacyArea.top) / (legacyArea.bottom - legacyArea.top)) * 100, 0, 100);
    return {
      ...layer,
      y: area.top + ((area.bottom - area.top) * sourceY) / 100,
      x: Math.abs(Number(layer.x) - 50) <= 3 ? 50 : layer.x,
      text,
      textLayout,
      placementSpace: "garment-v3",
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
  return { ...layer, ...placement, text, textLayout, placementSpace: "garment-v3" };
}

export { BASE_VIEW_PRINT_AREAS as VIEW_PRINT_AREAS, SPORT_VERTICAL_PRINT_AREAS };
