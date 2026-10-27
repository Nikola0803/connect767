import { describe, expect, it } from "vitest";
import { listingOwnerMessagePath } from "./ListingProfile";

describe("listing owner messaging", () => {
  it("is available for published profiles regardless of booking status", () => {
    const listing = { slug: "island-services", title: "Island Services" };

    expect(listingOwnerMessagePath({ ...listing, bookingEnabled: false })).toBe(
      "/messages?listing=island-services&title=Island%20Services",
    );
    expect(listingOwnerMessagePath({ ...listing, bookingEnabled: true })).toBe(
      "/messages?listing=island-services&title=Island%20Services",
    );
  });

  it("uses a disabled preview control until the listing has a published route", () => {
    expect(listingOwnerMessagePath({ title: "Draft Listing" }, true)).toBe("");
  });
});
