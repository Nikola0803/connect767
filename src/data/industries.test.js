import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allIndustries, categoryTaxonomy, findCategory } from "./industries";

const allowedCategories = [
  "eat-and-drink",
  "events",
  "fitness",
  "other",
  "products",
  "rentals",
  "services",
];

describe("listing form industry taxonomy", () => {
  it("contains only the seven supported parent categories", () => {
    expect(categoryTaxonomy.map((category) => category.slug).sort()).toEqual(allowedCategories);
  });

  it("connects every industry to exactly one valid parent category", () => {
    const nestedCount = categoryTaxonomy.reduce(
      (total, category) => total + category.industries.length,
      0,
    );
    const industrySlugs = allIndustries.map((industry) => industry.slug);
    const categorySlugs = categoryTaxonomy.map((category) => category.slug);

    expect(allIndustries).toHaveLength(nestedCount);
    expect(new Set(industrySlugs).size).toBe(industrySlugs.length);
    expect(industrySlugs.filter((slug) => categorySlugs.includes(slug))).toEqual([]);
    allIndustries.forEach((industry) => {
      expect(findCategory(industry.categorySlug)?.slug).toBe(industry.categorySlug);
      expect(industry.categoryLabel).toBe(findCategory(industry.categorySlug)?.label);
    });
  });

  it("keeps the WordPress taxonomy synchronized with the listing form", () => {
    const cmsTaxonomy = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "connect767-cms/data/category-taxonomy.json"),
        "utf8",
      ),
    );

    expect(cmsTaxonomy).toEqual(categoryTaxonomy);
  });
});
