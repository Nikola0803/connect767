import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_BACKGROUND,
  isDarkStudioBackground,
  normalizeStudioBackground,
  studioBackgroundGradient,
} from "./studioBackgrounds";

describe("studio backgrounds", () => {
  it("falls back safely when an old save has no valid background", () => {
    expect(normalizeStudioBackground()).toBe(DEFAULT_STUDIO_BACKGROUND);
    expect(normalizeStudioBackground("not-a-color")).toBe(DEFAULT_STUDIO_BACKGROUND);
  });

  it("builds a dimensional preview background from a custom hex color", () => {
    expect(studioBackgroundGradient("#252824")).toContain("#252824");
    expect(isDarkStudioBackground("#252824")).toBe(true);
    expect(isDarkStudioBackground("#FFFFFF")).toBe(false);
  });
});
