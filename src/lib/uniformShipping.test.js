import { describe, expect, it } from "vitest";
import { uniformAiDesignerFee, uniformShippingRate } from "./uniformShipping";

describe("Custom Uniform Studio shipping zones", () => {
  it.each(["US", "CA", "MX"])("charges North America rates for %s", (country) => {
    expect(uniformShippingRate(country, 49)).toMatchObject({ zone: "north-america", amount: 300 });
    expect(uniformShippingRate(country, 50)).toMatchObject({ zone: "north-america", amount: 450 });
  });

  it.each(["DM", "JM", "TT", "PR", "VG"])("charges Caribbean rates for %s", (country) => {
    expect(uniformShippingRate(country, 10)).toMatchObject({ zone: "caribbean", amount: 450 });
    expect(uniformShippingRate(country, 21)).toMatchObject({ zone: "caribbean", amount: 450 });
    expect(uniformShippingRate(country, 22)).toMatchObject({ zone: "caribbean", amount: 600 });
    expect(uniformShippingRate(country, 50)).toMatchObject({ zone: "caribbean", amount: 600 });
    expect(uniformShippingRate(country, 51)).toMatchObject({ zone: "caribbean", amount: 800 });
  });

  it("does not quote unsupported destinations", () => {
    expect(uniformShippingRate("GB", 22)).toBeNull();
  });

  it("adds the fixed Connect767 Design Fee only below $1,500 after shipping", () => {
    expect(uniformAiDesignerFee(1177, 300)).toBe(50);
    expect(uniformAiDesignerFee(899, 600)).toBe(50);
    expect(uniformAiDesignerFee(1200, 300)).toBe(0);
    expect(uniformAiDesignerFee(1177, 600)).toBe(0);
  });
});

