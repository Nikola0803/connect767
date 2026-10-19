import { describe, expect, it } from "vitest";
import {
  createListingSearchText,
  listingMatchesSearch,
  normalizeListingSearchValue,
} from "./listingSearch";

describe("listing profile search", () => {
  const listing = {
    title: "Café Créole",
    description: "Island cooking and private catering",
    tags: ["local food", "chef"],
    amenities: ["Wheelchair accessible"],
    hours: ["Mon–Sat 9am–6pm"],
    contact: {
      phone: "767-555-0199",
      email: "hello@example.dm",
    },
    reviews: [{ name: "Amara", text: "Wonderful cassava bread" }],
    attributes: { parish: "Saint George", experience: 12 },
  };

  it("indexes nested text, numbers, characters, and profile attributes", () => {
    const searchText = createListingSearchText(listing);

    expect(searchText).toContain("767-555-0199");
    expect(searchText).toContain("hello@example.dm");
    expect(searchText).toContain("wheelchair accessible");
    expect(searchText).toContain("wonderful cassava bread");
    expect(searchText).toContain("saint george");
    expect(searchText).toContain("12");
  });

  it("matches every term across different profile fields", () => {
    const indexed = { ...listing, searchText: createListingSearchText(listing) };
    expect(listingMatchesSearch(indexed, "chef Saint George")).toBe(true);
    expect(listingMatchesSearch(indexed, "cassava 767-555")).toBe(true);
    expect(listingMatchesSearch(indexed, "chef Portsmouth")).toBe(false);
  });

  it("matches accented text when visitors type plain characters", () => {
    const indexed = { ...listing, searchText: createListingSearchText(listing) };
    expect(normalizeListingSearchValue("Créole")).toBe("creole");
    expect(listingMatchesSearch(indexed, "cafe creole")).toBe(true);
  });
});
