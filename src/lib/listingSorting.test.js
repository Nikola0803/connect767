import { describe, expect, it } from "vitest";
import { sortDirectoryListings } from "./listingSorting";

const listings = [
  {
    id: 1,
    title: "Older promoted listing",
    isFeatured: true,
    price: "$$",
    rating: "3.8",
    reviewCount: 12,
    reviews: "(12)",
    dateCreated: "2026-08-01T12:00:00Z",
  },
  {
    id: 2,
    title: "Newest listing",
    isFeatured: false,
    price: "$",
    rating: "4.6",
    reviewCount: 8,
    reviews: "(8)",
    dateCreated: "2026-11-14T12:00:00Z",
  },
  {
    id: 3,
    title: "Highest rated listing",
    isFeatured: false,
    price: "$$$",
    rating: "5",
    reviewCount: 6,
    reviews: "(6)",
    dateCreated: "2026-09-01T12:00:00Z",
  },
  {
    id: 4,
    title: "Most reviewed listing",
    isFeatured: false,
    price: "$$",
    rating: "4.2",
    reviewCount: 31,
    reviews: "(31)",
    dateCreated: "2026-10-01T12:00:00Z",
  },
];

describe("sortDirectoryListings", () => {
  it("places the most recently published listing first for Newest", () => {
    expect(sortDirectoryListings(listings, "newest").map(({ id }) => id)).toEqual([2, 4, 3, 1]);
  });

  it("sorts ratings and review totals before promotion status", () => {
    expect(sortDirectoryListings(listings, "rating").map(({ id }) => id)).toEqual([3, 2, 4, 1]);
    expect(sortDirectoryListings(listings, "reviews").map(({ id }) => id)).toEqual([4, 1, 2, 3]);
  });

  it("handles missing and legacy review values safely", () => {
    const legacyListings = [
      { id: 1, reviews: "6 reviews" },
      { id: 2, reviews: undefined },
      { id: 3, reviewCount: "10" },
    ];

    expect(sortDirectoryListings(legacyListings, "reviews").map(({ id }) => id)).toEqual([3, 1, 2]);
  });
});
