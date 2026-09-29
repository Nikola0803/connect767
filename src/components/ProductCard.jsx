import { Link } from "react-router-dom";

export default function ProductCard({ product, onAddToCart }) {
  return (
    <Link
      to={`/shop/${product.slug}`}
      className="group block rounded-xl bg-background-50 border border-background-200/70 overflow-hidden transition-all duration-200 hover:border-background-300/80 cursor-pointer"
      data-product-shop="true"
    >
      <div className="relative overflow-hidden">
        <div className="aspect-square w-full overflow-hidden">
          <img
            alt={product.title}
            title={`${product.title} — Connect767 Shop`}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            src={product.image}
          />
        </div>
        {product.originalPrice && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-accent-500 text-background-50 text-xs font-semibold font-label">
            Sale
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-foreground-950 leading-snug mb-2 mt-1 group-hover:text-primary-700 transition-colors line-clamp-2">
          {product.title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-foreground-950">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-xs text-foreground-400 line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          <button
            aria-label={`Add ${product.title} to cart`}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer bg-primary-500 text-background-50 hover:bg-primary-600 active:scale-95"
          >
            <i className="text-base ri-shopping-cart-2-line" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-md bg-secondary-100 text-secondary-800 font-label"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
