import { describe, expect, it } from "vitest";
import { canonicalDirectoryCategories, canonicalHomeCategories } from "./directory";
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

describe("canonicalHomeCategories", () => {
  it("shows only the functional Eat & Drink tile and preserves its live count", () => {
    const categories = canonicalHomeCategories([
      { slug: "services", label: "Services", count: 16, icon: "ri-briefcase-fill" },
      { slug: "eat-drink", label: "Eat & Drink", count: 9, icon: "ri-price-tag-3-line" },
      { slug: "eat-and-drink", label: "Eat & Drink", count: 1, icon: "ri-restaurant-fill" },
    ]);

    expect(categories.filter((category) => category.name === "Eat & Drink")).toEqual([
      {
        name: "Eat & Drink",
        count: "1 listing",
        icon: "ri-restaurant-fill",
        href: "?category=eat-and-drink",
      },
    ]);
    expect(categories).toHaveLength(7);
    expect(categories.some((category) => category.href === "?category=eat-drink")).toBe(false);
  });
});
