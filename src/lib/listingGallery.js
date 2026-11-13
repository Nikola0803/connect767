function mediaIdentity(src) {
  const value = String(src || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value, "https://connect767.local");
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function wordpressUploadIdentity(identity) {
  if (!identity || !/\/wp-content\/uploads\//i.test(identity)) return "";

  return identity.replace(
    /(?:(?:-\d+x\d+)|-scaled|-\d+)+(\.[a-z0-9]+)$/i,
    "$1",
  );
}

/**
 * Keep the first occurrence of each listing image. WordPress may return the
 * featured cover again in ACF's gallery (sometimes with a cache-busting query
 * string), but the cover should appear only once as the profile hero.
 */
export function dedupeListingGallery(images = []) {
  const seen = new Set();
  let coverWordPressIdentity = "";
  let keptCount = 0;

  return (Array.isArray(images) ? images : []).filter((image) => {
    const key = mediaIdentity(image?.src);
    if (!key || seen.has(key)) return false;

    const wordpressIdentity = wordpressUploadIdentity(key);
    if (keptCount === 0) {
      coverWordPressIdentity = wordpressIdentity;
    } else if (coverWordPressIdentity && wordpressIdentity === coverWordPressIdentity) {
      return false;
    }

    seen.add(key);
    keptCount += 1;
    return true;
  });
}
