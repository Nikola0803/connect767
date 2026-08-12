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

export const stats = [
  { value: "12k+", label: "Active listings" },
  { value: "180k", label: "Monthly visitors" },
  { value: "4.9★", label: "Average rating" },
  { value: "48h", label: "Median first lead" },
];

// Blog post fixtures moved to src/data/blog.js (full articles, not just cards).

export const partners = ["Printful", "USPS", "UPS", "FedEx", "Amazon", "Meta", "Pinterest", "Stripe"];

export const heroImage =
  "https://readdy.ai/api/search-image?query=Editorial%20wide%20aerial%20view%20of%20a%20warm%20cream%20and%20emerald%20coastal%20town%20street%20at%20golden%20hour%2C%20colorful%20low-rise%20shopfronts%2C%20terracotta%20rooftops%2C%20people%20walking%20casually%2C%20tropical%20palm%20trees%2C%20soft%20warm%20light%2C%20muted%20color%20palette%2C%20highly%20detailed%20cinematic%20lifestyle%20photography&width=1800&height=1200&seq=connect767-hero-2026-main&orientation=landscape";

export const uniformImage =
  "https://readdy.ai/api/search-image?query=Editorial%203D%20render%20of%20a%20full%20soccer%20uniform%20floating%20mid-air%2C%20emerald%20green%20and%20cream%20jersey%20with%20number%2010%2C%20matching%20shorts%20and%20socks%2C%20soft%20studio%20lighting%2C%20warm%20terracotta%20backdrop%2C%20minimalist%20product%20photography%2C%20cinematic%20composition%2C%20highly%20detailed%20fabric%20textures&width=1200&height=1200&seq=connect767-uniform-studio-hero&orientation=squarish";
