import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PromoBanner from "../components/PromoBanner";
import ProductCard from "../components/ProductCard";
import Studio from "../components/Studio";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useAsync } from "../hooks/useAsync";
import { useCart } from "../hooks/useCart";
import { getProducts, getShopCategories } from "../data/repository";
import { sortOptions } from "../data/shop";

export default function ShopPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
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
        : products.filter((p) => p.categorySlug === activeCategory || p.category === activeCategory);

    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
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

      <section className="border-b border-background-200/70 bg-background-100/60">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-10">
          <div className="flex flex-col md:flex-row md:items-end gap-5 mb-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700 mb-2">
                <span className="w-7 h-px bg-accent-500" />
                Connect767 Marketplace
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
                The <span className="text-accent-500 italic">Shop</span>
              </h1>
              <p className="mt-2 text-sm text-foreground-600">
                Discover products from Dominican brands and creators.
              </p>
            </div>
            <Link
              to="/shop/customize"
              className="md:ml-auto inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-magic-line" />
              Design your own gear
              <i className="ri-arrow-right-line" />
            </Link>
          </div>

          <div className="rounded-[1.4rem] border border-background-200/80 bg-background-50 shadow-[0_18px_50px_rgba(35,45,38,0.08)] overflow-hidden">
            <form className="p-3 md:p-4 border-b border-background-200/70" onSubmit={(e) => e.preventDefault()}>
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-primary-600 text-lg pointer-events-none" />
                <input
                  aria-label="Search shop products"
                  className="w-full h-12 pl-12 pr-11 rounded-xl border border-background-300/80 bg-white text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70 font-label text-sm md:text-base transition-all"
                  placeholder="Search products, categories or keywords"
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

            <div className="px-3 md:px-4 py-3 flex items-center gap-2 overflow-x-auto">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-500 mr-1 whitespace-nowrap flex-shrink-0">
                <i className="ri-equalizer-2-line text-sm text-primary-600" />
                Browse
              </span>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Product category</span>
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="appearance-none h-9 min-w-48 pl-3 pr-8 rounded-lg border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer"
                >
                  {(shopCategories || []).map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.slug === "all" ? "All Product Categories" : cat.label}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              <label className="relative flex-shrink-0">
                <span className="sr-only">Sort products</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="appearance-none h-9 min-w-40 pl-3 pr-8 rounded-lg border border-background-300 bg-white text-xs font-semibold text-foreground-700 focus:outline-none focus:border-primary-400 cursor-pointer"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none" />
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-9 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-accent-700 hover:text-accent-800 hover:bg-accent-50 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors"
                >
                  <i className="ri-refresh-line" />
                  Clear
                </button>
              )}

              <button
                aria-label="Open cart"
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative ml-auto w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border border-background-300 bg-white hover:bg-background-100 cursor-pointer transition-colors"
              >
                <i className="ri-shopping-cart-2-line text-base text-foreground-800" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-light text-foreground-950">
                Browse <span className="text-accent-500 italic">Products</span>
              </h2>
              <p className="mt-1 text-xs text-foreground-500">
                {loading ? "Finding products…" : `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"} found`}
              </p>
            </div>
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
