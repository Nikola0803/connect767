function numericRating(listing) {
  const rating = Number.parseFloat(listing?.rating);
  return Number.isFinite(rating) ? rating : 0;
}

function reviewCount(listing) {
  const directCount = Number.parseInt(listing?.reviewCount, 10);
  if (Number.isFinite(directCount)) return directCount;

  const countFromLabel = Number.parseInt(
    String(listing?.reviews || "").replace(/\D/g, ""),
    10,
  );
  return Number.isFinite(countFromLabel) ? countFromLabel : 0;
}

function createdTime(listing) {
  const timestamp = Date.parse(
    listing?.dateCreated || listing?.createdAt || listing?.date || "",
  );
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function priceLevel(listing) {
  return String(listing?.price || "").replace(/[^$]/g, "").length;
}

function newestFirst(a, b) {
  return createdTime(b) - createdTime(a);
}

function featuredFirst(a, b) {
  return Number(Boolean(b?.isFeatured)) - Number(Boolean(a?.isFeatured));
}

export function sortDirectoryListings(listings, sort) {
  const list = [...listings];

  switch (sort) {
    case "reviews":
      return list.sort(
        (a, b) => reviewCount(b) - reviewCount(a)
          || numericRating(b) - numericRating(a)
          || newestFirst(a, b)
          || featuredFirst(a, b),
      );
    case "newest":
      return list.sort(
        (a, b) => newestFirst(a, b)
          || featuredFirst(a, b),
      );
    case "price-low":
      return list.sort(
        (a, b) => priceLevel(a) - priceLevel(b)
          || featuredFirst(a, b)
          || newestFirst(a, b),
      );
    case "price-high":
      return list.sort(
        (a, b) => priceLevel(b) - priceLevel(a)
          || featuredFirst(a, b)
          || newestFirst(a, b),
      );
    case "rating":
    default:
      return list.sort(
        (a, b) => numericRating(b) - numericRating(a)
          || reviewCount(b) - reviewCount(a)
          || newestFirst(a, b)
          || featuredFirst(a, b),
      );
  }
}
