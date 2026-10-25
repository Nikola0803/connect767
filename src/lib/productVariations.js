/**
 * WooCommerce stores variation values as URL-style slugs while the picker
 * displays human-readable labels. Canonicalising both sides lets values such
 * as "Navy Blue" match "navy-blue" without changing what shoppers see.
 */
export function normalizeVariationValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeVariationAttributeName(name) {
  return normalizeVariationValue(
    String(name ?? "").replace(/^attribute_/i, "").replace(/^pa_/i, "")
  );
}

/**
 * Keep WooCommerce's raw option value for variation matching, but present
 * apparel/shoe sizes consistently throughout the storefront.
 */
export function formatVariationOption(attributeName, value) {
  const text = String(value ?? "");
  return normalizeVariationAttributeName(attributeName).includes("size")
    ? text.toUpperCase()
    : text;
}

export function variationMatchesSelections(variation, selections, ignoredAttribute = "") {
  const ignoredKey = normalizeVariationAttributeName(ignoredAttribute);

  return Object.entries(selections).every(([attributeName, selectedValue]) => {
    if (!selectedValue) return true;

    const attributeKey = normalizeVariationAttributeName(attributeName);
    if (attributeKey === ignoredKey) return true;

    const variationValue = Object.entries(variation.attributes || {}).find(
      ([variationAttributeName]) =>
        normalizeVariationAttributeName(variationAttributeName) === attributeKey
    )?.[1];
    // An empty value is WooCommerce's "Any" wildcard for that attribute.
    if (variationValue === "") return true;
    if (variationValue === null || variationValue === undefined) return false;

    return normalizeVariationValue(variationValue) === normalizeVariationValue(selectedValue);
  });
}

export function matchVariation(variations = [], selections = {}) {
  return variations.find((variation) => variationMatchesSelections(variation, selections));
}

export function isVariationOptionAvailable(
  variations = [],
  selections = {},
  attributeName,
  option
) {
  const nextSelections = { ...selections, [attributeName]: option };

  return variations.some(
    (variation) =>
      variation.purchasable !== false &&
      variation.inStock !== false &&
      variationMatchesSelections(variation, nextSelections)
  );
}
