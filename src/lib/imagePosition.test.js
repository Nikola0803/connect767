import { describe, it, expect } from "vitest";
import { cssObjectPosition, clampZoom, imageCropStyle, ZOOM_MIN, ZOOM_MAX } from "./imagePosition";

describe("cssObjectPosition", () => {
  it("maps a known position value to its CSS object-position", () => {
    expect(cssObjectPosition("top-left")).toBe("left top");
    expect(cssObjectPosition("center")).toBe("center");
    expect(cssObjectPosition("bottom-right")).toBe("right bottom");
  });

  it("falls back to center for an unknown or missing value", () => {
    expect(cssObjectPosition("not-a-real-value")).toBe("center");
    expect(cssObjectPosition(undefined)).toBe("center");
  });
});

describe("clampZoom", () => {
  it("passes through values already in range", () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("clamps below ZOOM_MIN up to ZOOM_MIN", () => {
    expect(clampZoom(0.2)).toBe(ZOOM_MIN);
  });

  it("clamps above ZOOM_MAX down to ZOOM_MAX", () => {
    expect(clampZoom(10)).toBe(ZOOM_MAX);
  });

  it("falls back to 1 for non-numeric input", () => {
    expect(clampZoom("not-a-number")).toBe(1);
    expect(clampZoom(undefined)).toBe(1);
    expect(clampZoom(NaN)).toBe(1);
  });

  it("coerces numeric strings", () => {
    expect(clampZoom("1.8")).toBe(1.8);
  });
});

describe("imageCropStyle", () => {
  it("omits transform entirely at the default 1x zoom", () => {
    const style = imageCropStyle("center", 1);
    expect(style).not.toHaveProperty("transform");
    expect(style.objectPosition).toBe("center");
  });

  it("includes a scale transform once zoomed in", () => {
    const style = imageCropStyle("top", 1.5);
    expect(style.transform).toBe("scale(1.5)");
    expect(style.objectPosition).toBe("center top");
  });

  it("defaults zoom to 1x when not provided", () => {
    const style = imageCropStyle("left", undefined);
    expect(style).not.toHaveProperty("transform");
  });
});
