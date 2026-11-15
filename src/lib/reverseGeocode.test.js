import { afterEach, describe, expect, it, vi } from "vitest";
import { isLegacyCoordinateLabel, placeNameFromAddress, reverseGeocodeLocation } from "./reverseGeocode";

describe("reverse geocoding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds a concise city, region and country label", () => {
    expect(placeNameFromAddress({ city: "Houston", county: "Harris County", state: "Texas", country: "United States" }))
      .toBe("Houston, Texas, United States");
  });

  it("recognizes legacy coordinate labels", () => {
    expect(isLegacyCoordinateLabel("Live location · 29.8676, -95.2011")).toBe(true);
    expect(isLegacyCoordinateLabel("Houston, Texas, United States")).toBe(false);
  });

  it("returns a readable place name without exposing coordinates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ address: { city: "Roseau", country: "Dominica" } }),
    }));

    await expect(reverseGeocodeLocation(15.301, -61.388)).resolves.toBe("Roseau, Dominica");
  });
});
