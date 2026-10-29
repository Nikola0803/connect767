function numericRating(product) {
  const rating = Number.parseFloat(product?.rating);
  return Number.isFinite(rating) ? rating : 0;
}

function createdTime(product) {
  const timestamp = Date.parse(product?.dateCreated || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortShopProducts(products, sort) {
  const list = [...products];

  switch (sort) {
    case "price-low":
      return list.sort((a, b) => a.price - b.price);
    case "price-high":
      return list.sort((a, b) => b.price - a.price);
    case "rating":
      return list.sort((a, b) => numericRating(b) - numericRating(a));
    case "newest":
      return list.sort((a, b) => createdTime(b) - createdTime(a));
    case "featured":
    default:
      // Featured products lead the collection. Stable sorting retains the
      // WordPress Products > Sorting order within each group.
      return list.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }
}
