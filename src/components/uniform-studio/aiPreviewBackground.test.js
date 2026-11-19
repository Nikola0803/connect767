import { describe, expect, it } from "vitest";
import { AI_PREVIEW_BACKGROUND_FALLBACK, edgeColorFromImageData } from "./aiPreviewBackground";

function solidImageData(width, height, color) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3] ?? 255;
  }
  return { data, width, height };
}

describe("AI preview edge background matching", () => {
  it("returns the exact opaque edge color used by an AI image", () => {
    expect(edgeColorFromImageData(solidImageData(8, 8, [252, 250, 247, 255])))
      .toBe("rgb(252, 250, 247)");
  });

  it("ignores a different center color and matches the four outer corners", () => {
    const image = solidImageData(8, 8, [248, 246, 242, 255]);
    const centerOffset = (4 * image.width + 4) * 4;
    image.data.set([25, 25, 25, 255], centerOffset);
    expect(edgeColorFromImageData(image)).toBe("rgb(248, 246, 242)");
  });

  it("uses the warm-white fallback when edge pixels are transparent", () => {
    expect(edgeColorFromImageData(solidImageData(8, 8, [0, 0, 0, 0])))
      .toBe(AI_PREVIEW_BACKGROUND_FALLBACK);
  });
});
