import { describe, expect, it } from "vitest";
import { uniformShippingRate } from "./uniformShipping";

describe("Custom Uniform Studio shipping zones", () => {
  it.each(["US", "CA", "MX"])("charges North America rates for %s", (country) => {
    expect(uniformShippingRate(country, 49)).toMatchObject({ zone: "north-america", amount: 300 });
    expect(uniformShippingRate(country, 50)).toMatchObject({ zone: "north-america", amount: 450 });
  });

  it.each(["DM", "JM", "TT", "PR", "VG"])("charges Caribbean rates for %s", (country) => {
    expect(uniformShippingRate(country, 49)).toMatchObject({ zone: "caribbean", amount: 600 });
    expect(uniformShippingRate(country, 50)).toMatchObject({ zone: "caribbean", amount: 800 });
  });

  it("does not quote unsupported destinations", () => {
    expect(uniformShippingRate("GB", 22)).toBeNull();
  });
});

