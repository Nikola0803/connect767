import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PromoBanner from "../components/PromoBanner";
import ProductCard from "../components/ProductCard";
import Studio from "../components/Studio";
import { shopHeroImage } from "../components/ShopTeaser";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { useCart } from "../hooks/useCart";
import { getProducts, getShopCategories } from "../data/repository";
import { sortOptions } from "../data/shop";
import { productMatchesCategory, productMatchesSearch } from "../lib/productCategories";

export default function ShopPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "all");
  const [sort, setSort] = useState("featured");
  const { count: cartCount, addItem, setIsOpen: setCartOpen } = useCart();

  const { data: products, loading, error, reload } = useAsync(() => getProducts(), []);
  const { data: shopCategories } = useAsync(() => getShopCategories(), []);

  const visibleProducts = useMemo(() => {
    if (!products) return [];
    let list =
      activeCategory === "all"
        ? products
        : products.filter((product) => productMatchesCategory(product, activeCategory));

    if (search) {
      list = list.filter((product) => productMatchesSearch(product, search));
    }

    switch (sort) {
      case "price-low":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list = [...list].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
        break;
      default:
        break;
    }
    return list;
  }, [products, activeCategory, search, sort]);

  const hasActiveFilters = activeCategory !== "all" || Boolean(search.trim());

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("all");
  };

  const handleAddToCart = (product) => addItem(product, null, 1);

  return (
    <div className="pt-16 md:pt-20">
      <PromoBanner />

      <section className="relative overflow-hidden bg-primary-950 text-background-50">
        <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full bg-primary-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 left-1/4 w-96 h-96 rounded-full bg-accent-500/15 blur-3xl pointer-events-none" />
        <div className="relative w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 pt-10 pb-16 md:pt-12 md:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:items-center gap-8 lg:gap-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-background-50/15 bg-background-50/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-200">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
                The Connect767 Shop
              </div>
              <h1 className="mt-4 font-heading text-[clamp(2.6rem,5vw,4.8rem)] font-medium leading-[0.95] tracking-[-0.045em]">
                Island-made. <span className="italic text-accent-400">World-ready.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm md:text-base leading-relaxed text-background-200">
                Discover apparel, essentials and experiences from Dominican brands and creators—at home and around the world.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/shop/customize"
                  className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-background-50 text-primary-950 text-sm font-bold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-magic-line text-lg" />
                  Design custom gear
                  <i className="ri-arrow-right-line" />
                </Link>
                <button
                  aria-label="Open cart"
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="relative inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full border border-background-50/20 bg-background-50/5 text-sm font-semibold hover:bg-background-50/10 cursor-pointer transition-colors"
                >
                  <i className="ri-shopping-bag-3-line text-lg" />
                  Cart
                  {cartCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="relative hidden sm:block">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-background-50/15 bg-background-50/5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                <img
                  fetchPriority="high"
                  decoding="async"
                  src={shopHeroImage}
                  alt="Dominican-made products in the Connect767 Shop"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "center 22%" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary-950/75 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-100">Curated in Dominica</p>
                    <p className="mt-1 font-heading text-2xl text-background-50">Made with island character.</p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-500 text-background-50"><i className="ri-arrow-right-up-line" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-10 w-full px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto rounded-[1.6rem] border border-background-200/80 bg-background-50 p-3 md:p-4 shadow-[0_24px_70px_rgba(24,48,36,0.14)]">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="relative flex-1 min-w-0">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-primary-700 text-lg pointer-events-none" />
              <input
                aria-label="Search shop products"
                className="w-full h-12 pl-12 pr-11 rounded-xl border border-background-300/80 bg-white text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 font-label text-sm transition-all"
                placeholder="What are you looking for?"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear product search"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-foreground-400 hover:text-foreground-800 hover:bg-background-100 cursor-pointer transition-colors"
                >
                  <i className="ri-close-line" />
                </button>
              )}
            </div>

          </form>

          <div className="mt-3 pt-3 border-t border-background-200/70 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(shopCategories || []).map((cat) => {
              const isActive = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`inline-flex h-9 items-center gap-2 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    isActive
                      ? "bg-primary-600 text-background-50 shadow-sm"
                      : "bg-background-100 text-foreground-700 hover:bg-primary-50 hover:text-primary-800"
                  }`}
                >
                  <i className={`${cat.icon} text-sm`} />
                  {cat.slug === "all" ? "All products" : cat.label}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-semibold text-accent-700 hover:bg-accent-50 rounded-full cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-close-circle-line" />
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="w-full px-4 md:px-8 lg:px-12 pt-14 pb-10 md:pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-7">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 mb-2">
                Curated for you
              </div>
              <h2 className="font-heading text-2xl md:text-4xl font-light text-foreground-950">
                Shop the <span className="text-accent-500 italic">collection</span>
              </h2>
              <p className="mt-1 text-xs text-foreground-500">
                {loading ? "Finding products…" : `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"} found`}
              </p>
            </div>
            <label className="relative sm:ml-auto flex-shrink-0">
              <span className="sr-only">Sort products</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="appearance-none h-10 min-w-44 pl-3.5 pr-9 rounded-full border border-background-300 bg-background-50 text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
            </label>
          </div>

        {loading && (
          <CardSkeleton
            count={8}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          />
        )}

        {error && <ErrorState message="Couldn't load products." onRetry={reload} />}

        {!loading && !error && visibleProducts.length === 0 && (
          <EmptyState
            icon="ri-shopping-bag-3-line"
            title="No products match this category"
            description="Try a different filter"
          />
        )}

        {!loading && !error && visibleProducts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {visibleProducts.map((product) => (
                <ProductCard key={product.slug} product={product} onAddToCart={handleAddToCart} />
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-foreground-400">
              Showing {visibleProducts.length} of {products.length} products
            </p>
          </>
        )}
        </div>
      </section>

      <Studio />
    </div>
  );
}
