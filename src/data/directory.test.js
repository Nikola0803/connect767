import { describe, expect, it } from "vitest";
import { canonicalDirectoryCategories } from "./directory";
import { findCategory } from "./industries";

describe("canonicalDirectoryCategories", () => {
  it("keeps the functional Eat & Drink term and removes its legacy duplicate", () => {
    const categories = canonicalDirectoryCategories([
      { slug: "eat-drink", label: "Eat & Drink" },
      { slug: "eat-and-drink", label: "Eat & Drink", icon: "ri-restaurant-fill" },
    ]);

    expect(categories.filter((category) => category.label === "Eat & Drink")).toEqual([
      {
        slug: "eat-and-drink",
        label: "Eat & Drink",
        icon: "ri-restaurant-fill",
      },
    ]);
    expect(categories.some((category) => category.slug === "eat-drink")).toBe(false);
    expect(findCategory("eat-and-drink")?.industries).toHaveLength(8);
  });

  it("returns every canonical top-level category exactly once", () => {
    const categories = canonicalDirectoryCategories([]);

    expect(categories.map((category) => category.slug)).toEqual([
      "all",
      "services",
      "products",
      "rentals",
      "eat-and-drink",
      "events",
      "fitness",
      "other",
    ]);
  });
});
