import { describe, expect, it } from "vitest";
import { mapProductionElementToGarment, normalizeStoredProductionLayer } from "./productionPlacement";

describe("AI production artwork placement", () => {
  it("maps front artwork from canvas percentages into the printable torso", () => {
    expect(mapProductionElementToGarment({ kind: "artwork", view: "front", x: 20, y: 30, size: 20 }))
      .toEqual({ view: "front", x: 41.6, y: 29.7, size: 8.4 });
  });

  it("keeps side artwork inside the narrower profile surface", () => {
    const placement = mapProductionElementToGarment({ kind: "artwork", view: "side", x: 80, y: 65, size: 40 });
    expect(placement.x).toBeCloseTo(54.2);
    expect(placement.y).toBeCloseTo(48.15);
    expect(placement.size).toBeCloseTo(11.2);
  });

  it("shrinks long team wording without shrinking player numbers", () => {
    const wording = mapProductionElementToGarment({ kind: "text", content: "TEAM UNIFORM", size: 18 });
    const number = mapProductionElementToGarment({ kind: "text", content: "24", size: 18 });
    expect(wording.size).toBeCloseTo(31 / 12);
    expect(number.size).toBe(18);
  });

  it("migrates previously saved AI layers but leaves corrected and manual layers unchanged", () => {
    const legacy = { id: "old", source: "ai-uniform-element", type: "text", view: "front", x: 35, y: 30, size: 18, text: "TEAM UNIFORM" };
    const migrated = normalizeStoredProductionLayer(legacy);
    expect(migrated.placementSpace).toBe("garment-v1");
    expect(migrated.x).toBeCloseTo(45.8);
    expect(migrated.size).toBeCloseTo(31 / 12);
    expect(normalizeStoredProductionLayer(migrated)).toBe(migrated);

    const manual = { id: "manual", type: "text", x: 10, y: 10 };
    expect(normalizeStoredProductionLayer(manual)).toBe(manual);
  });
});
