import { describe, expect, it } from "vitest";
import { dedupeListingGallery } from "./listingGallery";

describe("dedupeListingGallery", () => {
  it("keeps a cover photo only once when the gallery repeats it", () => {
    const cover = "https://admin.connect767.com/uploads/cover.jpg";
    const result = dedupeListingGallery([
      { alt: "Cover photo", src: cover },
      { alt: "Repeated cover", src: `${cover}?cache=123` },
      { alt: "Gallery photo", src: "https://admin.connect767.com/uploads/gallery.jpg" },
    ]);

    expect(result).toEqual([
      { alt: "Cover photo", src: cover },
      { alt: "Gallery photo", src: "https://admin.connect767.com/uploads/gallery.jpg" },
    ]);
  });

  it("removes blank and repeated gallery entries while preserving order", () => {
    expect(dedupeListingGallery([
      { alt: "First", src: "/uploads/first.jpg" },
      { alt: "Blank", src: "" },
      { alt: "First duplicate", src: "/uploads/first.jpg#duplicate" },
      { alt: "Second", src: "/uploads/second.jpg" },
    ])).toEqual([
      { alt: "First", src: "/uploads/first.jpg" },
      { alt: "Second", src: "/uploads/second.jpg" },
    ]);
  });
});
