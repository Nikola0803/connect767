/**
 * Listing match-scoring for the "AI Job Matching"-style quiz (inspired by
 * truckdriverjobs.co's "Get Matched" flow): answer a few quick questions,
 * get every listing ranked by a match percentage instead of a flat list.
 *
 * This is a transparent, documented heuristic — not a live ML model. It's
 * built as a drop-in for one because src/data/repository.js's
 * `matchListings()` calls this locally today and will call a real
 * `connect767/v1/match` endpoint once the WordPress plugin exists (see
 * WORDPRESS.md), returning the same `{ ...listing, matchScore }[]` shape
 * either way — nothing in MatchPage.jsx needs to change when that happens.
 */

const PRIORITY_WEIGHTS = {
  rating: { category: 25, price: 10, rating: 30, tier: 10, location: 10 },
  value: { category: 25, price: 30, rating: 10, tier: 5, location: 15 },
  location: { category: 20, price: 10, rating: 10, tier: 5, location: 40 },
  "top-tier": { category: 20, price: 10, rating: 10, tier: 35, location: 10 },
};

const DEFAULT_WEIGHTS = { category: 30, price: 15, rating: 20, tier: 10, location: 15 };

function scoreListing(listing, criteria) {
  const weights = PRIORITY_WEIGHTS[criteria.priority] || DEFAULT_WEIGHTS;
  let score = 0;
  let maxPossible = 0;

  // Category — either matches the requested category or doesn't apply.
  if (criteria.categorySlug) {
    maxPossible += weights.category;
    if (listing.categorySlug === criteria.categorySlug) score += weights.category;
  }

  // Price tier — any selected tier counts as a match.
  if (criteria.priceTiers?.length) {
    maxPossible += weights.price;
    if (criteria.priceTiers.includes(listing.price)) score += weights.price;
  }

  // Rating — always scored, scaled 0–1 against a 5-star max.
  maxPossible += weights.rating;
  const ratingValue = Math.min(parseFloat(listing.rating) || 0, 5);
  score += (ratingValue / 5) * weights.rating;

  // Tier badge — Classified/Featured listings get a relevance bump.
  maxPossible += weights.tier;
  if (listing.badge === "Classified") score += weights.tier;
  else if (listing.badge === "Featured") score += weights.tier * 0.6;

  // Location — loose substring match against the free-text location field.
  // (Gets meaningfully more precise once listings have structured
  // country/region/city fields instead of one flattened string.)
  if (criteria.location?.trim()) {
    maxPossible += weights.location;
    const needle = criteria.location.trim().toLowerCase();
    if (listing.location?.toLowerCase().includes(needle)) score += weights.location;
  }

  if (maxPossible === 0) return 50; // no criteria given — neutral score
  return Math.round(Math.min(99, Math.max(5, (score / maxPossible) * 100)));
}

/**
 * Ranks listings against quiz answers. `criteria` shape:
 *   { categorySlug, priceTiers: string[], location, priority }
 */
export function matchListingsLocally(listings, criteria) {
  return listings
    .map((listing) => ({ ...listing, matchScore: scoreListing(listing, criteria) }))
    .sort((a, b) => b.matchScore - a.matchScore);
}
