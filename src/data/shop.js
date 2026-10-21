export const shopCategories = [
  { icon: "ri-store-3-line", label: "All Products", slug: "all" },
  // Keep the offline preview aligned with the Product Categories currently
  // configured in WordPress. Production still reads this list dynamically
  // from WooCommerce through getShopCategories().
  { icon: "ri-t-shirt-line", label: "T-Shirts", slug: "t-shirts" },
  { icon: "ri-shirt-line", label: "Hoodies", slug: "hoodies" },
  { icon: "ri-shirt-line", label: "Sweaters & Sweatpants", slug: "sweaters-sweatpants" },
  { icon: "ri-run-line", label: "Activewear", slug: "activewear" },
  { icon: "ri-run-line", label: "Leggings", slug: "leggings" },
  { icon: "ri-run-line", label: "Joggers", slug: "joggers" },
  { icon: "ri-footprint-line", label: "Shoes", slug: "accessories" },
  { icon: "ri-run-line", label: "Shorts", slug: "shorts" },
  { icon: "ri-t-shirt-2-line", label: "Jerseys", slug: "jerseys" },
  { icon: "ri-map-pin-2-line", label: "Shy Guy Dominica Tours", slug: "shy-guy-dominica-tours" },
];

export const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

// All 16 placeholder/dummy products from the original source export were
// removed — the shop now shows only real products. None have been provided
// yet; add real product data here the same way the 3 real listings were
// added (see README.md's "Real listings" section for that pattern).
export const products = [
];
