import { describe, expect, it } from "vitest";
import {
  isVariationOptionAvailable,
  matchVariation,
  normalizeVariationAttributeName,
  normalizeVariationValue,
} from "./productVariations";

describe("product variation matching", () => {
  const variations = [
    {
      id: 1,
      attributes: { color: "navy-blue", size: "small" },
      inStock: true,
      purchasable: true,
    },
    {
      id: 2,
      attributes: { color: "navy-blue", size: "large" },
      inStock: false,
      purchasable: true,
    },
    {
      id: 3,
      attributes: { color: "forest-green", size: "" },
      inStock: true,
      purchasable: true,
    },
  ];

  it("matches human-readable labels to WooCommerce slugs", () => {
    expect(matchVariation(variations, { Color: "Navy Blue", Size: "Small" })?.id).toBe(1);
  });

  it("supports WooCommerce's empty-value wildcard variations", () => {
    expect(matchVariation(variations, { Color: "Forest Green", Size: "XL" })?.id).toBe(3);
  });

  it("returns no result for a combination that does not exist", () => {
    expect(matchVariation(variations, { Color: "Navy Blue", Size: "XL" })).toBeUndefined();
  });

  it("only offers options backed by a purchasable in-stock variation", () => {
    expect(isVariationOptionAvailable(variations, { Color: "Navy Blue" }, "Size", "Small")).toBe(true);
    expect(isVariationOptionAvailable(variations, { Color: "Navy Blue" }, "Size", "Large")).toBe(false);
  });

  it("normalizes attribute names and accented values consistently", () => {
    expect(normalizeVariationAttributeName("attribute_pa_Shoe Size")).toBe("shoe-size");
    expect(normalizeVariationValue("Cafe & Cream")).toBe("cafe-and-cream");
  });
});
