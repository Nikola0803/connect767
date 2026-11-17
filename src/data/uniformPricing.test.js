import { describe, it, expect } from "vitest";
import { BASE_KIT_PRICE, SHIRT_ONLY_PRICE, extraTeamShirtCount, normalizeExtraTeamShirts, kitUnitPrice, mixedSleeveSurcharge } from "./uniforms";

describe("sleeve pricing", () => {
  it("prices full kits at $30 and adds extra shirts at $12 without replacing kits", () => {
    const rows = [{ size: "AM", quantity: 2 }, { size: "AL", quantity: 1 }, { size: "invalid", quantity: 10 }];
    expect(kitUnitPrice({ sleeve: "Short", collar: "Crew" })).toBe(30);
    expect(extraTeamShirtCount(rows)).toBe(3);
    expect(BASE_KIT_PRICE * 5 + extraTeamShirtCount(rows) * SHIRT_ONLY_PRICE).toBe(186);
    expect(normalizeExtraTeamShirts([{ size: "AM", quantity: 2 }, { size: "AM", quantity: 3 }])).toEqual([{ size: "AM", quantity: 5 }]);
  });
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
