import { describe, expect, it } from "vitest";
import {
  minimumForReadyMadeCategory,
  normalizeReadyMadeCategory,
  readyMadeCartIssues,
} from "./readyMadeMinimums";

describe("ready-made design minimums", () => {
  it.each([
    ["soccer", 22],
    ["basketball", 10],
    ["netball", 10],
    ["cricket", 20],
    ["goal-keeper", 1],
    ["clothing & other", 10],
  ])("maps %s to a %i-unit minimum", (category, minimum) => {
    expect(minimumForReadyMadeCategory(category)).toBe(minimum);
  });

  it("aggregates ready-made products by design category", () => {
    const issues = readyMadeCartIssues([
      { readyMade: true, uniformCategory: "soccer", qty: 10 },
      { readyMade: true, uniformCategory: "soccer", qty: 12 },
      { readyMade: false, uniformCategory: "cricket", qty: 1 },
    ]);
    expect(issues).toEqual([]);
  });

  it("reports missing category quantities and goalkeeper dependencies", () => {
    const issues = readyMadeCartIssues([
      { readyMade: true, uniformCategory: "basketball", qty: 4 },
      { readyMade: true, uniformCategory: "goalkeeper", qty: 1 },
    ]);
    expect(issues.map((issue) => issue.category)).toEqual(["basketball", "goalkeeper"]);
    expect(issues[0].message).toContain("6 more basketball items");
    expect(issues[1].message).toContain("soccer order");
    expect(normalizeReadyMadeCategory("Clothing & Other")).toBe("other");
  });
});
