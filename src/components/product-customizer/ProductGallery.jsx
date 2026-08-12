import ProductGraphic from "./ProductGraphic";

/**
 * Step 1 of the customizer flow — select a product.
 */
export default function ProductGallery({ productTypes, onSelect }) {
  return (
    <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
            Choose your <span className="italic text-primary-700">apparel</span>
          </h1>
          <p className="text-sm text-foreground-600 font-label">
            Pick a product and customize your design.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {productTypes.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => onSelect(p.slug)}
              className="text-left rounded-2xl border border-background-200/70 hover:border-primary-300 bg-background-50 p-5 transition-colors cursor-pointer group"
            >
              <div className="w-full h-32 rounded-xl overflow-hidden mb-4 bg-background-100 p-4">
                <ProductGraphic productType={p.slug} view={p.placements[0]?.key || "front"} color="#e5e5e5" />
              </div>
              <h3 className="font-heading text-base font-medium text-foreground-950 mb-1">{p.label}</h3>
              <p className="text-xs text-foreground-500 font-label">From ${p.basePrice}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
