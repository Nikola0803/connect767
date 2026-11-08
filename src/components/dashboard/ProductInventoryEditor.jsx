import { FormField, Input } from "../ui/FormField";
import { createInventoryVariant } from "../../lib/productInventory";

const productTypes = [
  {
    value: "simple",
    title: "Simple item",
    description: "One SKU, one price and one shared stock quantity.",
    icon: "ri-box-3-line",
  },
  {
    value: "variable",
    title: "Variable product",
    description: "Different sizes, colors, prices and stock levels.",
    icon: "ri-layout-grid-line",
  },
];

export default function ProductInventoryEditor({ form, setForm }) {
  const chooseType = (productType) => {
    setForm((current) => ({
      ...current,
      productType,
      trackStock: productType === "variable" ? true : current.trackStock,
      variants: productType === "variable" && current.variants.length === 0
        ? [createInventoryVariant()]
        : current.variants,
    }));
  };

  const updateVariant = (id, field, value) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => variant.id === id ? { ...variant, [field]: value } : variant),
    }));
  };

  const removeVariant = (id) => {
    setForm((current) => ({ ...current, variants: current.variants.filter((variant) => variant.id !== id) }));
  };

  return (
    <section className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Inventory</p>
        <h3 className="mt-1 font-heading text-lg font-semibold text-foreground-950">Choose how this product is stocked</h3>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {productTypes.map((type) => {
          const selected = form.productType === type.value;
          return (
            <label key={type.value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${selected ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200" : "border-background-200 bg-white"}`}>
              <input type="radio" name="productType" value={type.value} checked={selected} onChange={() => chooseType(type.value)} className="sr-only" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-primary-700 text-white" : "bg-background-100 text-foreground-600"}`}><i className={`${type.icon} text-lg`} /></span>
              <span><span className="block text-sm font-semibold text-foreground-950">{type.title}</span><span className="mt-1 block text-xs leading-relaxed text-foreground-600">{type.description}</span></span>
            </label>
          );
        })}
      </div>

      {form.productType === "simple" ? (
        <div className="mt-5 rounded-xl border border-background-200 bg-white p-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-foreground-800">
            <input type="checkbox" checked={form.trackStock} onChange={(event) => setForm((current) => ({ ...current, trackStock: event.target.checked }))} />
            Track inventory and prevent overselling
          </label>
          {form.trackStock && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Stock quantity" htmlFor="vp-stock" required><Input id="vp-stock" type="number" min="0" value={form.stockQuantity} required onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))} /></FormField>
              <FormField label="Low-stock warning" htmlFor="vp-low-stock"><Input id="vp-low-stock" type="number" min="0" value={form.lowStockThreshold} onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: event.target.value }))} /></FormField>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h4 className="text-sm font-semibold text-foreground-950">Product variations</h4><p className="mt-1 text-xs text-foreground-600">Stock is tracked separately for every size and color combination.</p></div>
            <button type="button" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, createInventoryVariant()] }))} className="inline-flex min-h-10 items-center rounded-lg border border-primary-300 bg-primary-50 px-3 text-xs font-semibold text-primary-800 hover:bg-primary-100"><i className="ri-add-line mr-1" /> Add variation</button>
          </div>
          <div className="mt-4 space-y-3">
            {form.variants.map((variant, index) => (
              <div key={variant.id} className="rounded-xl border border-background-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Variation {index + 1}</p><button type="button" onClick={() => removeVariant(variant.id)} disabled={form.variants.length === 1} className="rounded-full px-2 py-1 text-xs font-semibold text-accent-700 hover:bg-accent-50 disabled:cursor-not-allowed disabled:opacity-35"><i className="ri-delete-bin-line mr-1" /> Remove</button></div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <FormField label="Size" htmlFor={`variant-size-${variant.id}`} hint="Size or color is required."><Input id={`variant-size-${variant.id}`} value={variant.size} onChange={(event) => updateVariant(variant.id, "size", event.target.value)} placeholder="Small" /></FormField>
                  <FormField label="Color" htmlFor={`variant-color-${variant.id}`}><Input id={`variant-color-${variant.id}`} value={variant.color} onChange={(event) => updateVariant(variant.id, "color", event.target.value)} placeholder="Green" /></FormField>
                  <FormField label="SKU" htmlFor={`variant-sku-${variant.id}`} required><Input id={`variant-sku-${variant.id}`} value={variant.sku} required onChange={(event) => updateVariant(variant.id, "sku", event.target.value)} placeholder="TEE-S-GRN" /></FormField>
                  <FormField label="Price (USD)" htmlFor={`variant-price-${variant.id}`} required><Input id={`variant-price-${variant.id}`} type="number" min="0.01" step="0.01" value={variant.priceDollars} required onChange={(event) => updateVariant(variant.id, "priceDollars", event.target.value)} placeholder="25.00" /></FormField>
                  <FormField label="Stock" htmlFor={`variant-stock-${variant.id}`} required><Input id={`variant-stock-${variant.id}`} type="number" min="0" value={variant.stockQuantity} required onChange={(event) => updateVariant(variant.id, "stockQuantity", event.target.value)} placeholder="10" /></FormField>
                  <FormField label="Low-stock alert" htmlFor={`variant-low-${variant.id}`}><Input id={`variant-low-${variant.id}`} type="number" min="0" value={variant.lowStockThreshold} onChange={(event) => updateVariant(variant.id, "lowStockThreshold", event.target.value)} placeholder="3" /></FormField>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
