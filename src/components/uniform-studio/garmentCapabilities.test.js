import { describe, expect, it } from "vitest";
import { detectGarmentCapabilities, firstSupportedTool } from "./garmentCapabilities";
import { cloneZoneModel } from "./uniformZoneModel";

const tracedZones = {
  front: [{ id: "front-body", path: "M0 0 L1 1" }],
  back: [{ id: "back-body", path: "M0 0 L1 1" }],
};

describe("garment capability detection", () => {
  it("recognizes the studio's actual verified command-based garment masks", () => {
    const model = cloneZoneModel();
    expect(detectGarmentCapabilities({ sport: "soccer", zoneModel: model }).canUse("zones")).toBe(true);
    model.front[0].commands[0].x = NaN;
    expect(detectGarmentCapabilities({ sport: "soccer", zoneModel: model }).canUse("zones")).toBe(false);
    expect(detectGarmentCapabilities({ sport: "soccer", zoneModel: cloneZoneModel(), canvasMode: "concept", hasConceptImage: true }).canUse("zones")).toBe(false);
  });
  it("keeps a concept image preview-only", () => {
    const result = detectGarmentCapabilities({
      sport: "soccer",
      canvasMode: "concept",
      hasConceptImage: true,
      zoneModel: tracedZones,
      layerCount: 2,
    });

    expect(result.previewOnly).toBe(true);
    expect(result.canUse("ai")).toBe(true);
    expect(result.canUse("text")).toBe(false);
    expect(result.canUse("logo")).toBe(false);
    expect(result.canUse("remove-bg")).toBe(false);
    expect(result.canUse("layers")).toBe(false);
  });

  it("enables only tools backed by verified production zones", () => {
    const result = detectGarmentCapabilities({
      sport: "soccer",
      canvasMode: "production",
      zoneModel: tracedZones,
      layerCount: 1,
    });

    expect(result.canUse("design")).toBe(true);
    expect(result.canUse("zones")).toBe(true);
    expect(result.canUse("text")).toBe(true);
    expect(result.canUse("logo")).toBe(true);
    expect(result.canUse("remove-bg")).toBe(true);
    expect(result.canUse("layers")).toBe(true);
    expect(firstSupportedTool(["zones", "design"], result)).toBe("zones");
  });

  it("keeps the production Layers panel available before artwork is added", () => {
    const result = detectGarmentCapabilities({
      sport: "soccer",
      canvasMode: "production",
      zoneModel: tracedZones,
      layerCount: 0,
    });

    expect(result.canUse("layers")).toBe(true);
  });

  it.each(["sleeve-left", "sleeve-right"])("exposes placement tools for the verified %s zone", (view) => {
    const result = detectGarmentCapabilities({
      sport: "soccer",
      view,
      canvasMode: "production",
      zoneModel: tracedZones,
    });

    expect(result.zones.map((item) => item.id)).toEqual(["sleeves"]);
    expect(result.canUse("text")).toBe(true);
    expect(result.canUse("logo")).toBe(true);
    expect(result.status).toMatch(/sleeve placement verified/i);
  });

  it("does not advertise manual zone correction for an untraced category", () => {
    const result = detectGarmentCapabilities({ sport: "basketball", zoneModel: tracedZones });
    expect(result.garment).toBe("Basketball kit");
    expect(result.canUse("zones")).toBe(false);
    expect(result.canUse("text")).toBe(true);
  });
});

