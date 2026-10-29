import { describe, expect, it } from "vitest";
import { sortShopProducts } from "./productSorting";

const products = [
  { id: 1, title: "First regular", featured: false, price: 20, rating: "4.0", dateCreated: "2026-01-01" },
  { id: 2, title: "First featured", featured: true, price: 30, rating: "3.0", dateCreated: "2026-03-01" },
  { id: 3, title: "Second regular", featured: false, price: 10, rating: "5.0", dateCreated: "2026-04-01" },
  { id: 4, title: "Second featured", featured: true, price: 40, rating: "2.0", dateCreated: "2026-02-01" },
];

describe("sortShopProducts", () => {
  it("places featured products first while preserving WordPress order within each group", () => {
    expect(sortShopProducts(products, "featured").map((product) => product.id)).toEqual([2, 4, 1, 3]);
  });

  it("supports the remaining shop sort controls", () => {
    expect(sortShopProducts(products, "newest").map((product) => product.id)).toEqual([3, 2, 4, 1]);
    expect(sortShopProducts(products, "price-low").map((product) => product.id)).toEqual([3, 1, 2, 4]);
    expect(sortShopProducts(products, "price-high").map((product) => product.id)).toEqual([4, 2, 1, 3]);
    expect(sortShopProducts(products, "rating").map((product) => product.id)).toEqual([3, 1, 2, 4]);
  });
});
