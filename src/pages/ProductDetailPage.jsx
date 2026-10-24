import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { useCart } from "../hooks/useCart";
import { getProductBySlug } from "../data/repository";
import Button from "../components/ui/Button";
import { Spinner, ErrorState } from "../components/ui/States";
import { isVariationOptionAvailable, matchVariation } from "../lib/productVariations";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { data: product, loading, error, reload } = useAsync(() => getProductBySlug(slug), [slug]);
  const { addItem } = useCart();
  const [selections, setSelections] = useState({});
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setSelections({});
    setAdded(false);
  }, [slug]);

  const hasVariations = Boolean(product?.attributes?.length && product?.variations?.length);
  const matchedVariation = useMemo(
    () => (hasVariations ? matchVariation(product.variations, selections) : null),
    [hasVariations, product, selections]
  );

  if (loading) return <Spinner className="pt-16 md:pt-20 min-h-[60vh]" />;
  if (error) {
    return (
      <div className="pt-16 md:pt-20">
        <ErrorState message="Couldn't load this product." onRetry={reload} />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="pt-16 md:pt-20 px-4 md:px-8 lg:px-12 py-24 text-center">
        <h1 className="font-heading text-2xl text-foreground-950 mb-2">Product not found</h1>
        <p className="text-sm text-foreground-600 mb-6">
          We couldn't find a product at this address.
        </p>
        <Button to="/shop" icon="ri-arrow-right-line">
          Back to shop
        </Button>
      </div>
    );
  }

  const allSelected = !hasVariations || product.attributes.every((a) => selections[a.name]);
  const displayPrice = matchedVariation?.price ?? product.price;
  const displayOriginalPrice = matchedVariation?.onSale
    ? matchedVariation.regularPrice
    : !hasVariations
      ? product.originalPrice
      : null;
  const displayImage = matchedVariation?.image || product.image;
  const inStock = hasVariations ? matchedVariation?.inStock : product.inStock;
  // A variable product's PARENT is correctly non-purchasable in WooCommerce
  // (you can't buy "the shirt" without picking a size/color) - so once
  // variations exist, purchasability has to come from the matched
  // variation, not the parent, or the button stays disabled forever even
  // with a fully valid selection.
  const validVariation = !hasVariations || Boolean(matchedVariation);
  const purchasable = hasVariations
    ? Boolean(matchedVariation && matchedVariation.purchasable !== false)
    : product.purchasable !== false;
  const canAddToCart = validVariation && purchasable && inStock !== false && allSelected;

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    const variationLabel = hasVariations
      ? product.attributes.map((a) => selections[a.name]).filter(Boolean).join(" / ")
      : "";
    addItem(
      { slug: product.slug, title: product.title, image: displayImage, price: displayPrice },
      matchedVariation ? { ...matchedVariation, label: variationLabel } : null,
      1
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 border-b border-background-200/70 bg-background-50">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs font-label text-foreground-500">
          <Link className="hover:text-foreground-800 cursor-pointer" to="/">
            Home
          </Link>
          <i className="ri-arrow-right-s-line text-xs" />
          <Link className="hover:text-foreground-800 cursor-pointer" to="/shop">
            Shop
          </Link>
          <i className="ri-arrow-right-s-line text-xs" />
          <span className="text-foreground-800 font-medium truncate">{product.title}</span>
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="relative rounded-2xl overflow-hidden border border-background-200/70 aspect-square">
            <img
              src={displayImage}
              alt={product.title}
              className="w-full h-full object-cover object-top"
            />
            {displayOriginalPrice && (
              <span className="absolute top-4 left-4 px-2.5 py-1 rounded-md bg-accent-500 text-background-50 text-xs font-semibold font-label">
                Sale
              </span>
            )}
          </div>

          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-4">
              {product.title}
            </h1>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-2xl font-semibold text-foreground-950">
                ${displayPrice.toFixed(2)}
              </span>
              {displayOriginalPrice && (
                <span className="text-base text-foreground-400 line-through">
                  ${displayOriginalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {hasVariations && (
              <div className="mb-6 space-y-4">
                {product.attributes.map((attr) => (
                  <div key={attr.name}>
                    <label className="block text-xs font-semibold text-foreground-800 mb-2">
                      {attr.name}
                      {selections[attr.name] && (
                        <span className="text-foreground-500 font-normal"> &mdash; {selections[attr.name]}</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {attr.options.map((option) => {
                        const optionAvailable = isVariationOptionAvailable(
                          product.variations,
                          selections,
                          attr.name,
                          option
                        );

                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={!optionAvailable}
                            onClick={() =>
                              setSelections((s) => ({ ...s, [attr.name]: option }))
                            }
                            className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                              selections[attr.name] === option
                                ? "bg-primary-500 text-background-50 border-primary-500 cursor-pointer"
                                : optionAvailable
                                  ? "bg-background-50 text-foreground-700 border-background-300 hover:border-primary-300 cursor-pointer"
                                  : "bg-background-100 text-foreground-300 border-background-200 cursor-not-allowed line-through"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs rounded-md bg-secondary-100 text-secondary-800 font-label"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-foreground-600 leading-relaxed mb-8">
              Made in the Connect767 shop network &mdash; {product.category?.toLowerCase()} goods
              shipped straight from Dominica.{" "}
              {hasVariations && !allSelected
                ? "Choose the available options to see stock and pricing."
                : allSelected && !matchedVariation
                  ? "That combination is unavailable. Please choose another option."
                  : inStock === false
                    ? "Currently out of stock."
                    : "In stock and ready to ship."}
            </p>

            <Button
              variant={added ? "primary" : "primary"}
              size="lg"
              icon={added ? "ri-check-line" : "ri-shopping-cart-2-line"}
              iconPosition="left"
              disabled={!canAddToCart}
              onClick={handleAddToCart}
            >
              {added
                ? "Added to cart"
                : allSelected && hasVariations && !matchedVariation
                  ? "Combination unavailable"
                  : inStock === false
                    ? "Out of stock"
                  : hasVariations && !allSelected
                    ? `Select ${product.attributes.find((a) => !selections[a.name])?.name?.toLowerCase()}`
                    : "Add to cart"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
