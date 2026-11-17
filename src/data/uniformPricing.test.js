import { describe, it, expect } from "vitest";
import { BASE_KIT_PRICE, kitUnitPrice, mixedSleeveSurcharge } from "./uniforms";

describe("sleeve pricing", () => {
  it("includes short sleeves and charges $2 for long sleeves and optional Polo", () => {
    expect(kitUnitPrice({ sleeve: "Short", collar: "Crew" })).toBe(BASE_KIT_PRICE);
    expect(kitUnitPrice({ sleeve: "Long", collar: "Crew" })).toBe(BASE_KIT_PRICE + 2);
    expect(kitUnitPrice({ sleeve: "Long", collar: "Polo" })).toBe(BASE_KIT_PRICE + 4);
  });
  it("prices mixed sleeves by long-sleeve quantities only", () => {
    const roster = [{ sleevePreference: "Long", quantity: 3 }, { sleevePreference: "Short", quantity: 4 }, { sleevePreference: "Team selection", quantity: 2 }];
    expect(kitUnitPrice({ sleeve: "Mixed", collar: "Crew" })).toBe(BASE_KIT_PRICE);
    expect(mixedSleeveSurcharge("Mixed", roster)).toBe(6);
    expect(mixedSleeveSurcharge("Short", roster)).toBe(0);
    expect(mixedSleeveSurcharge("Long", roster)).toBe(0);
  });
});
