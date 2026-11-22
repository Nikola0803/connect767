import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { templates } from "../../data/uniforms";
import { uniformSampleFor } from "./uniformSamples";

describe("three-view template image catalog", () => {
  it.each(templates)("has real optimized front/side/back assets for $slug", (template) => {
    const sample = uniformSampleFor(template.sportSlug);
    expect(sample.alt).toContain("front, side and back");
    for (const [source, budget] of [[sample.src, 130000], [sample.preview, 40000], [sample.thumbnail, 10000]]) {
      const asset = new URL("../../../public" + source, import.meta.url);
      expect(statSync(asset).size).toBeLessThan(budget);
      expect(statSync(asset).size).toBeGreaterThan(1000);
    }
    expect(sample.src).toContain(template.sportSlug + "-views.webp");
  });
});
