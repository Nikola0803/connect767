/**
 * Turn public listing-profile data into one consistent, accent-insensitive
 * search index. Objects and arrays are walked recursively so attributes such
 * as tags, amenities, hours, reviews, and contact details remain searchable.
 */
export function normalizeListingSearchValue(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function collectSearchValues(value, output) {
  if (value === null || value === undefined || value === false) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchValues(item, output));
    return;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectSearchValues(item, output));
    return;
  }

  const normalized = normalizeListingSearchValue(value);
  if (normalized) output.push(normalized);
}

export function createListingSearchText(publicProfile) {
  const values = [];
  collectSearchValues(publicProfile, values);
  return [...new Set(values)].join(" ");
}

export function listingMatchesSearch(listing, query) {
  const terms = normalizeListingSearchValue(query).split(" ").filter(Boolean);
  if (!terms.length) return true;

  const haystack = listing.searchText || createListingSearchText(listing);
  return terms.every((term) => haystack.includes(term));
}
