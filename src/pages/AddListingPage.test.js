import { describe, expect, it } from "vitest";
import { savedBookingSelection, savedSellProductsSelection } from "./AddListingPage";

describe("savedSellProductsSelection", () => {
  it("prefers the authenticated owner's saved storefront choice", () => {
    const publicListing = { id: 42, slug: "james-local-fruits", sellProducts: false };
    const ownedListings = [
      { id: 42, slug: "james-local-fruits", sellProducts: true },
    ];

    expect(savedSellProductsSelection(publicListing, ownedListings)).toBe(true);
  });

  it("falls back to the public listing when owner data is unavailable", () => {
    expect(savedSellProductsSelection({ id: 42, sellProducts: true }, [])).toBe(true);
  });
});

describe("savedBookingSelection", () => {
  it("prefers the authenticated owner's saved booking choice", () => {
    const publicListing = { id: 42, slug: "james-local-fruits", bookingEnabled: false };
    const ownedListings = [
      { id: 42, slug: "james-local-fruits", bookingEnabled: true },
    ];

    expect(savedBookingSelection(publicListing, ownedListings)).toBe(true);
  });

  it("falls back to the public listing when owner data is unavailable", () => {
    expect(savedBookingSelection({ id: 42, bookingEnabled: true }, [])).toBe(true);
  });
});
