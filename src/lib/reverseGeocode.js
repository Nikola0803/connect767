const reverseGeocodeCache = new Map();
let reverseGeocodeQueue = Promise.resolve();
let lastRequestStartedAt = 0;

function queueRequest(request) {
  const run = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestStartedAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestStartedAt = Date.now();
    return request();
  };
  reverseGeocodeQueue = reverseGeocodeQueue.then(run, run);
  return reverseGeocodeQueue;
}

function uniqueParts(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    const value = String(part || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function placeNameFromAddress(address = {}) {
  const locality = address.city
    || address.town
    || address.village
    || address.municipality
    || address.locality
    || address.suburb
    || address.neighbourhood
    || address.county;
  const region = address.state || address.state_district || address.county;
  return uniqueParts([locality, region, address.country]).join(", ");
}

/** Coordinates -> city/region/country. Requests are cached by an approximately 11 m cell. */
export async function reverseGeocodeLocation(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key);

  const request = queueRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const query = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lon),
        zoom: "14",
        addressdetails: "1",
        "accept-language": "en",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = await response.json();
      return placeNameFromAddress(data.address) || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  });

  reverseGeocodeCache.set(key, request);
  return request;
}

export function isLegacyCoordinateLabel(value) {
  return /^live location\s*[·:-]\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/i.test(String(value || "").trim());
}
