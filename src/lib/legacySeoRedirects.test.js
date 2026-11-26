import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
);
const redirects = config.redirects || [];

function redirectFor(source, predicate = () => true) {
  return redirects.find((redirect) => redirect.source === source && predicate(redirect));
}

describe("legacy SEO redirects", () => {
  it("routes retired content to the closest current section", () => {
    expect(redirectFor("/experience-in-the-spotlight")?.destination).toBe("/blog");
    expect(redirectFor("/listing/sticky-band")?.destination).toBe("/listings");
    expect(redirectFor("/shop/wicker-basket")?.destination).toBe("/shop");
    expect(redirectFor("/saved-searches")?.destination).toBe("/saved");
  });

  it("handles the legacy WordPress password reset before the generic login redirect", () => {
    const resetIndex = redirects.findIndex(
      (redirect) => redirect.source === "/wp-login.php" && redirect.has,
    );
    const loginIndex = redirects.findIndex(
      (redirect) => redirect.source === "/wp-login.php" && !redirect.has,
    );

    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(loginIndex).toBeGreaterThan(resetIndex);
    expect(redirects[resetIndex].destination).toBe("/auth/forgot-password");
    expect(
      redirectFor("/wp-login.php", (redirect) =>
        redirect.has?.some(
          (condition) => condition.key === "action" && condition.value === "register",
        ),
      )?.destination,
    ).toBe("/auth/register");
  });

  it("places removed-product redirects before the valid legacy product pattern", () => {
    const removedIndex = redirects.findIndex(
      (redirect) => redirect.source === "/product/white-pillow",
    );
    const genericIndex = redirects.findIndex(
      (redirect) => redirect.source === "/product/:slug",
    );

    expect(removedIndex).toBeGreaterThanOrEqual(0);
    expect(genericIndex).toBeGreaterThan(removedIndex);
  });

  it("moves legacy WordPress resources to the CMS origin", () => {
    expect(redirectFor("/wp-json/:path*")?.destination).toBe(
      "https://admin.connect767.com/wp-json/:path*",
    );
    expect(redirectFor("/wp-content/:path*")?.destination).toBe(
      "https://admin.connect767.com/wp-content/:path*",
    );
  });

  it("keeps old listing feeds from becoming missing profile pages", () => {
    expect(redirectFor("/listing/:slug/feed")?.destination).toBe("/listings");
    expect(redirectFor("/listing-category/:category/feed")?.destination).toBe(
      "/listings?category=:category",
    );
  });

  it("marks obsolete WooCommerce AJAX query URLs as noindex", () => {
    const headerRule = (config.headers || []).find(
      (rule) => rule.source === "/" && rule.has?.some((condition) => condition.key === "wc-ajax"),
    );
    expect(headerRule?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow",
    });
  });
});
