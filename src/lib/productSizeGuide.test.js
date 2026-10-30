import { describe, expect, it } from "vitest";
import { detectLegacySizeChart, explicitSizeChart } from "./productSizeGuide";

describe("product size guide detection", () => {
  it("uses size charts explicitly identified by WordPress", () => {
    const chart = { src: "chart.jpg", isSizeChart: true };
    expect(explicitSizeChart([{ src: "product.jpg" }, chart])).toBe(chart);
  });

  it("recognizes descriptive size-chart filenames", () => {
    expect(explicitSizeChart([{ src: "https://example.com/jogger-size-chart.jpg" }])?.src).toContain(
      "size-chart"
    );
  });

  it("does not guess from image shape when the product never references a size guide", async () => {
    await expect(
      detectLegacySizeChart([{ src: "https://example.com/wide-product.jpg" }], "Product details")
    ).resolves.toBeNull();
  });
});
