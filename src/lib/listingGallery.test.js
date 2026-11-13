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

  it("removes a separately uploaded WordPress copy of the cover photo", () => {
    expect(dedupeListingGallery([
      {
        alt: "MJ’s Elegant Suite cover photo",
        src: "https://admin.connect767.com/wp-content/uploads/2026/08/night-view.jpg",
      },
      {
        alt: "night view",
        src: "https://admin.connect767.com/wp-content/uploads/2026/08/night-view-1.jpg",
      },
      {
        alt: "house view",
        src: "https://admin.connect767.com/wp-content/uploads/2026/08/house-view-1.jpg",
      },
    ])).toEqual([
      {
        alt: "MJ’s Elegant Suite cover photo",
        src: "https://admin.connect767.com/wp-content/uploads/2026/08/night-view.jpg",
      },
      {
        alt: "house view",
        src: "https://admin.connect767.com/wp-content/uploads/2026/08/house-view-1.jpg",
      },
    ]);
  });

  it("keeps numbered gallery photos when they are not copies of the cover", () => {
    expect(dedupeListingGallery([
      { alt: "Cover", src: "https://example.com/wp-content/uploads/hero.jpg" },
      { alt: "Room one", src: "https://example.com/wp-content/uploads/room.jpg" },
      { alt: "Room two", src: "https://example.com/wp-content/uploads/room-1.jpg" },
    ])).toHaveLength(3);
  });
});
