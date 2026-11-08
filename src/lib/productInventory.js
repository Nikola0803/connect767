export function createInventoryVariant(overrides = {}) {
  return {
    id: overrides.id || `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    size: overrides.size || "",
    color: overrides.color || "",
    sku: overrides.sku || "",
    priceDollars: overrides.priceDollars ?? "",
    stockQuantity: overrides.stockQuantity ?? "",
    lowStockThreshold: overrides.lowStockThreshold ?? "3",
  };
}
export function inferProductType(product = {}) {
  if (product.productType === "variable" || product.productType === "simple") return product.productType;
  return Array.isArray(product.variants) && product.variants.length > 0 ? "variable" : "simple";
}
export function variantsToInventoryRows(variants = []) {
  return variants.map((variant) => {
    const legacyParts = String(variant.label || "").split("/").map((part) => part.trim()).filter(Boolean);
    return createInventoryVariant({
      id: variant.id,
      size: variant.size || legacyParts[0] || "",
      color: variant.color || legacyParts.slice(1).join(" / ") || "",
      sku: variant.sku,
      priceDollars: Number(variant.priceCents || 0) > 0
        ? (Number(variant.priceCents) / 100).toFixed(2)
        : "",
      stockQuantity: variant.stockQuantity ?? "",
      lowStockThreshold: variant.lowStockThreshold ?? "3",
    });
  });
}

export function inventoryRowsToVariants(rows = []) {
  return rows.map((row, index) => {
    const size = String(row.size || "").trim();
    const color = String(row.color || "").trim();
    return {
      id: String(row.id || `variant-${index + 1}`),
      label: [size, color].filter(Boolean).join(" / ") || `Option ${index + 1}`,
      size,
      color,
      sku: String(row.sku || "").trim(),
      priceCents: Math.max(0, Math.round(Number(row.priceDollars || 0) * 100)),
      stockQuantity: Math.max(0, Number(row.stockQuantity) || 0),
      lowStockThreshold: Math.max(0, Number(row.lowStockThreshold) || 0),
    };
  });
}
