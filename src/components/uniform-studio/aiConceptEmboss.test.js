import { expect, it } from "vitest";
import { embossedLogoPlacement, templateBackgroundMask } from "./aiConceptEmboss";

it("normalizes all three backdrop colours while preserving an enclosed light garment detail", () => {
  const width = 15, height = 15, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const colour = x < 5 ? [255, 255, 255] : x < 10 ? [239, 236, 226] : [217, 220, 219];
    data.set([...colour, 255], (y * width + x) * 4);
  }
  for (let y = 4; y <= 10; y++) for (let x = 3; x <= 11; x++) data.set([0, 70, 40, 255], (y * width + x) * 4);
  data.set([239, 236, 226, 255], (7 * width + 7) * 4);
  const mask = templateBackgroundMask({ data, width, height });
  for (let x = 0; x < width; x++) expect(mask[2 * width + x]).toBe(1);
  expect(mask[7 * width + 7]).toBe(0);
  expect(mask[6 * width + 6]).toBe(0);
});

it("keeps the logo proportional, centred and inside wide and tall previews", () => {
  for (const [width, height] of [[1600, 700], [700, 1600], [768, 768]]) {
    const p = embossedLogoPlacement(width, height, 1024, 768);
    expect(p.width / p.height).toBeCloseTo(1024 / 768);
    expect(p.x * 2 + p.width).toBeCloseTo(width);
    expect(p.y * 2 + p.height).toBeCloseTo(height);
    expect(p.width).toBeLessThanOrEqual(width * 0.68);
    expect(p.height).toBeLessThanOrEqual(height * 0.68);
  }
});
