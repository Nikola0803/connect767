import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  mapWcProduct,
  mapWcCategory,
  mapListingCpt,
  mapListingDetail,
  mapWpPost,
  mapProductTypeCpt,
} from "./mappers";

describe("decodeEntities", () => {
  it("decodes HTML entities the way WP REST responses encode them", () => {
    expect(decodeEntities("Accounting &amp; Bookkeeping")).toBe("Accounting & Bookkeeping");
    expect(decodeEntities("Caf&#233;")).toBe("Café");
  });

  it("is safe against a script-tag payload — never creates real elements", () => {
    // Uses a <textarea> internally specifically so this can't execute;
    // asserting the entity comes back as inert text is the point of the test.
    const result = decodeEntities("&lt;img src=x onerror=alert(1)&gt;");
    expect(result).toBe("<img src=x onerror=alert(1)>");
  });

  it("passes through a plain string with nothing to decode", () => {
    expect(decodeEntities("Plain text")).toBe("Plain text");
  });

  it("handles empty/undefined input without throwing", () => {
    expect(decodeEntities()).toBe("");
    expect(decodeEntities("")).toBe("");
  });
});

describe("mapWcProduct", () => {
  it("maps a simple WooCommerce product", () => {
    const wc = {
      id: 12,
      slug: "classic-tee",
      name: "Classic Tee",
      categories: [{ name: "Apparel", slug: "apparel" }],
      price: "24.99",
      regular_price: "29.99",
      on_sale: true,
      average_rating: "4.5",
      rating_count: 12,
      tags: [{ name: "Cotton" }],
      images: [{ src: "https://example.com/tee.jpg" }],
      stock_status: "instock",
      type: "simple",
    };
    const mapped = mapWcProduct(wc);
    expect(mapped).toMatchObject({
      id: 12,
      slug: "classic-tee",
      title: "Classic Tee",
      category: "Apparel",
      price: 24.99,
      originalPrice: 29.99,
      image: "https://example.com/tee.jpg",
      inStock: true,
      type: "simple",
    });
  });

  it("only reports an originalPrice when actually on sale", () => {
    const wc = { id: 1, name: "Item", price: "10", regular_price: "10", on_sale: false };
    expect(mapWcProduct(wc).originalPrice).toBeNull();
  });

  it("normalizes variation attribute keys for global (pa_) and custom attributes alike", () => {
    const wc = {
      id: 5,
      name: "Hoodie",
      type: "variable",
      variations: [
        {
          id: 501,
          attributes: { attribute_pa_size: "Large", attribute_color: "Blue" },
          price: "45",
        },
      ],
    };
    const mapped = mapWcProduct(wc);
    expect(mapped.variations[0].attributes).toEqual({ size: "large", color: "blue" });
  });

  it("defaults stock/purchasable to true when WooCommerce omits the field", () => {
    const mapped = mapWcProduct({ id: 1, name: "Item", price: "5" });
    expect(mapped.inStock).toBe(true);
    expect(mapped.purchasable).toBe(true);
  });
});

describe("mapWcCategory", () => {
  it("maps name/slug and falls back to a default icon", () => {
    expect(mapWcCategory({ slug: "shoes", name: "Shoes" })).toEqual({
      slug: "shoes",
      label: "Shoes",
      icon: "ri-price-tag-3-line",
    });
  });

  it("uses the ACF icon when present", () => {
    expect(mapWcCategory({ slug: "shoes", name: "Shoes", acf: { icon: "ri-footprint-line" } }).icon).toBe(
      "ri-footprint-line"
    );
  });
});

describe("mapListingCpt", () => {
  it("picks a badge icon based on tier", () => {
    const classified = mapListingCpt({ id: 1, slug: "a", title: "A", acf: { tier: "Classified" } });
    expect(classified.badgeIcon).toBe("ri-vip-crown-line");

    const featured = mapListingCpt({ id: 2, slug: "b", title: "B", acf: { tier: "Featured" } });
    expect(featured.badgeIcon).toBe("ri-star-line");

    const free = mapListingCpt({ id: 3, slug: "c", title: "C", acf: {} });
    expect(free.badgeIcon).toBe("ri-price-tag-3-line");
    expect(free.badge).toBe("Free");
  });

  it("strips HTML from a rendered title", () => {
    const mapped = mapListingCpt({ id: 1, slug: "a", title: { rendered: "<strong>Acme</strong> Co" }, acf: {} });
    expect(mapped.title).toBe("Acme Co");
  });
});

describe("mapListingDetail", () => {
  it("only builds a contact object when at least one contact field is present", () => {
    const withoutContact = mapListingDetail({ id: 1, slug: "a", title: "A", acf: {} });
    expect(withoutContact.contact).toBeNull();

    const withContact = mapListingDetail({ id: 2, slug: "b", title: "B", acf: { phone: "555-1234" } });
    expect(withContact.contact).not.toBeNull();
    expect(withContact.contact.phone).toBe("555-1234");
  });

  it("adds https:// to a bare-domain website but leaves a full URL alone", () => {
    const bareDomain = mapListingDetail({ id: 1, slug: "a", title: "A", acf: { website: "example.com" } });
    expect(bareDomain.contact.websiteUrl).toBe("https://example.com");

    const fullUrl = mapListingDetail({ id: 2, slug: "b", title: "B", acf: { website: "https://example.com" } });
    expect(fullUrl.contact.websiteUrl).toBe("https://example.com");
  });
});

describe("mapWpPost", () => {
  it("falls back to a synthesized body paragraph when acf.body is empty", () => {
    // Regression coverage for the `acf.body?.length` fix documented in
    // mappers.js — a naive `acf.body || fallback` never falls back for an
    // empty array since [] is truthy.
    const mapped = mapWpPost(
      { id: 1, slug: "post", title: { rendered: "Title" }, content: { rendered: "<p>Hello</p>" }, acf: { body: [] }, date: "2024-01-01" },
      { detail: true }
    );
    expect(mapped.body).toEqual([{ type: "p", text: "Hello" }]);
  });

  it("uses the real structured body when present", () => {
    const mapped = mapWpPost(
      { id: 1, slug: "post", title: { rendered: "Title" }, acf: { body: [{ type: "h2", text: "Section" }] }, date: "2024-01-01" },
      { detail: true }
    );
    expect(mapped.body).toEqual([{ type: "h2", text: "Section" }]);
  });
});

describe("mapProductTypeCpt", () => {
  it("falls back to a single default 'front' zone when no zones are configured", () => {
    const mapped = mapProductTypeCpt({ id: 1, slug: "tshirt", title: "T-Shirt", acf: {} });
    expect(mapped.placements).toEqual([
      { key: "front", label: "Front", allowText: true, allowLogo: true, allowRecolor: true },
    ]);
  });

  it("maps configured zones, respecting explicit false flags", () => {
    const mapped = mapProductTypeCpt({
      id: 1,
      slug: "tshirt",
      title: "T-Shirt",
      acf: { zones: [{ key: "back", label: "Back", allow_recolor: false }] },
    });
    expect(mapped.placements).toEqual([
      { key: "back", label: "Back", allowText: true, allowLogo: true, allowRecolor: false },
    ]);
  });
});
