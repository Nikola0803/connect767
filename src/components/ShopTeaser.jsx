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
export const shopHeroImage = `${WP_ORIGIN}/wp-content/uploads/2026/07/DSC_8707-Edit_17fdb17b-ddd5-4c9b-857b-83c9d142516a-scaled.jpg`;

const highlights = [
  {
    icon: "ri-shield-check-line",
    title: "Verified local sellers",
    copy: "Discover products from trusted Dominican businesses and independent makers.",
  },
  {
    icon: "ri-secure-payment-line",
    title: "Secure checkout",
    copy: "Shop confidently with clear product details and protected payment options.",
  },
  {
    icon: "ri-truck-line",
    title: "Flexible delivery",
    copy: "Available shipping and pickup choices are shown clearly before you order.",
  },
  {
    icon: "ri-t-shirt-air-line",
    title: "3D Custom Uniforms",
    copy: "Design team kits with colors, logos, names, numbers, sizes, and a full roster.",
  },
];

const imageFacts = [
  { label: "Marketplace", value: "Verified sellers", edge: "border-t-primary-500" },
  { label: "Delivery", value: "Shipping & pickup", edge: "border-t-secondary-500" },
  { label: "Uniform Studio", value: "Complete team kits", edge: "border-t-accent-500" },
];

export default function ShopTeaser() {
  const { data: shopCategories } = useAsync(() => getShopCategories(), []);
  const featuredCategories = (shopCategories || []).filter((c) => c.slug !== "all").slice(0, 4);

  return (
    <section className="w-full bg-background-100 px-4 py-16 text-foreground-950 md:px-8 md:py-24 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:mb-10 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800">
              <i className="ri-store-3-line" />
              Connect767 Marketplace
            </div>
            <h2 className="max-w-3xl font-heading text-4xl font-light leading-[1.08] md:text-5xl">
              Shop Connect767. <span className="italic text-accent-500">Design without limits.</span>
            </h2>
          </div>
          <p className="max-w-md font-label text-sm leading-6 text-foreground-600 md:text-right">
            Products, independent businesses, and custom teamwear—connected in one modern
            marketplace.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="group flex flex-col rounded-[2rem] border border-t-4 border-primary-200 border-t-primary-600 bg-gradient-to-br from-background-50 via-background-50 to-primary-50/70 p-6 shadow-[0_20px_60px_rgba(8,68,45,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_75px_rgba(31,112,78,0.14)] md:p-8 lg:col-span-6">
            <div className="mb-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
                One destination. Two ways to create.
              </p>
              <h3 className="mb-4 font-heading text-3xl font-medium leading-tight text-foreground-950 md:text-4xl">
                Find something distinctive—or build something entirely your own.
              </h3>
              <p className="max-w-xl font-label text-base leading-7 text-foreground-600">
                Browse products from Dominican makers and businesses, or open the 3D Uniform
                Studio to create a complete team kit with personalized player details.
              </p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
              <Link
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-background-50 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md"
                to="/shop"
              >
                Explore The Shop
                <i className="ri-arrow-right-line" />
              </Link>
              <Link
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-primary-200 bg-background-50 px-6 py-3 text-sm font-semibold text-primary-800 transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-primary-50 hover:shadow-sm"
                to="/uniforms"
              >
                <i className="ri-t-shirt-air-line" />
                Open 3D Uniform Studio
              </Link>
            </div>

            {featuredCategories.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2 border-t border-background-200/80 pt-6">
                {featuredCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-xs font-medium text-foreground-700 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                    to={`/shop?category=${cat.slug}`}
                  >
                    <i className={cat.icon} />
                    {cat.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="group relative overflow-hidden rounded-[2rem] border border-t-4 border-primary-200 border-t-accent-500 bg-primary-950 shadow-[0_20px_60px_rgba(8,68,45,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(8,68,45,0.2)] lg:col-span-6">
            <div className="h-[480px] w-full sm:h-[540px] lg:h-full lg:min-h-[520px]">
              <img
                alt="Connect767 marketplace apparel and custom uniform inspiration"
                title="Shop products and design custom team uniforms with Connect767"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.025]"
                src={shopHeroImage}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950/80 via-primary-950/5 to-transparent" />
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-background-50/80 bg-background-50/95 px-3 py-1.5 text-xs font-semibold text-foreground-950 shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-500" />
              New in the marketplace
            </div>
            <div className="absolute bottom-5 left-5 right-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {imageFacts.map((fact) => (
                <div
                  key={fact.label}
                  className={`group/fact rounded-2xl border border-t-4 border-background-200 bg-background-50/95 p-4 text-foreground-950 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${fact.edge}`}
                >
                  <div className="mb-1 font-label text-[10px] uppercase tracking-[0.14em] text-foreground-500">
                    {fact.label}
                  </div>
                  <div className="font-heading text-sm font-medium transition-colors group-hover/fact:text-primary-700">
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="group/card relative min-h-[250px] rounded-[1.5rem] border border-background-200 bg-background-50 p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_20px_46px_rgba(31,112,78,0.12)]"
            >
              <div className="mb-8 flex items-start gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-background-50 shadow-sm transition-transform duration-300 group-hover/card:scale-105">
                  <i className={`${item.icon} text-2xl`} />
                </span>
              </div>
              <h4 className="mb-3 font-heading text-2xl font-medium text-foreground-950">
                {item.title}
              </h4>
              <p className="font-label text-sm leading-6 text-foreground-600">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
