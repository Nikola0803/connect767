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
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
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
  }, [products, activeCategory, sort]);

  const handleAddToCart = (product) => addItem(product, null, 1);

  return (
    <div className="pt-16 md:pt-20">
      <PromoBanner />

      <section className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-2">
            The Shop
          </h1>
          <p className="text-sm text-foreground-600 max-w-xl mb-5">
            Feel Connected with Connect767 Clothing
          </p>
          <Link
            to="/shop/customize"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-magic-line" />
            Design your own gear
            <i className="ri-arrow-right-line" />
          </Link>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <form className="relative flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-500 text-sm" />
              <input
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label"
                placeholder="Search products..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <i className="ri-search-line" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 flex-1">
            {(shopCategories || []).map((cat) => {
              const isActive = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-primary-500 text-background-50 border-primary-500"
                      : "bg-background-50 text-foreground-700 border-background-200/70 hover:border-background-300 hover:bg-background-100"
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className={`${cat.icon} text-xs`} />
                  </div>
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-label text-foreground-500 whitespace-nowrap">
              {visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"}
            </span>
            <div className="sm:ml-auto flex items-center gap-3">
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="appearance-none pl-3.5 pr-8 py-2 text-sm bg-background-50 border border-background-200/70 rounded-lg text-foreground-700 cursor-pointer focus:outline-none focus:border-primary-300 font-label"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 flex items-center justify-center text-foreground-400">
                  <i className="ri-arrow-down-s-line text-sm" />
                </div>
              </div>
              <button
                aria-label="Open cart"
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-background-200/70 hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-shopping-cart-2-line text-lg text-foreground-800" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
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
