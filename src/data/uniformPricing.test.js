import { describe, it, expect } from "vitest";
import { BASE_KIT_PRICE, SHIRT_ONLY_PRICE, extraTeamShirtCount, normalizeExtraTeamShirts, kitAddOnBreakdown, kitUnitPrice, mixedSleeveSurcharge, minimumFullKitsFor, fullKitCount, uniformPricingFor } from "./uniforms";

describe("full-kit minimums", () => {
  it.each([["soccer", 22], ["basketball", 10], ["cricket", 20], ["netball", 10], ["other", 10]])("requires %s's confirmed minimum of %i kits", (sport, minimum) => {
    expect(minimumFullKitsFor(sport)).toBe(minimum);
    expect(fullKitCount([{ name: "Team", quantity: minimum - 1 }])).toBeLessThan(minimumFullKitsFor(sport));
    expect(fullKitCount([{ name: "Team", quantity: minimum }])).toBeGreaterThanOrEqual(minimumFullKitsFor(sport));
  });
  it("counts full-kit quantities, ignores blank rows and excludes extra shirts", () => {
    const order = { roster: [{ name: "Player", quantity: 12 }, { name: "Player 2", quantity: 9 }, { name: " ", quantity: 50 }], extraTeamShirts: [{ size: "AM", quantity: 20 }] };
    expect(fullKitCount(order.roster)).toBe(21);
    expect(fullKitCount(order.roster)).toBeLessThan(minimumFullKitsFor("soccer"));
    expect(fullKitCount([{ name: "Player", quantity: 500 }])).toBe(99);
    expect(minimumFullKitsFor("other")).toBe(10);
  });
});

describe("category and sleeve pricing", () => {
  it.each([
    ["soccer", 35, 15, "Full Kit", "Shirt Only"],
    ["basketball", 30, 15, "Full Kit", "Shirt Only"],
    ["netball", 30, 15, "Full Kit", "Shirt Only"],
    ["cricket", 40, 15, "Full Kit", "Shirt Only"],
    ["goalkeeper", 45, 15, "Full Kit", "Shirt Only"],
    ["other", 30, 15, "Top & Pants", "Top Only"],
  ])("uses %s category prices", (sport, fullPrice, shirtPrice, fullLabel, shirtLabel) => {
    expect(uniformPricingFor(sport)).toMatchObject({ fullPrice, shirtPrice, fullLabel, shirtLabel });
    expect(kitUnitPrice({ sport, sleeve: "Short", collar: "Crew" })).toBe(fullPrice);
  });

  it("prices soccer full kits at $35 and adds extra tops at $15 without replacing kits", () => {
    const rows = [{ size: "M", quantity: 2 }, { size: "L", quantity: 1 }, { size: "invalid", quantity: 10 }];
    expect(kitUnitPrice({ sleeve: "Short", collar: "Crew" })).toBe(35);
    expect(extraTeamShirtCount(rows)).toBe(3);
    expect(BASE_KIT_PRICE * 5 + extraTeamShirtCount(rows) * SHIRT_ONLY_PRICE).toBe(220);
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
  it("itemizes every selected production add-on separately from the $35 base kit", () => {
    expect(kitAddOnBreakdown({
      sleeve: "Long",
      collar: "Polo",
      insideCollarMessage: true,
      logoApplication: "Embroidery",
      unitCount: 22,
    })).toEqual([
      { key: "long-sleeves", label: "Long sleeves", count: 22, unitPrice: 2, total: 44 },
      { key: "polo-collars", label: "Polo-style collars", count: 22, unitPrice: 2, total: 44 },
      { key: "inside-collar", label: "Inside-collar logo/message", count: 22, unitPrice: 1, total: 22 },
      { key: "embroidery", label: "Embroidered team logo", count: 22, unitPrice: 1.5, total: 33 },
    ]);
  });
});
