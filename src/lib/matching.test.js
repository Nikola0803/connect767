import { describe, it, expect } from "vitest";
import { matchListingsLocally } from "./matching";

const listings = [
  { id: 1, categorySlug: "tours", price: "$$", rating: "4.8", badge: "Classified", location: "Roseau, Dominica" },
  { id: 2, categorySlug: "finance", price: "$", rating: "3.5", badge: "Free", location: "Portsmouth" },
  { id: 3, categorySlug: "tours", price: "$", rating: "4.2", badge: "Featured", location: "Roseau" },
];

describe("matchListingsLocally", () => {
  it("returns every listing with a matchScore, sorted highest first", () => {
    const results = matchListingsLocally(listings, { categorySlug: "tours", priority: "rating" });
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r.matchScore).toBeGreaterThanOrEqual(0));
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].matchScore).toBeGreaterThanOrEqual(results[i].matchScore);
    }
  });

  it("scores a category match higher than a non-match, all else equal", () => {
    const results = matchListingsLocally(listings, { categorySlug: "tours", priority: "rating" });
    const matchIds = results.filter((r) => r.categorySlug === "tours").map((r) => r.id);
    const nonMatch = results.find((r) => r.categorySlug === "finance");
    // Both tour listings should generally outrank the unrelated finance one
    // once category is part of the criteria.
    expect(Math.max(...results.filter((r) => matchIds.includes(r.id)).map((r) => r.matchScore))).toBeGreaterThan(
      nonMatch.matchScore
    );
  });

  it("with no filter criteria, still ranks purely by rating + tier quality signals", () => {
    // rating and tier are unconditionally factored into maxPossible/score
    // (see scoreListing in matching.js) — they're intrinsic quality
    // signals, not opt-in "criteria" like category/price/location, so an
    // empty criteria object does NOT fall into the `maxPossible === 0`
    // "neutral 50" branch; it naturally produces a real ranking driven by
    // rating and the Classified/Featured tier bump. This asserts that
    // real (and, in practice, more useful) behavior explicitly so it
    // doesn't silently regress.
    const results = matchListingsLocally(listings, {});
    const byId = Object.fromEntries(results.map((r) => [r.id, r.matchScore]));

    // Listing 1: 4.8 rating, Classified tier — should score highest.
    // Listing 2: 3.5 rating, Free tier — should score lowest.
    // Listing 3: 4.2 rating, Featured tier — should land in between.
    expect(byId[1]).toBeGreaterThan(byId[3]);
    expect(byId[3]).toBeGreaterThan(byId[2]);
  });

  it("never scores below 5 or above 99", () => {
    const results = matchListingsLocally(listings, {
      categorySlug: "finance",
      priceTiers: ["$$$"],
      location: "nowhere",
      priority: "value",
    });
    results.forEach((r) => {
      expect(r.matchScore).toBeGreaterThanOrEqual(5);
      expect(r.matchScore).toBeLessThanOrEqual(99);
    });
  });

  it("does not mutate the original listing objects", () => {
    const original = JSON.parse(JSON.stringify(listings));
    matchListingsLocally(listings, { categorySlug: "tours", priority: "location", location: "Roseau" });
    expect(listings).toEqual(original);
  });
});
