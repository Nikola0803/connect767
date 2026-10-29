import { describe, expect, it } from "vitest";
import { productMatchesCategory, productMatchesSearch } from "./productCategories";

const multiCategoryProduct = {
  title: "High Waisted Biker Shorts",
  category: "Activewear",
  categorySlug: "activewear",
  categories: [
    { name: "Activewear", slug: "activewear" },
    { name: "Leggings", slug: "leggings" },
    { name: "Shorts", slug: "shorts" },
  ],
  tags: ["Athletic"],
};

describe("shop product category matching", () => {
  it("matches every category assigned to a product", () => {
    expect(productMatchesCategory(multiCategoryProduct, "activewear")).toBe(true);
    expect(productMatchesCategory(multiCategoryProduct, "leggings")).toBe(true);
    expect(productMatchesCategory(multiCategoryProduct, "shorts")).toBe(true);
    expect(productMatchesCategory(multiCategoryProduct, "t-shirts")).toBe(false);
  });

  it("searches every assigned category", () => {
    expect(productMatchesSearch(multiCategoryProduct, "leggings")).toBe(true);
    expect(productMatchesSearch(multiCategoryProduct, "shorts")).toBe(true);
  });

  it("supports legacy products that only have one category field", () => {
    const product = { category: "T-Shirts", categorySlug: "t-shirts" };
    expect(productMatchesCategory(product, "t-shirts")).toBe(true);
    expect(productMatchesSearch(product, "shirts")).toBe(true);
  });
});
