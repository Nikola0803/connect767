import { describe, it, expect } from "vitest";
import {
  cssObjectPosition,
  clampZoom,
  imageCropStyle,
  normalizeImageFit,
  resolveSmartImageFit,
  coverDragTravel,
  ZOOM_MIN,
  ZOOM_MAX,
} from "./imagePosition";

describe("coverDragTravel", () => {
  it("preserves the larger vertical travel of a square image in a wide cover", () => {
    const travel = coverDragTravel(400, 225, 1, 1.1);
    expect(travel.x).toBeCloseTo(40);
    expect(travel.y).toBeCloseTo(215);
  });

  it("preserves the larger horizontal travel of an extra-wide image", () => {
    const travel = coverDragTravel(400, 225, 3, 1);
    expect(travel.x).toBeCloseTo(275);
    expect(travel.y).toBe(1);
  });
});

describe("normalizeImageFit", () => {
  it("accepts the three supported fit modes", () => {
    expect(normalizeImageFit("smart")).toBe("smart");
    expect(normalizeImageFit("contain")).toBe("contain");
    expect(normalizeImageFit("cover")).toBe("cover");
  });

  it("uses the requested fallback for an invalid value", () => {
    expect(normalizeImageFit("stretch")).toBe("cover");
    expect(normalizeImageFit(undefined, "contain")).toBe("contain");
  });
});

describe("resolveSmartImageFit", () => {
  it("fills ordinary square and landscape photography", () => {
    expect(resolveSmartImageFit("smart", 1)).toBe("cover");
    expect(resolveSmartImageFit("smart", 16 / 9)).toBe("cover");
  });

  it("keeps tall flyers and extra-wide banners complete", () => {
    expect(resolveSmartImageFit("smart", 0.7)).toBe("contain");
    expect(resolveSmartImageFit("smart", 2.4)).toBe("contain");
  });

  it("never overrides an explicit owner choice", () => {
    expect(resolveSmartImageFit("cover", 0.5)).toBe("cover");
    expect(resolveSmartImageFit("contain", 1.3)).toBe("contain");
  });
});

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
    expect(style.transformOrigin).toBe("center top");
  });

  it("uses a free-form saved position as the zoom transform origin", () => {
    const style = imageCropStyle("28% 64%", 1.4);
    expect(style.transformOrigin).toBe("28% 64%");
  });

  it("defaults zoom to 1x when not provided", () => {
    const style = imageCropStyle("left", undefined);
    expect(style).not.toHaveProperty("transform");
  });

  it("centers a contained image and never applies a crop zoom", () => {
    expect(imageCropStyle("top-left", 2.5, "contain")).toEqual({ objectPosition: "center" });
  });
});
