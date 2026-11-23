import { describe, expect, it } from "vitest";
import { readyMadeExtrasStatus, readyMadeRosterStatus } from "./ReadyMadeCheckoutRoster";

describe("ready-made checkout roster", () => {
  const items = [
    { key: "home-kit", title: "Home Kit", readyMade: true, qty: 10 },
    { key: "cap", title: "Cap", readyMade: false, qty: 2 },
  ];

  it("requires roster quantities to match each ready-made cart line", () => {
    expect(readyMadeRosterStatus(items, [{ productKey: "home-kit", quantity: 9 }])).toMatchObject({
      valid: false,
      requirements: [{ key: "home-kit", required: 10, assigned: 9, valid: false }],
    });
  });

  it("combines roster rows and ignores ordinary shop products", () => {
    expect(readyMadeRosterStatus(items, [
      { productKey: "home-kit", quantity: 6 },
      { productKey: "home-kit", quantity: 4 },
      { productKey: "cap", quantity: 2 },
    ])).toMatchObject({ valid: true, requirements: [{ required: 10, assigned: 10, valid: true }] });
  });

  it("includes one sock per soccer uniform and charges only additional pairs", () => {
    const status = readyMadeExtrasStatus(items.map((item) => item.key === "home-kit" ? { ...item, uniformCategory: "soccer" } : item), { socksQuantity: 13 });
    expect(status).toMatchObject({ requiredSocks: 10, socksQuantity: 13, extraSocks: 3, extraSocksTotal: 15, socksValid: true });
  });

  it("calculates supporter jerseys by size at fifteen dollars each", () => {
    const status = readyMadeExtrasStatus(items, { supporterEnabled: true, supporterJerseys: [{ size: "S", quantity: 4 }, { size: "XL", quantity: 2 }] });
    expect(status).toMatchObject({ supporterQuantity: 6, supporterTotal: 90 });
  });

  it("normalizes retired youth sizes to a supported adult size", () => {
    const status = readyMadeExtrasStatus(items, { supporterEnabled: true, supporterJerseys: [{ size: "Youth S", quantity: 2 }] });
    expect(status.supporterJerseys).toEqual([{ size: "M", quantity: 2 }]);
  });

  it("calculates production extras from authoritative kit and roster quantities", () => {
    const status = readyMadeExtrasStatus(items, {
      poloCollar: true,
      mixedSleeves: true,
      embroideredLogo: true,
      insideCollarEnabled: true,
      insideCollarMessage: "ONE TEAM",
    }, [
      { sleeve: "Long", quantity: 4 },
      { sleeve: "Short", quantity: 6 },
    ]);
    expect(status).toMatchObject({
      kitQuantity: 10,
      longSleeveQuantity: 4,
      poloCollarTotal: 20,
      longSleeveTotal: 8,
      embroideryTotal: 15,
      insideCollarTotal: 10,
      productionTotal: 53,
      insideCollarValid: true,
    });
  });

  it("requires message text or artwork when inside-collar customization is selected", () => {
    expect(readyMadeExtrasStatus(items, { insideCollarEnabled: true }).insideCollarValid).toBe(false);
    expect(readyMadeExtrasStatus(items, { insideCollarEnabled: true, insideCollarAttachment: { src: "data:image/png;base64,AA==" } }).insideCollarValid).toBe(true);
  });
});
