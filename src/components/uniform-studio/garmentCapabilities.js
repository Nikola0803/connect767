const placementTools = ["text", "logo", "remove-bg", "skins"];

const zone = (id, label, views, tools = ["design", ...placementTools]) => ({
  id,
  label,
  views,
  tools,
});

const profiles = {
  soccer: {
    label: "Soccer full kit",
    correctionCapable: true,
    zones: [
      zone("body", "Shirt body", ["front", "side", "back"]),
      zone("collar", "Collar", ["front", "side", "back"], ["design"]),
      zone("sleeves", "Sleeves", ["front", "side", "back"]),
      zone("shorts", "Shorts", ["front", "side", "back"]),
      zone("socks", "Socks", ["front", "side", "back"], ["design", "logo", "skins"]),
      zone("trim", "Garment trim", ["front", "side", "back"], ["design", "skins"]),
    ],
  },
  basketball: {
    label: "Basketball kit",
    zones: [
      zone("body", "Jersey body", ["front", "side", "back"]),
      zone("neckline", "Neckline", ["front", "side", "back"], ["design"]),
      zone("armholes", "Armholes", ["front", "side", "back"], ["design"]),
      zone("shorts", "Shorts", ["front", "side", "back"]),
      zone("trim", "Garment trim", ["front", "side", "back"], ["design", "skins"]),
    ],
  },
  netball: {
    label: "Netball dress",
    zones: [
      zone("body", "Dress body", ["front", "side", "back"]),
      zone("neckline", "Neckline", ["front", "side", "back"], ["design"]),
      zone("side-panels", "Side panels", ["front", "side", "back"]),
      zone("hem", "Hem trim", ["front", "side", "back"], ["design", "skins"]),
    ],
  },
  cricket: {
    label: "Cricket kit",
    zones: [
      zone("body", "Shirt body", ["front", "side", "back"]),
      zone("collar", "Collar", ["front", "side", "back"], ["design"]),
      zone("sleeves", "Sleeves", ["front", "side", "back"]),
      zone("trousers", "Trousers", ["front", "side", "back"]),
      zone("trim", "Garment trim", ["front", "side", "back"], ["design", "skins"]),
    ],
  },
  goalkeeper: {
    label: "Goalkeeper kit",
    zones: [
      zone("body", "Shirt body", ["front", "side", "back"]),
      zone("collar", "Collar", ["front", "side", "back"], ["design"]),
      zone("sleeves", "Sleeves", ["front", "side", "back"]),
      zone("shorts", "Shorts", ["front", "side", "back"]),
      zone("socks", "Socks", ["front", "side", "back"], ["design", "logo", "skins"]),
      zone("trim", "Garment trim", ["front", "side", "back"], ["design", "skins"]),
    ],
  },
  other: {
    label: "All-sport kit",
    zones: [
      zone("body", "Shirt body", ["front", "side", "back"]),
      zone("collar", "Collar", ["front", "side", "back"], ["design"]),
      zone("sleeves", "Sleeves", ["front", "side", "back"]),
      zone("bottoms", "Bottoms", ["front", "side", "back"]),
      zone("trim", "Garment trim", ["front", "side", "back"], ["design", "skins"]),
    ],
  },
};

const hasVerifiedTracedZones = (zoneModel) =>
  ["front", "back"].every((side) =>
    Array.isArray(zoneModel?.[side])
    && zoneModel[side].length > 0
    && zoneModel[side].every((item) => item?.id && item?.path)
  );

export function detectGarmentCapabilities({
  sport = "other",
  view = "front",
  canvasMode = "production",
  hasConceptImage = false,
  zoneModel,
  layerCount = 0,
} = {}) {
  const profile = profiles[sport] || profiles.other;
  const previewOnly = canvasMode === "concept" && hasConceptImage;
  const sleeveView = view === "sleeve-left" || view === "sleeve-right";
  const capabilityView = sleeveView ? "side" : view;
  const visibleZones = profile.zones.filter((item) =>
    item.views.includes(capabilityView)
    && (!sleeveView || item.id === "sleeves")
  );
  // Setup, AI generation and order steps operate on the garment definition,
  // rather than painting pixels onto the current canvas, so they remain valid
  // while a generated/reference image is being shown as a preview.
  const verifiedTools = new Set(["design", "ai", "roster", "review"]);

  if (!previewOnly) {
    for (const item of visibleZones) {
      item.tools.forEach((tool) => verifiedTools.add(tool));
    }
    if (profile.correctionCapable && hasVerifiedTracedZones(zoneModel)) verifiedTools.add("zones");
    // Layers is a valid production-surface tool even before the first item is
    // added: its empty state explains what will appear there and keeps the
    // Keep Step 1 Design navigation stable as artwork is created.
    verifiedTools.add("layers");
  }

  return {
    garment: profile.label,
    previewOnly,
    view,
    zones: visibleZones,
    verifiedTools,
    canUse(tool) {
      return verifiedTools.has(tool);
    },
    status: previewOnly
      ? "Preview image detected. Apply its production layout to unlock zone editing."
      : sleeveView
        ? `${view === "sleeve-left" ? "Left" : "Right"} sleeve placement verified for text and logos.`
        : `${visibleZones.length} editable ${view} zones verified.`,
  };
}

export function firstSupportedTool(toolKeys, capabilities) {
  return toolKeys.find((key) => capabilities.canUse(key)) || null;
}

