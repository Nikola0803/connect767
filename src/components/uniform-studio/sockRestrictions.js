const SOCK_VIEWS = new Set(["front", "side", "back"]);

/**
 * Soccer socks are a production-only solid-colour zone. They may be
 * recoloured, but printable artwork (text, logos and patterns) is not
 * permitted there. The explicit SVG zone is preferred; the y fallback also
 * protects older saved layers and drag operations that predate zone tagging.
 */
export function isRestrictedSoccerSockPlacement({ sport, view, zone, y } = {}) {
  if (sport !== "soccer" || !SOCK_VIEWS.has(view)) return false;
  if (zone === "socks") return true;
  return Number.isFinite(Number(y)) && Number(y) >= 65;
}

export function removeRestrictedSoccerSockLayers(layers = [], sport = "soccer") {
  if (!Array.isArray(layers)) return [];
  return layers.filter((layer) => !isRestrictedSoccerSockPlacement({ sport, ...layer }));
}
