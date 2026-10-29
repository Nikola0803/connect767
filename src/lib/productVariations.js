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

const naturalOptionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function apparelSizeRank(value) {
  const compact = normalizeVariationValue(value)
    .replace(/^(?:us-)?size-/, "")
    .replace(/-/g, "");
  const fixedRanks = {
    xxs: 10,
    "2xs": 10,
    extraextrasmall: 10,
    xs: 20,
    extrasmall: 20,
    s: 30,
    small: 30,
    m: 40,
    medium: 40,
    l: 50,
    large: 50,
    xl: 60,
    xlarge: 60,
    extralarge: 60,
  };
  if (fixedRanks[compact] !== undefined) return fixedRanks[compact];

  const numberedXl = compact.match(/^(\d+)xl$/);
  if (numberedXl) return 50 + Number(numberedXl[1]) * 10;

  const repeatedXl = compact.match(/^(x{2,})l$/);
  if (repeatedXl) return 50 + repeatedXl[1].length * 10;

  const plusSize = compact.match(/^(\d+)x$/);
  if (plusSize) return 60 + Number(plusSize[1]) * 10;

  return null;
}

/**
 * WooCommerce can return size terms in database/term order rather than the
 * order shoppers expect. Sort only size attributes: numeric shoe/waist sizes
 * ascend naturally, while apparel sizes follow XXS → XS → S → M → L → XL →
 * 2XL, etc. Color and every other attribute retain their configured order.
 */
export function sortVariationOptions(attributeName, options = []) {
  if (!normalizeVariationAttributeName(attributeName).includes("size")) return options;

  return [...options].sort((left, right) => {
    const leftRank = apparelSizeRank(left);
    const rightRank = apparelSizeRank(right);
    if (leftRank !== null && rightRank !== null && leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return naturalOptionCollator.compare(String(left), String(right));
  });
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
