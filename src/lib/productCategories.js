function productCategories(product) {
  if (product?.categories?.length) return product.categories;

  if (product?.category || product?.categorySlug) {
    return [{ name: product.category || "", slug: product.categorySlug || "" }];
  }

  return [];
}

export function productMatchesCategory(product, category) {
  if (!category || category === "all") return true;
  const needle = String(category).toLowerCase();

  return productCategories(product).some((item) =>
    String(item?.slug || "").toLowerCase() === needle ||
    String(item?.name || "").toLowerCase() === needle
  );
}

export function productMatchesSearch(product, search) {
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return true;

  const searchableText = [
    product?.title,
    product?.description,
    product?.shortDescription,
    product?.sku,
    product?.uniformCategory,
    product?.readyMade ? "pre-design uniforms pre-designed uniform ready-made designs" : "",
  ].map((value) => String(value || "").toLowerCase());

  return (
    searchableText.some((value) => value.includes(needle)) ||
    productCategories(product).some((item) =>
      String(item?.name || "").toLowerCase().includes(needle) ||
      String(item?.slug || "").toLowerCase().includes(needle)
    ) ||
    (product?.tags || []).some((tag) => String(tag).toLowerCase().includes(needle))
  );
}
