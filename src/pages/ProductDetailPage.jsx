import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { useCart } from "../hooks/useCart";
import { getProductBySlug } from "../data/repository";
import Button from "../components/ui/Button";
import { Spinner, ErrorState } from "../components/ui/States";
import {
  formatVariationOption,
  isVariationOptionAvailable,
  matchVariation,
} from "../lib/productVariations";
import { detectLegacySizeChart, explicitSizeChart } from "../lib/productSizeGuide";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { data: product, loading, error, reload } = useAsync(() => getProductBySlug(slug), [slug]);
  const { addItem } = useCart();
  const [selections, setSelections] = useState({});
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [detectedSizeChart, setDetectedSizeChart] = useState(null);

  useEffect(() => {
    setSelections({});
    setAdded(false);
    setSelectedImage("");
    setDetectedSizeChart(null);
  }, [slug]);

  useEffect(() => {
    if (!product) return undefined;
    let cancelled = false;
    const knownChart = product.sizeChart || explicitSizeChart(product.gallery);
    if (knownChart) {
      setDetectedSizeChart(knownChart);
      return undefined;
    }

    detectLegacySizeChart(product.gallery, product.description).then((chart) => {
      if (!cancelled) setDetectedSizeChart(chart);
    });
    return () => {
      cancelled = true;
    };
  }, [product]);

  const sizeChart = product?.sizeChart || detectedSizeChart;

  const hasVariations = Boolean(product?.attributes?.length && product?.variations?.length);
  const matchedVariation = useMemo(
    () => (hasVariations ? matchVariation(product.variations, selections) : null),
    [hasVariations, product, selections]
  );

  const gallery = useMemo(() => {
    if (!product) return [];
    const images = [
      ...(product.gallery || []).filter((image) => image.src !== sizeChart?.src),
      ...(product.variations || []).map((variation) => ({
        src: variation.image,
        alt: `${product.title} — product variation`,
      })),
    ];
    if (product.image) images.unshift({ src: product.image, alt: product.title });
    return images.filter(
      (image, index) =>
        image?.src && images.findIndex((candidate) => candidate?.src === image.src) === index
    );
  }, [product, sizeChart?.src]);

  useEffect(() => {
    const nextImage = matchedVariation?.image || product?.image || gallery[0]?.src || "";
    if (nextImage) setSelectedImage(nextImage);
  }, [gallery, matchedVariation?.image, product?.image]);

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
  const displayImage = selectedImage || matchedVariation?.image || product.image;
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
      ? product.attributes
        .map((attribute) =>
          selections[attribute.name]
            ? formatVariationOption(attribute.name, selections[attribute.name])
            : ""
        )
        .filter(Boolean)
        .join(" / ")
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
          <div>
            <div className="relative rounded-2xl overflow-hidden border border-background-200/70 aspect-square bg-background-50">
              <img
                key={displayImage}
                src={displayImage}
                alt={
                  gallery.find((image) => image.src === displayImage)?.alt ||
                  (matchedVariation ? `${product.title} — selected variation` : product.title)
                }
                className="w-full h-full object-cover object-top transition-opacity duration-200"
              />
              {displayOriginalPrice && (
                <span className="absolute top-4 left-4 px-2.5 py-1 rounded-md bg-accent-500 text-background-50 text-xs font-semibold font-label">
                  Sale
                </span>
              )}
            </div>

            {gallery.length > 1 && (
              <div
                className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3"
                aria-label="Product gallery"
              >
                {gallery.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => setSelectedImage(image.src)}
                    aria-label={`View product image ${index + 1}`}
                    aria-pressed={displayImage === image.src}
                    className={`aspect-square overflow-hidden rounded-lg border-2 bg-background-50 transition-colors cursor-pointer ${
                      displayImage === image.src
                        ? "border-primary-500"
                        : "border-background-200 hover:border-primary-300"
                    }`}
                  >
                    <img
                      src={image.src}
                      alt=""
                      className="w-full h-full object-cover object-top"
                    />
                  </button>
                ))}
              </div>
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
                        <span className="text-foreground-500 font-normal">
                          {" "}&mdash; {formatVariationOption(attr.name, selections[attr.name])}
                        </span>
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
                            {formatVariationOption(attr.name, option)}
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
            {(sizeChart || product.sizeGuideText) && (
              <section
                className="mb-6 border-y border-background-200 py-5"
                aria-labelledby="product-size-guide-heading"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h2
                    id="product-size-guide-heading"
                    className="font-heading text-xl text-foreground-950"
                  >
                    Size guide
                  </h2>
                  {sizeChart?.src && (
                    <a
                      href={sizeChart.src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary-700 hover:text-primary-900"
                    >
                      Open full size <i className="ri-external-link-line" />
                    </a>
                  )}
                </div>
                {sizeChart?.src && (
                  <div className="overflow-hidden rounded-xl border border-background-200 bg-white p-3">
                    <img
                      src={sizeChart.src}
                      alt={sizeChart.alt || `${product.title} size guide`}
                      className="mx-auto max-h-[32rem] w-full object-contain"
                    />
                  </div>
                )}
                {product.sizeGuideText && (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-background-100 p-4 font-label text-xs leading-relaxed text-foreground-700">
                    {product.sizeGuideText}
                  </pre>
                )}
              </section>
            )}
            <section className="mb-6" aria-labelledby="product-description-heading">
              <h2
                id="product-description-heading"
                className="font-heading text-xl text-foreground-950 mb-2"
              >
                Product description
              </h2>
              <p className="text-sm text-foreground-600 leading-relaxed whitespace-pre-line">
                {product.description ||
                  `Made in the Connect767 shop network — ${product.category?.toLowerCase() || "quality"} goods shipped straight from Dominica.`}
              </p>
            </section>

            <p className="text-sm font-medium text-foreground-700 mb-8" role="status">
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
