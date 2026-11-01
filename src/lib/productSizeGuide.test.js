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

  it("recognizes an unlabelled wide chart on a product with a Size attribute", async () => {
    const chart = {
      src: "https://example.com/E52E19135EB29AC14D81F2A498DF8523.jpg",
      width: 992,
      height: 314,
    };
    await expect(
      detectLegacySizeChart(
        [{ src: "https://example.com/product.jpg", width: 1024, height: 1024 }, chart],
        "",
        [{ name: "Size", options: ["S", "M", "L"] }]
      )
    ).resolves.toBe(chart);
  });

  it("does not mistake a wide image for a chart when the product has no Size attribute", async () => {
    await expect(
      detectLegacySizeChart(
        [{ src: "https://example.com/banner.jpg", width: 1200, height: 300 }],
        "Product details",
        [{ name: "Color", options: ["Green"] }]
      )
    ).resolves.toBeNull();
  });
});
