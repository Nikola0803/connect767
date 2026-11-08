import { describe, expect, it } from "vitest";
import { inferProductType, inventoryRowsToVariants, variantsToInventoryRows } from "./productInventory";

describe("product inventory", () => {
  it("infers older variable products from their saved options", () => {
    expect(inferProductType({ variants: [{ label: "Small / Green" }] })).toBe("variable");
    expect(inferProductType({ variants: [] })).toBe("simple");
  });

  it("converts legacy labels into structured size and color fields", () => {
    expect(variantsToInventoryRows([{ id: "s-green", label: "Small / Green", priceCents: 2500, stockQuantity: 8 }])[0]).toMatchObject({
      size: "Small",
      color: "Green",
      priceDollars: "25.00",
      stockQuantity: 8,
    });
  });

  it("serializes per-variation pricing and inventory", () => {
    expect(inventoryRowsToVariants([{ id: "s-green", size: "Small", color: "Green", sku: "TEE-S-GRN", priceDollars: "25", stockQuantity: "8", lowStockThreshold: "2" }])[0]).toEqual({
      id: "s-green",
      label: "Small / Green",
      size: "Small",
      color: "Green",
      sku: "TEE-S-GRN",
      priceCents: 2500,
      stockQuantity: 8,
      lowStockThreshold: 2,
    });
  });
});
