/**
 * Mapbox — used to show a listing's location on ListingProfile.jsx.
 *
 * Listings only ever store a free-text `location` string (e.g. "Roseau,
 * Dominica"), not real coordinates — there's no lat/lng field anywhere in
 * the wizard, the local fixtures, or the WP ACF schema yet (`mapEmbedUrl`
 * was the only map-related field, and every fixture/preview left it null,
 * which is why the map section silently never rendered). Geocoding the
 * location string client-side with Mapbox's own Geocoding API sidesteps
 * needing a schema change just to get a map showing again.
 *
 * This is a public token (`pk.*`) — safe to ship in client-side code, that's
 * how Mapbox tokens are designed to be used, restricted via URL allow-list
 * from the Mapbox account dashboard rather than kept secret. It's still read
 * from an env var (not hardcoded here) so it isn't sitting in tracked source
 * — GitHub's secret scanner flags Mapbox token patterns regardless of
 * pk/sk prefix, and this keeps rotation a one-line change.
 *
 * Set VITE_MAPBOX_TOKEN in .env.local (gitignored, not committed).
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

if (!MAPBOX_TOKEN && import.meta.env.DEV) {
  console.warn(
    "[mapbox] VITE_MAPBOX_TOKEN is not set — add it to .env.local. Map features will be disabled."
  );
}

const geocodeCache = new Map();

/** Free-text place name -> { lng, lat }, or null if it couldn't be resolved. */
export async function geocodeLocation(query) {
  if (!query || !MAPBOX_TOKEN) return null;
  if (geocodeCache.has(query)) return geocodeCache.get(query);

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const [lng, lat] = data.features?.[0]?.center || [];
    const result = Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    geocodeCache.set(query, result);
    return result;
  } catch {
    return null;
  }
}

/** Static map image URL (no JS map library needed) centered on a pin. */
export function staticMapUrl({ lng, lat }, { width = 640, height = 320, zoom = 12 } = {}) {
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+e11d48(${lng},${lat})/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}
