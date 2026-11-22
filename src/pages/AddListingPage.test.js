import { describe, expect, it } from "vitest";
import {
  contactEmailForNextStep,
  missingBusinessRequiredFieldIds,
  savedBookingSelection,
  savedIndustrySelection,
  savedSellProductsSelection,
} from "./AddListingPage";

describe("contactEmailForNextStep", () => {
  it("copies the new account email into a blank contact email", () => {
    expect(contactEmailForNextStep("", "owner@example.com", "")).toBe("owner@example.com");
  });

  it("uses the authenticated account email when no new account is being created", () => {
    expect(contactEmailForNextStep("", "", "member@example.com")).toBe("member@example.com");
  });

  it("preserves an explicitly entered contact email", () => {
    expect(contactEmailForNextStep("contact@example.com", "owner@example.com", "member@example.com")).toBe("contact@example.com");
  });
});

describe("savedIndustrySelection", () => {
  it("prefers the authenticated owner's exact saved industry", () => {
    const publicListing = { id: 42, slug: "island-accounting", categorySlug: "services" };
    const ownedListings = [{
      id: 42,
      slug: "island-accounting",
      industrySlug: "accounting-and-bookkeeping",
    }];

    expect(savedIndustrySelection(publicListing, ownedListings)).toBe(
      "accounting-and-bookkeeping",
    );
  });

  it("recovers the industry from legacy owner category labels", () => {
    expect(
      savedIndustrySelection(
        { id: 42, categorySlug: "services" },
        [{ id: 42, category: "Services, Accounting & Bookkeeping" }],
      ),
    ).toBe("accounting-and-bookkeeping");
  });
});

describe("missingBusinessRequiredFieldIds", () => {
  it("flags Industry and every other mandatory business field", () => {
    expect(missingBusinessRequiredFieldIds({})).toEqual([
      "businessName",
      "category",
      "priceTier",
      "yearsExperience",
      "description",
      "location",
    ]);
  });

  it("accepts a canonical saved industry slug", () => {
    expect(
      missingBusinessRequiredFieldIds({
        businessName: "Island Accounting",
        category: "accounting-and-bookkeeping",
        priceTier: "$$",
        yearsExperience: "7",
        description: "Accounting services",
        location: "Roseau, Dominica",
      }),
    ).toEqual([]);
  });
});

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
