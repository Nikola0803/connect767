import { describe, it, expect } from "vitest";
import { BASE_KIT_PRICE, SHIRT_ONLY_PRICE, extraTeamShirtCount, normalizeExtraTeamShirts, kitUnitPrice, mixedSleeveSurcharge, minimumFullKitsFor, fullKitCount } from "./uniforms";

describe("full-kit minimums", () => {
  it.each([["soccer", 22], ["basketball", 10], ["cricket", 15], ["netball", 10]])("requires %s's confirmed minimum of %i kits", (sport, minimum) => {
    expect(minimumFullKitsFor(sport)).toBe(minimum);
    expect(fullKitCount([{ name: "Team", quantity: minimum - 1 }])).toBeLessThan(minimumFullKitsFor(sport));
    expect(fullKitCount([{ name: "Team", quantity: minimum }])).toBeGreaterThanOrEqual(minimumFullKitsFor(sport));
  });
  it("counts full-kit quantities, ignores blank rows and excludes extra shirts", () => {
    const order = { roster: [{ name: "Player", quantity: 12 }, { name: "Player 2", quantity: 9 }, { name: " ", quantity: 50 }], extraTeamShirts: [{ size: "AM", quantity: 20 }] };
    expect(fullKitCount(order.roster)).toBe(21);
    expect(fullKitCount(order.roster)).toBeLessThan(minimumFullKitsFor("soccer"));
    expect(fullKitCount([{ name: "Player", quantity: 500 }])).toBe(99);
    expect(minimumFullKitsFor("other")).toBe(1);
  });
});

describe("sleeve pricing", () => {
  it("prices full kits at $35 and adds extra shirts at $12 without replacing kits", () => {
    const rows = [{ size: "M", quantity: 2 }, { size: "L", quantity: 1 }, { size: "invalid", quantity: 10 }];
    expect(kitUnitPrice({ sleeve: "Short", collar: "Crew" })).toBe(35);
    expect(extraTeamShirtCount(rows)).toBe(3);
    expect(BASE_KIT_PRICE * 5 + extraTeamShirtCount(rows) * SHIRT_ONLY_PRICE).toBe(211);
    expect(normalizeExtraTeamShirts([{ size: "M", quantity: 2 }, { size: "M", quantity: 3 }])).toEqual([{ size: "M", quantity: 5 }]);
  });
  it("includes short sleeves and charges $2 for long sleeves and optional Polo", () => {
    expect(kitUnitPrice({ sleeve: "Short", collar: "Crew" })).toBe(BASE_KIT_PRICE);
    expect(kitUnitPrice({ sleeve: "Long", collar: "Crew" })).toBe(BASE_KIT_PRICE + 2);
    expect(kitUnitPrice({ sleeve: "Long", collar: "Polo" })).toBe(BASE_KIT_PRICE + 4);
  });
  it("prices mixed sleeves by long-sleeve quantities only", () => {
    const roster = [{ sleevePreference: "Long", quantity: 3 }, { sleevePreference: "Short", quantity: 4 }, { sleevePreference: "Short", quantity: 2 }];
    expect(kitUnitPrice({ sleeve: "Mixed", collar: "Crew" })).toBe(BASE_KIT_PRICE);
    expect(mixedSleeveSurcharge("Mixed", roster)).toBe(6);
    expect(mixedSleeveSurcharge("Short", roster)).toBe(0);
    expect(mixedSleeveSurcharge("Long", roster)).toBe(0);
  });
});
