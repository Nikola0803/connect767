export const categories = [
  { icon: "ri-briefcase-4-line", name: "Services", count: "612 listings", href: "?category=services", active: true },
  { icon: "ri-price-tag-3-line", name: "Products", count: "184 listings", href: "?category=products" },
  { icon: "ri-key-2-line", name: "Rentals", count: "156 listings", href: "?category=rentals" },
  { icon: "ri-restaurant-2-line", name: "Eat & Drink", count: "428 listings", href: "?category=eat-and-drink" },
  { icon: "ri-calendar-event-line", name: "Events", count: "96 listings", href: "?category=events" },
  { icon: "ri-heart-pulse-line", name: "Fitness", count: "142 listings", href: "?category=fitness" },
  { icon: "ri-apps-2-line", name: "Other", count: "38 listings", href: "?category=other" },
];

export const listings = [
  // Real, client-provided listings only (used for the homepage's Trending
  // carousel and Featured grid) — see README.md's "Real listings" section.
  {
    slug: "kalinago-tours",
    title: "Kalinago Tours",
    category: "Tour Operator \u00b7 Cultural Heritage",
    price: "$$",
    location: "Kalinago Territory, Dominica",
    rating: "5",
    reviews: "(0)",
    badge: "Classified",
    badgeIcon: "ri-vip-crown-line",
    image: "/uploads/kalinago-tours-walking.jpeg",
  },
  {
    slug: "finance-focus-consultancy",
    title: "Finance Focus Consultancy",
    category: "Business & Personal Finance Consulting",
    price: "$$",
    location: "Roseau, Dominica",
    rating: "5",
    reviews: "(0)",
    badge: "Classified",
    badgeIcon: "ri-vip-crown-line",
    image: "/uploads/luana-laurent.jpg",
  },
  {
    slug: "catherine-lewis",
    title: "Catherine Lewis",
    category: "Emergency Preparedness \u00b7 Business Administration",
    price: "$",
    location: "Hempstead, New York",
    rating: "0",
    reviews: "(0)",
    badge: "Free",
    badgeIcon: "ri-price-tag-3-line",
    image: "/uploads/catherine-lewis.jpeg",
  },
];

export const steps = [
  {
    num: "01",
    icon: "ri-search-2-line",
    title: "Discover",
    text: "Search the directory by category, neighborhood, price, and rating — with a live map.",
  },
  {
    num: "02",
    icon: "ri-chat-smile-3-line",
    title: "Connect",
    text: "Message, book, or call any business directly from a well-designed profile card.",
  },
  {
    num: "03",
    icon: "ri-megaphone-line",
    title: "Publish",
    text: "Own a business? Post a free listing in minutes, or upgrade to Classified for the spotlight.",
  },
  {
    num: "04",
    icon: "ri-line-chart-line",
    title: "Grow",
    text: "Track views, reviews, and leads from your dashboard — plus tools to boost visibility.",
  },
];

// Blog post fixtures moved to src/data/blog.js (full articles, not just cards).

export const partners = ["Printful", "USPS", "UPS", "FedEx", "Amazon", "Meta", "Pinterest", "Stripe"];

export const heroImage = "/uploads/hero.webp";

export const uniformImage = "/uploads/uniform-studio-green-white-ai-emboss.png";
