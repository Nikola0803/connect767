import { describe, expect, it } from "vitest";
import { mapProductionElementToGarment, normalizeStoredProductionLayer } from "./productionPlacement";

describe("AI production artwork placement", () => {
  it("maps front artwork from canvas percentages into the printable torso", () => {
    expect(mapProductionElementToGarment({ kind: "artwork", view: "front", x: 20, y: 30, size: 20 }))
      .toEqual({ view: "front", x: 41.6, y: 19.6, size: 8.4 });
  });

  it("keeps side artwork inside the narrower profile surface", () => {
    const placement = mapProductionElementToGarment({ kind: "artwork", view: "side", x: 80, y: 65, size: 40 });
    expect(placement.x).toBeCloseTo(54.2);
    expect(placement.y).toBeCloseTo(27.95);
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
    expect(migrated.placementSpace).toBe("garment-v2");
    expect(migrated.x).toBeCloseTo(45.8);
    expect(migrated.y).toBeCloseTo(19.6);
    expect(migrated.size).toBeCloseTo(31 / 12);
    expect(normalizeStoredProductionLayer(migrated)).toBe(migrated);

    const manual = { id: "manual", type: "text", x: 10, y: 10 };
    expect(normalizeStoredProductionLayer(manual)).toBe(manual);
  });

  it("moves version-one center-chest layers out of the lower-shirt area without resizing them", () => {
    const oldPlacement = {
      id: "saved-ai",
      source: "ai-uniform-element",
      placementSpace: "garment-v1",
      type: "text",
      view: "front",
      x: 50,
      y: 42,
      size: 2.5,
      text: "TEAM UNIFORM",
    };
    const migrated = normalizeStoredProductionLayer(oldPlacement, "soccer");
    expect(migrated.placementSpace).toBe("garment-v2");
    expect(migrated.y).toBeCloseTo(25.1224);
    expect(migrated.x).toBe(50);
    expect(migrated.size).toBe(2.5);
  });

  it("uses the taller basketball shirt panel while keeping wording on the chest", () => {
    const placement = mapProductionElementToGarment(
      { kind: "text", view: "front", x: 50, y: 40, size: 14, content: "TEAM UNIFORM" },
      "basketball",
    );
    expect(placement.y).toBe(27);
  });
});
