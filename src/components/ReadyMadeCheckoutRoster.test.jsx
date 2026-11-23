import { describe, expect, it } from "vitest";
import { readyMadeRosterStatus } from "./ReadyMadeCheckoutRoster";

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
});
