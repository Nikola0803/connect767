import { categoryTaxonomy } from "./industries";

/**
 * Top-level categories for the directory's category filter — sourced from
 * the canonical taxonomy in src/data/industries.js (7 categories, 191
 * industries nested under them). See DirectoryPage.jsx for how the
 * industry-level sub-filter uses the same source.
 */
export const directoryCategories = [
  { label: "All Categories", slug: "all", icon: "ri-apps-2-line" },
  ...categoryTaxonomy.map((c) => ({ label: c.label, slug: c.slug, icon: c.icon })),
];

export const tierOptions = [
  { label: "All Tiers", value: "all" },
  { label: "Classified", value: "Classified" },
  { label: "Featured", value: "Featured" },
  { label: "Free", value: "Free" },
];

export const priceOptions = [
  { label: "Any Price", value: "all" },
  { label: "$ — Budget", value: "$" },
  { label: "$$ — Moderate", value: "$$" },
  { label: "$$$ — Premium", value: "$$$" },
];

export const directorySortOptions = [
  { value: "rating", label: "Highest Rated" },
  { value: "reviews", label: "Most Reviews" },
  { value: "newest", label: "Newest" },

  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
];

// Only real, client-provided listings — all placeholder/dummy businesses
// from the original source export were removed.
export const directoryListings = [
  // Real, client-provided businesses/professionals (not readdy.ai stock
  // photography) — see listingDetails.js for their full profiles and
  // README.md for source notes on each. All dummy/placeholder listings
  // were removed; this directory now shows only real content.
  {
    slug: "kalinago-tours",
    title: "Kalinago Tours",
    category: "Tour Operator · Cultural Heritage",
    categorySlug: "services",
    industrySlug: "tourism-services",
    price: "$$",
    location: "Kalinago Territory, Dominica",
    badge: "Classified",
    badgeIcon: "ri-vip-crown-line",
    verified: true,
    rating: "5",
    reviews: "(0)",
    image: "/uploads/kalinago-tours-walking.jpeg",
  },
  {
    slug: "finance-focus-consultancy",
    title: "Finance Focus Consultancy",
    category: "Business & Personal Finance Consulting",
    categorySlug: "services",
    industrySlug: "consulting-services",
    price: "$$",
    location: "Roseau, Dominica",
    badge: "Classified",
    badgeIcon: "ri-vip-crown-line",
    verified: true,
    rating: "5",
    reviews: "(0)",
    image: "/uploads/luana-laurent.jpg",
  },
  {
    slug: "catherine-lewis",
    title: "Catherine Lewis",
    category: "Emergency Preparedness · Business Administration",
    categorySlug: "services",
    industrySlug: "business-administration",
    price: "$",
    location: "Hempstead, New York (originally Dominica)",
    badge: "Free",
    badgeIcon: "ri-price-tag-3-line",
    verified: true,
    rating: "0",
    reviews: "(0)",
    image: "/uploads/catherine-lewis.jpeg",
  },
];

export const mapEmbedUrl =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d62032.30877992702!2d-61.41675721513707!3d15.348058688954516!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8c1322de7e7aee9d%3A0x3b00b5431a23d972!2sRoseau%2C%20Dominica!5e0!3m2!1sen!2sus!4v1719782400000!5m2!1sen!2sus";
