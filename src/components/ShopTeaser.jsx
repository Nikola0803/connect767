import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getShopCategories } from "../data/repository";
import { config } from "../lib/config";

// See Header.jsx for why this can't just be a same-domain path — the
// WordPress media library lives on the admin.* subdomain.
const WP_ORIGIN = config.wpBaseUrl || "https://admin.connect767.com";
// The file this originally pointed at (DSC_8707-Edit-scaled-1.jpg) no longer
// exists in the media library — WordPress re-uploads of the same filename
// get a random hash appended rather than reusing the old name, so a hardcoded
// path like this silently 404s the moment the underlying file changes.
// Confirmed via /wp-json/wp/v2/media?search=DSC_8707 that this is the
// current real attachment.
const shopHeroImage = `${WP_ORIGIN}/wp-content/uploads/2026/07/DSC_8707-Edit_17fdb17b-ddd5-4c9b-857b-83c9d142516a-scaled.jpg`;

const checklist = [
  "Curated goods from verified local makers",
  "Apparel, food & drink, home goods, and more",
  "Secure checkout, island-wide shipping",
  "New arrivals added every week",
];

export default function ShopTeaser() {
  const { data: shopCategories } = useAsync(() => getShopCategories(), []);
  const featuredCategories = (shopCategories || []).filter((c) => c.slug !== "all").slice(0, 4);

  return (
    <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-primary-950 text-background-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-50/10 border border-background-50/20 text-background-50 text-xs font-medium mb-6">
              <i className="ri-store-3-line" />
              Connect767 Shop
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-light leading-tight mb-6">
              The corner store — <span className="italic text-accent-400">now in your cart.</span>
            </h2>
            <p className="text-background-50/80 text-base md:text-lg font-light leading-relaxed mb-8 max-w-xl">
              Coffee roasted up the road, linen made by island hands, ceramics from a family
              workshop — browse curated goods from local makers and get it shipped straight from
              Dominica. Need custom team gear instead? The{" "}
              <Link
                to="/uniforms"
                className="underline decoration-accent-400/60 hover:decoration-accent-400 text-background-50"
              >
                Uniform Studio
              </Link>{" "}
              builds that too.
            </p>
            <ul className="space-y-3 mb-8">
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-background-50/90">
                  <span className="mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-accent-500/20 text-accent-300">
                    <i className="ri-check-line text-xs" />
                  </span>
                  <span className="font-label">{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
                to="/shop"
              >
                Browse the shop
                <i className="ri-arrow-right-line" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-background-50/30 text-background-50 text-sm font-semibold hover:bg-background-50/10 transition-colors cursor-pointer whitespace-nowrap"
                to="/uniforms"
              >
                Design custom uniforms
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {featuredCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/10 hover:bg-background-50/20 border border-background-50/15 text-xs font-medium cursor-pointer whitespace-nowrap"
                  to={`/shop?category=${cat.slug}`}
                >
                  <i className={cat.icon} />
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 relative">
            <div className="relative rounded-3xl overflow-hidden bg-background-50/5 border border-background-50/10">
              <div className="w-full h-[520px]">
                <img
                  alt="Curated island-made goods from the Connect767 Shop"
                  title="Connect767 Shop — island-made goods"
                  className="w-full h-full object-cover object-top"
                  src={shopHeroImage}
                />
              </div>
              <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/95 text-foreground-950 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                New this week
              </div>
              <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-background-50/95 text-foreground-950 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-foreground-600 font-label mb-1">
                    Shipping
                  </div>
                  <div className="text-sm font-semibold">Free over $50</div>
                </div>
                <div className="rounded-xl bg-background-50/95 text-foreground-950 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-foreground-600 font-label mb-1">
                    Returns
                  </div>
                  <div className="text-sm font-semibold">15 days</div>
                </div>
                <div className="rounded-xl bg-accent-500 text-background-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-background-50/80 font-label mb-1">
                    Checkout
                  </div>
                  <div className="text-sm font-semibold">Secure</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
