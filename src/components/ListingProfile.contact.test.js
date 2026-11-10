import { describe, expect, it } from "vitest";
import { listingContactActionLinks } from "./ListingProfile";

describe("listingContactActionLinks", () => {
  it("keeps every contact action hidden when its listing-form field is empty", () => {
    expect(
      listingContactActionLinks({
        phone: "   ",
        websiteUrl: "",
        whatsapp: "not entered",
      }),
    ).toEqual({ call: "", website: "", whatsapp: "" });
  });

  it("creates only the actions whose listing-form fields contain usable values", () => {
    expect(
      listingContactActionLinks({
        phone: "+1 (767) 555-0100",
        websiteUrl: "",
        whatsapp: "+1 (767) 555-0199",
      }),
    ).toEqual({
      call: "tel:+17675550100",
      website: "",
      whatsapp: "https://wa.me/17675550199",
    });
  });

  it("shows the website action only when a website URL is present", () => {
    expect(listingContactActionLinks({ websiteUrl: "https://connect767.com" })).toEqual({
      call: "",
      website: "https://connect767.com",
      whatsapp: "",
    });
  });
});
