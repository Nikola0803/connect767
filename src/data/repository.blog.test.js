import { describe, expect, it } from "vitest";
import { findBlogPostForListing } from "./repository";

describe("classified listing blog relationships", () => {
  it("prefers the explicit listing slug configured in WordPress", () => {
    const posts = [
      {
        slug: "profile-story",
        title: "A completely custom headline",
        relatedListingSlug: "kelsons-auto-sales",
      },
    ];

    expect(
      findBlogPostForListing(posts, {
        slug: "kelsons-auto-sales",
        title: "Kelson's Auto Sales",
      }),
    ).toEqual(posts[0]);
  });

  it("connects older spotlight posts when the full listing name is in the title", () => {
    const posts = [
      {
        slug: "spotlight-kalinago-tours",
        title: "Community Spotlight: Kalinago Tours brings the territory's story to visitors",
      },
    ];

    expect(
      findBlogPostForListing(posts, {
        slug: "kalinago-tours",
        title: "Kalinago Tours",
      }),
    ).toEqual(posts[0]);
  });

  it("does not attach an unrelated article", () => {
    expect(
      findBlogPostForListing(
        [{ slug: "shipping-guide", title: "Shipping labels and you" }],
        { slug: "kelsons-auto-sales", title: "Kelson's Auto Sales" },
      ),
    ).toBeNull();
  });
});
