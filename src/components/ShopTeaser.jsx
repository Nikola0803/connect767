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
const soccerUniformRender = "/uploads/3d-soccer-uniform-render-watermark.png";

const uniformSports = ["Soccer", "Basketball", "Cricket", "Netball", "Management Kit"];

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

export default function ShopTeaser() {
  const { data: shopCategories } = useAsync(() => getShopCategories(), []);
  const featuredCategories = (shopCategories || [])
    .filter((c) => c.slug !== "all")
    .slice(0, 4)
    .map((category) =>
      category.label === "Sweaters & Sweatpants" ? { ...category, label: "Shorts" } : category,
    );

  return (
    <section className="w-full bg-background-100 px-4 py-16 text-foreground-950 md:px-8 md:py-24 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:mb-10 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800">
              <i className="ri-store-3-line" />
              Connect767 Marketplace
            </div>
            <h2 className="max-w-3xl font-heading text-3xl font-light leading-tight md:text-5xl">
              Shop Connect767. <span className="italic text-accent-500">Design without limits.</span>
            </h2>
          </div>
          <p className="max-w-md font-label text-base font-light leading-relaxed text-foreground-700 md:text-right md:text-lg">
            Products, independent businesses, and custom teamwear—connected in one modern
            marketplace.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <Link
            to="/uniforms"
            aria-label="Open the Connect767 3D Uniform Studio"
            className="group flex cursor-pointer flex-col rounded-[1.5rem] border border-background-200 bg-background-50 p-6 text-inherit no-underline shadow-[0_8px_24px_rgba(44,37,25,0.08)] outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_20px_46px_rgba(31,112,78,0.12)] focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-100 md:p-8 lg:col-span-6"
          >
            <div className="mb-7 lg:min-h-[17rem]">
              <div className="mb-7 flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-background-50 shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <i className="ri-store-3-line text-2xl" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
                  One destination. Two ways to create.
                </p>
              </div>
              <h3 className="mb-4 font-heading text-2xl font-medium leading-tight text-foreground-950">
                Find something distinctive—or build something entirely your own.
              </h3>
              <p className="max-w-xl font-label text-base leading-7 text-foreground-600">
                Browse products from Dominican makers and businesses, or open the 3D Uniform
                Studio to create a complete team kit with personalized player details.
              </p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[1.15rem] border border-primary-100 bg-primary-50">
              <img
                alt="Emerald green and cream number 10 soccer uniform with matching shorts and socks"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                decoding="async"
                loading="lazy"
                src={soccerUniformRender}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-primary-200 bg-background-50 px-6 py-3 text-sm font-semibold text-primary-800 transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-primary-50 hover:shadow-sm"
              >
                <i className="ri-t-shirt-air-line" />
                Open 3D Uniform Studio
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-background-200/80 pt-5">
              {uniformSports.map((sport) => (
                <span
                  key={sport}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-xs font-medium text-foreground-700 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                >
                  <i className="ri-t-shirt-air-line" />
                  {sport}
                </span>
              ))}
            </div>
          </Link>

          <Link
            to="/shop"
            aria-label="Explore the Connect767 Shop"
            className="group flex h-full cursor-pointer flex-col rounded-[1.5rem] border border-background-200 bg-background-50 p-6 text-inherit no-underline shadow-[0_8px_24px_rgba(44,37,25,0.08)] outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_20px_46px_rgba(31,112,78,0.12)] focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-100 md:p-8 lg:col-span-6"
          >
            <div className="mb-7 lg:min-h-[17rem]">
              <div className="mb-7 flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-background-50 shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <i className="ri-shopping-bag-3-line text-2xl" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
                  New in the marketplace
                </p>
              </div>
              <h3 className="mb-4 font-heading text-2xl font-medium leading-tight text-foreground-950">
                Discover standout products from the Connect767 Shop.
              </h3>
              <p className="max-w-xl font-label text-base leading-7 text-foreground-600">
                Shop apparel, essentials, and distinctive finds from Connect767 brands and
                sellers—all in one connected marketplace.
              </p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[1.15rem] bg-primary-950">
              <div className="h-full w-full">
                <img
                  alt="Connect767 marketplace apparel and custom uniform inspiration"
                  title="Shop products and design custom team uniforms with Connect767"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-[center_12%] transition-transform duration-700 group-hover:scale-[1.025]"
                  src={shopHeroImage}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary-950/80 via-primary-950/5 to-transparent" />
            </div>

            <span className="mt-4 inline-flex cursor-pointer items-center gap-2 self-start rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-background-50 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:bg-primary-700 group-hover:shadow-md">
              Shop
              <i className="ri-arrow-right-line" />
            </span>

            {featuredCategories.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-background-200/80 pt-5">
                {featuredCategories.map((cat) => (
                  <span
                    key={cat.slug}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-xs font-medium text-foreground-700 transition-all group-hover:border-primary-200 group-hover:bg-primary-50"
                  >
                    <i className={cat.icon} />
                    {cat.label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-background-200 bg-background-50 px-3 py-1.5 text-xs font-medium text-foreground-700 transition-all group-hover:border-primary-200 group-hover:bg-primary-50">
                  <i className="ri-price-tag-3-line" />
                  Shoes
                </span>
              </div>
            )}
          </Link>
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
