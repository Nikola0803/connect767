import { describe, expect, it } from "vitest";
import { currentYearsExperience } from "./experience";

describe("currentYearsExperience", () => {
  it("adds one year for every calendar year since the baseline", () => {
    expect(currentYearsExperience("10", "2024", 2026)).toBe("12");
  });

  it("preserves legacy values that do not yet have a baseline year", () => {
    expect(currentYearsExperience("10", "", 2026)).toBe("10");
  });

  it("keeps zero distinct from an unanswered field", () => {
    expect(currentYearsExperience(0, 2026, 2026)).toBe("0");
    expect(currentYearsExperience("", 2026, 2026)).toBe("");
  });
});
