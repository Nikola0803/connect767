import { describe, expect, it } from "vitest";
import { arrangeStorefrontProducts } from "./storefront";

describe("arrangeStorefrontProducts", () => {
  const products = [
    { id: 1, name: "First" },
    { id: 2, name: "Second" },
    { id: 3, name: "Third" },
  ];

  it("applies the saved order and separates featured products", () => {
    const result = arrangeStorefrontProducts(products, {
      productOrder: [3, 1, 2],
      featuredProductIds: [1],
    });

    expect(result.all.map((product) => product.id)).toEqual([3, 1, 2]);
    expect(result.featured.map((product) => product.id)).toEqual([1]);
    expect(result.collection.map((product) => product.id)).toEqual([3, 2]);
  });

  it("preserves the original order when no customization exists", () => {
    expect(arrangeStorefrontProducts(products).all).toEqual(products);
  });
});
