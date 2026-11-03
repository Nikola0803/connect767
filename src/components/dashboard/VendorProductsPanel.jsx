import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMyVendorProducts,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  getMyVendorOrders,
  getMyVendorAnalytics,
  updateMyVendorOrder,
} from "../../data/repository";
import Button from "../ui/Button";
import { FormField, Input, Textarea, Select } from "../ui/FormField";
import StorefrontCustomizer from "./StorefrontCustomizer";
import {
  DASHBOARD_EYEBROW,
  DASHBOARD_PANEL,
  DASHBOARD_SECTION_HEADING,
  DASHBOARD_SECTION_SUBTITLE,
} from "./dashboardStyles";

function formatPrice(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

const emptyForm = {
  listingId: "",
  name: "",
  priceDollars: "",
  description: "",
  imageFile: null,
  imagePreview: "",
  fulfillmentMode: "shipping",
  shippingFeeDollars: "0.00",
  pickupInstructions: "",
  sku: "",
  category: "",
  trackStock: false,
  stockQuantity: "",
  lowStockThreshold: "3",
  variantsText: "",
};

function variantsToText(variants = []) {
  return variants.map((item) => [item.label, item.sku, (Number(item.priceCents || 0) / 100).toFixed(2), item.stockQuantity].join(" | ")).join("\n");
}

function parseVariants(text) {
  return String(text || "").split("\n").map((line, index) => {
    const [label = "", sku = "", price = "0", stock = "0"] = line.split("|").map((part) => part.trim());
    return { id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index + 1}`, label, sku, priceCents: Math.max(0, Math.round(Number(price) * 100)), stockQuantity: Math.max(0, Number(stock) || 0) };
  }).filter((item) => item.label);
}

/**
 * Dashboard "Products & Services" + "Sales" — the seller side of the
 * marketplace feature that shows "Buy" cards on a listing's public profile
 * (see ListingProducts.jsx). Every listing tier can add products; ownership
 * is enforced again server-side in class-rest-vendor-products.php.
 *
 * The same form doubles as the "Edit product" form — editingId tracks
 * which existing product (if any) a submit should update, vs. creating a
 * new one. Photos are real uploads (multipart, handled server-side by
 * handle_image_upload() → media_handle_upload()), not a URL text field.
 *
 * "Sales" is read-only, for manual payout bookkeeping — payment goes to
 * this site's own Stripe account (platform-collects model), so the owner
 * needs to see what sold in order to pay each vendor out separately.
 */
export default function VendorProductsPanel({ listings = [], initialListingId = "", initialStorefrontListingId = "", ownerName = "" }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState(initialStorefrontListingId ? "design" : initialListingId ? "products" : "overview");
  const productFormRef = useRef(null);
  const storefrontCandidates = useMemo(
    () => listings.filter((listing) => listing?.sellProducts === true),
    [listings],
  );

  const existingStoreListingId = products.find((product) =>
    storefrontCandidates.some((listing) => String(listing.id) === String(product.listingId)),
  )?.listingId;
  const requestedStoreListingId = initialStorefrontListingId || initialListingId;
  const storefrontListing = storefrontCandidates.find((listing) => String(listing.id) === String(existingStoreListingId))
    || storefrontCandidates.find((listing) => String(listing.id) === String(requestedStoreListingId))
    || storefrontCandidates[0];
  const storefrontListingId = storefrontListing ? String(storefrontListing.id) : "";
  const storefrontListings = storefrontListing ? [storefrontListing] : [];
  const storefrontProducts = products.filter((product) => String(product.listingId) === storefrontListingId);

  const load = () => {
    setLoading(true);
    Promise.all([getMyVendorProducts(), getMyVendorOrders(), getMyVendorAnalytics().catch(() => null)])
      .then(([p, o, stats]) => {
        setProducts(p || []);
        setOrders(o || []);
        setAnalytics(stats || null);
      })
      .catch(() => {
        setProducts([]);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialListingId || !storefrontCandidates.some((listing) => String(listing.id) === String(initialListingId))) {
      return;
    }
    setEditingId(null);
    setForm({ ...emptyForm, listingId: String(initialListingId) });
    setError(null);
    setShowForm(true);
  }, [initialListingId, storefrontCandidates]);

  useEffect(() => {
    if (initialStorefrontListingId) setActiveTab("design");
    else if (initialListingId) setActiveTab("products");
  }, [initialListingId, initialStorefrontListingId]);

  useEffect(() => {
    if (!showForm || editingId || !storefrontListingId) return;
    setForm((current) => ({ ...current, listingId: storefrontListingId }));
  }, [editingId, showForm, storefrontListingId]);

  useEffect(() => {
    if (!showForm) return;
    const frame = window.requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      productFormRef.current?.querySelector("input:not([type='hidden'])")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showForm, editingId]);

  if (storefrontCandidates.length === 0) {
    return null;
  }

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const openAddForm = () => {
    setActiveTab("products");
    setEditingId(null);
    setForm({
      ...emptyForm,
      listingId: storefrontListingId,
    });
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (product) => {
    setActiveTab("products");
    setEditingId(product.id);
    setForm({
      listingId: String(product.listingId),
      name: product.name,
      priceDollars: (Number(product.priceCents || 0) / 100).toFixed(2),
      description: product.description || "",
      imageFile: null,
      imagePreview: product.imageUrl || "",
      fulfillmentMode: product.fulfillmentMode || "shipping",
      shippingFeeDollars: (Number(product.shippingFeeCents || 0) / 100).toFixed(2),
      pickupInstructions: product.pickupInstructions || "",
      sku: product.sku || "",
      category: product.category || "",
      trackStock: product.trackStock === true,
      stockQuantity: product.stockQuantity ?? "",
      lowStockThreshold: product.lowStockThreshold ?? "3",
      variantsText: variantsToText(product.variants),
    });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const priceCents = Math.round(parseFloat(form.priceDollars || "0") * 100);
    const shippingFeeCents = Math.max(0, Math.round(parseFloat(form.shippingFeeDollars || "0") * 100));
    const inventory = {
      sku: form.sku.trim(),
      category: form.category.trim(),
      trackStock: form.trackStock,
      stockQuantity: Math.max(0, Number(form.stockQuantity) || 0),
      lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 3),
      variants: parseVariants(form.variantsText),
    };
    const selectedListing = storefrontCandidates.find((listing) => String(listing.id) === String(form.listingId));
    if (!form.listingId || !form.name.trim() || !priceCents) {
      setError("Pick a listing, add a name, and a price above $0.");
      return;
    }
    if (selectedListing && !selectedListing.payoutConfigured) {
      setError("Add a bank account or digital payout method to this listing before selling products.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateVendorProduct(editingId, {
          name: form.name.trim(),
          priceCents,
          description: form.description.trim(),
          fulfillmentMode: form.fulfillmentMode,
          shippingFeeCents,
          pickupInstructions: form.pickupInstructions.trim(),
          ...inventory,
          ...(form.imageFile ? { imageFile: form.imageFile } : {}),
        });
      } else {
        await createVendorProduct({
          listingId: Number(form.listingId),
          name: form.name.trim(),
          priceCents,
          description: form.description.trim(),
          fulfillmentMode: form.fulfillmentMode,
          shippingFeeCents,
          pickupInstructions: form.pickupInstructions.trim(),
          ...inventory,
          ...(form.imageFile ? { imageFile: form.imageFile } : {}),
        });
      }
      closeForm();
      load();
    } catch {
      setError(editingId ? "Couldn't save those changes — please try again." : "Couldn't add that product — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (product) => {
    setProducts((list) =>
      list.map((p) => (p.id === product.id ? { ...p, active: !p.active } : p))
    );
    try {
      await updateVendorProduct(product.id, { active: !product.active });
    } catch {
      setProducts((list) =>
        list.map((p) => (p.id === product.id ? { ...p, active: product.active } : p))
      );
    }
  };

  const remove = async (product) => {
    const previous = products;
    setProducts((list) => list.filter((p) => p.id !== product.id));
    if (editingId === product.id) closeForm();
    try {
      await deleteVendorProduct(product.id);
    } catch {
      setProducts(previous);
    }
  };

  const updateOrder = async (id, changes) => {
    const previous = orders;
    setOrders((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
    try {
      await updateMyVendorOrder(id, changes);
    } catch {
      setOrders(previous);
    }
  };

  return (
    <>
      <SellerCenterSummary
        ownerName={ownerName}
        listings={listings}
        products={storefrontProducts}
        orders={orders}
        analytics={analytics}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "overview" && (
        <div className="mt-8">
          {analytics && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Store visits", analytics.storeViews, "ri-eye-line"],
                ["Product views", analytics.productViews, "ri-bar-chart-line"],
                ["Paid orders", analytics.orders, "ri-shopping-bag-3-line"],
                ["Your payouts", formatPrice(analytics.payoutsCents), "ri-wallet-3-line"],
              ].map(([label, value, icon], index) => (
                <div key={label} className={`${DASHBOARD_PANEL} p-4 ${[
                  "border-t-4 border-t-primary-500 bg-gradient-to-br from-primary-50 to-background-50",
                  "border-t-4 border-t-secondary-400 bg-gradient-to-br from-secondary-50 to-background-50",
                  "border-t-4 border-t-primary-400 bg-gradient-to-br from-primary-50 to-background-50",
                  "border-t-4 border-t-primary-300 bg-gradient-to-br from-background-100 to-background-50",
                ][index]}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${[
                    "bg-primary-100 text-primary-800",
                    "bg-secondary-100 text-secondary-800",
                    "bg-primary-100 text-primary-800",
                    "bg-background-200 text-foreground-700",
                  ][index]}`}><i className={`${icon} text-lg`} /></span>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-foreground-950">{value}</p>
                  <p className="mt-1 text-xs font-medium text-foreground-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "readiness" && (
        <div className="mt-8">
          <SellerReadiness listings={storefrontListings} products={storefrontProducts} />
        </div>
      )}

      {activeTab === "design" && (
        <div id="store-settings" className="mt-8 scroll-mt-24">
          <StorefrontCustomizer
            listings={storefrontListings}
            products={storefrontProducts}
            initialListingId={storefrontListingId}
            mode="design"
          />
        </div>
      )}

      {activeTab === "products" && <>

      <div id="products-services" className="mb-5 mt-12 flex scroll-mt-24 items-end justify-between gap-4">
        <div>
          <p className={DASHBOARD_EYEBROW}>Catalog</p>
          <h2 className={DASHBOARD_SECTION_HEADING}>Products &amp; services</h2>
        </div>
        <Button variant="outline" size="sm" onClick={openAddForm} icon="ri-add-line">
          List a product
        </Button>
      </div>

      <p className={`${DASHBOARD_SECTION_SUBTITLE} mb-5`}>
        Sell directly from your Connect767 storefront — customers pay by card or PayPal,
        then shipping and pickup details appear in "Sales" below.
      </p>

      <div className="mb-5 rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-3 text-xs leading-relaxed text-foreground-700 font-label">
        <strong className="text-primary-900">Storefront transaction fee:</strong>{" "}
        Connect767 retains 10% of each product price. Shipping charges are passed through to you in full,
        and your payout is recorded automatically after payment.
      </div>

      {showForm && (
        <form
          ref={productFormRef}
          id="product-editor"
          onSubmit={handleSubmit}
          className="mb-6 scroll-mt-24 p-5 rounded-2xl border border-background-200/70 bg-background-100/40 space-y-4"
        >
          <div className="rounded-xl border border-background-200 bg-background-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Product details</p>
            <p className="mt-1 text-sm text-foreground-600">This product will appear in your one Connect767 storefront{storefrontListing?.title ? `, ${storefrontListing.title}` : ""}.</p>
          </div>
          {form.listingId && !storefrontListing?.payoutConfigured && (
            <p className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700 font-label">
              Open the Payouts tab and add a bank account or digital payout method before publishing products for sale.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" htmlFor="vp-name">
              <Input id="vp-name" value={form.name} onChange={update("name")} placeholder="e.g. Consultation session" />
            </FormField>
            <FormField label="Price (USD)" htmlFor="vp-price">
              <Input
                id="vp-price"
                type="number"
                min="0"
                step="0.01"
                value={form.priceDollars}
                onChange={update("priceDollars")}
                placeholder="25.00"
              />
            </FormField>
          </div>
          <FormField label="Description (optional)" htmlFor="vp-description">
            <Textarea id="vp-description" rows={2} value={form.description} onChange={update("description")} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="SKU" htmlFor="vp-sku" hint="Your internal product code.">
              <Input id="vp-sku" value={form.sku} onChange={update("sku")} placeholder="C767-001" />
            </FormField>
            <FormField label="Product category" htmlFor="vp-category">
              <Input id="vp-category" value={form.category} onChange={update("category")} placeholder="e.g. Clothing, Food, Art" />
            </FormField>
          </div>
          <div className="rounded-xl border border-background-200 bg-background-50 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-foreground-800">
              <input type="checkbox" checked={form.trackStock} onChange={(event) => setForm((value) => ({ ...value, trackStock: event.target.checked }))} />
              Track inventory and prevent overselling
            </label>
            {form.trackStock && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <FormField label="Stock quantity" htmlFor="vp-stock"><Input id="vp-stock" type="number" min="0" value={form.stockQuantity} onChange={update("stockQuantity")} /></FormField>
                <FormField label="Low-stock warning" htmlFor="vp-low-stock"><Input id="vp-low-stock" type="number" min="0" value={form.lowStockThreshold} onChange={update("lowStockThreshold")} /></FormField>
              </div>
            )}
          </div>
          <FormField label="Product options / variations" htmlFor="vp-variants" hint="One option per line: Label | SKU | Price | Stock. Example: Large / Blue | TEE-L-BLU | 25.00 | 8">
            <Textarea id="vp-variants" rows={4} value={form.variantsText} onChange={update("variantsText")} placeholder="Small / Green | SHIRT-S-GRN | 20.00 | 5" />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Fulfillment" htmlFor="vp-fulfillment" required>
              <Select id="vp-fulfillment" value={form.fulfillmentMode} onChange={update("fulfillmentMode")}>
                <option value="none">No delivery required / service</option>
                <option value="shipping">Shipping only</option>
                <option value="pickup">Local pickup only</option>
                <option value="both">Shipping or local pickup</option>
              </Select>
            </FormField>
            {form.fulfillmentMode !== "pickup" && form.fulfillmentMode !== "none" && (
              <FormField label="Flat shipping fee (USD)" htmlFor="vp-shipping-fee" hint="Enter 0 for free shipping.">
                <Input
                  id="vp-shipping-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shippingFeeDollars}
                  onChange={update("shippingFeeDollars")}
                />
              </FormField>
            )}
          </div>
          {form.fulfillmentMode !== "shipping" && form.fulfillmentMode !== "none" && (
            <FormField
              label="Pickup location & instructions"
              htmlFor="vp-pickup-instructions"
              hint="Share the pickup area, available times, and how the buyer should arrange collection."
            >
              <Textarea
                id="vp-pickup-instructions"
                rows={3}
                value={form.pickupInstructions}
                onChange={update("pickupInstructions")}
                placeholder="Example: Roseau. Pickup Monday–Friday, 9 AM–5 PM. We will email the exact address after payment."
              />
            </FormField>
          )}
          <FormField label="Photo (optional)" htmlFor="vp-image">
            <div className="flex items-center gap-4">
              {form.imagePreview && (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-background-200/70 flex-shrink-0">
                  <img src={form.imagePreview} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <label
                htmlFor="vp-image"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-background-300 text-sm font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-upload-2-line" />
                {form.imagePreview ? "Replace photo" : "Upload photo"}
              </label>
              <input
                id="vp-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </FormField>
          {error && <p className="text-sm text-accent-600 font-label">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </Button>
            <button
              type="button"
              onClick={closeForm}
              className="px-3 py-1.5 text-xs font-semibold text-foreground-600 hover:text-foreground-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!loading && storefrontProducts.length === 0 && (
        <p className="text-sm text-foreground-500 font-label mb-10">
          No products yet — add one to start selling from your listing page.
        </p>
      )}

      {storefrontProducts.length > 0 && (
        <div id="product-list" className="scroll-mt-24 space-y-3 mb-10">
          {storefrontProducts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-xl border border-background-200/70 bg-background-50 p-4 sm:p-5"
            >
              {p.imageUrl && (
                <div className="w-14 h-14 rounded-lg overflow-hidden border border-background-200/70 flex-shrink-0">
                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-heading text-base font-medium text-foreground-950 truncate">
                    {p.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      p.active ? "bg-primary-100 text-primary-800" : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    {p.active ? "Active" : "Hidden"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground-700 font-label">
                  <span>{formatPrice(p.priceCents)}</span>
                  <span className="text-foreground-500">
                    {p.fulfillmentMode === "none"
                      ? "No delivery required"
                      : p.fulfillmentMode === "pickup"
                      ? "Local pickup"
                      : p.fulfillmentMode === "both"
                        ? `Shipping (${formatPrice(p.shippingFeeCents)}) or pickup`
                        : `Shipping ${p.shippingFeeCents ? formatPrice(p.shippingFeeCents) : "free"}`}
                  </span>
                  {p.sku && <span className="text-foreground-500">SKU {p.sku}</span>}
                  {p.trackStock && (
                    <span className={p.stockStatus === "sold_out" ? "font-semibold text-accent-600" : p.stockStatus === "low_stock" ? "font-semibold text-amber-700" : "text-foreground-500"}>
                      {p.stockQuantity} in stock{p.stockStatus === "low_stock" ? " · Low stock" : ""}
                    </span>
                  )}
                  {p.variants?.length > 0 && <span className="text-foreground-500">{p.variants.length} options</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEditForm(p)}
                  className="px-3 py-1.5 rounded-md border border-background-300 text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(p)}
                  className="px-3 py-1.5 rounded-md border border-background-300 text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  {p.active ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="px-3 py-1.5 rounded-md border border-background-300 text-xs font-semibold text-accent-600 hover:bg-accent-50 cursor-pointer whitespace-nowrap"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      </>}

      {activeTab === "payouts" && <>
      <div id="store-payouts" className="mt-8 scroll-mt-24">
        <StorefrontCustomizer
          listings={storefrontListings}
          products={storefrontProducts}
          initialListingId={storefrontListingId}
          mode="payouts"
        />
      </div>

      <div className="mb-5">
        <p className={DASHBOARD_EYEBROW}>Transactions</p>
        <h2 id="seller-orders" className={`scroll-mt-24 ${DASHBOARD_SECTION_HEADING}`}>Orders &amp; sales</h2>
        <p className={DASHBOARD_SECTION_SUBTITLE}>Review purchases, fulfillment progress, and storefront payouts.</p>
      </div>

      {!loading && orders.length === 0 && (
        <p className="text-sm text-foreground-500 font-label">
          No sales yet. Paid orders show up here so you can fulfill them and pay yourself out.
        </p>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 rounded-xl border border-background-200/70 bg-background-50 p-4 sm:p-5"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-base font-medium text-foreground-950">
                  {o.productName}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-600 font-label mt-1">
                  <span>{o.buyerName}</span>
                  <span>{o.buyerEmail}</span>
                  <span className="font-semibold text-primary-700">
                    {o.fulfillmentMethod === "pickup"
                      ? "Local pickup"
                      : o.fulfillmentMethod === "shipping"
                        ? "Ship order"
                        : "No delivery required"}
                  </span>
                </div>
                {o.fulfillmentMethod === "shipping" && o.shippingAddress && (
                  <p className="mt-2 text-xs leading-relaxed text-foreground-600 font-label">
                    {[o.shippingAddress.address1, o.shippingAddress.address2, o.shippingAddress.city, o.shippingAddress.region, o.shippingAddress.postcode, o.shippingAddress.country]
                      .filter(Boolean)
                      .join(", ")}
                    {o.shippingAddress.phone ? ` · ${o.shippingAddress.phone}` : ""}
                  </p>
                )}
                {o.fulfillmentMethod === "pickup" && o.pickupInstructions && (
                  <p className="mt-2 text-xs leading-relaxed text-foreground-600 font-label">
                    {o.pickupInstructions}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-right font-label text-xs text-foreground-600">
                <p>Customer total <strong className="text-foreground-950">{formatPrice(o.amountCents)}</strong></p>
                <p>Connect767 fee ({o.platformFeePercent || 10}%) <strong className="text-foreground-950">−{formatPrice(o.platformFeeAmountCents)}</strong></p>
                <p className="mt-1 text-sm text-primary-800">Your payout <strong>{formatPrice(o.ownerPayoutAmountCents)}</strong></p>
                <p className="mt-1 capitalize text-foreground-500">Payout {o.ownerPayoutStatus || "pending"}</p>
                <div className="mt-3 space-y-2 text-left">
                  <Select aria-label={`Fulfillment status for ${o.productName}`} value={o.fulfillmentStatus || "new"} onChange={(event) => updateOrder(o.id, { fulfillmentStatus: event.target.value })} className="py-2 text-xs">
                    <option value="new">New order</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="ready_for_pickup">Ready for pickup</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                  {o.fulfillmentMethod === "shipping" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input aria-label={`Shipping carrier for ${o.productName}`} defaultValue={o.shippingCarrier || ""} placeholder="Carrier" className="py-2 text-xs" onBlur={(event) => updateOrder(o.id, { shippingCarrier: event.target.value })} />
                      <Input aria-label={`Tracking number for ${o.productName}`} defaultValue={o.trackingNumber || ""} placeholder="Tracking #" className="py-2 text-xs" onBlur={(event) => updateOrder(o.id, { trackingNumber: event.target.value })} />
                    </div>
                  )}
                  <button type="button" disabled={o.refundStatus === "requested"} onClick={() => updateOrder(o.id, { requestRefund: true, refundStatus: "requested" })} className="text-[11px] font-semibold text-accent-600 disabled:text-foreground-400">
                    {o.refundStatus === "requested" ? "Refund requested" : "Request refund / cancellation"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </>
  );
}

function SellerCenterSummary({ ownerName, products, orders, analytics, activeTab, onTabChange }) {
  const activeProducts = products.filter((product) => product.active).length;
  const openOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.fulfillmentStatus)).length;
  const grossSales = orders.reduce((total, order) => total + Number(order.amountCents || 0), 0);
  const tabs = [
    ["overview", "Store Front Overview", "ri-store-2-line"],
    ["products", "Products", "ri-box-3-line"],
    ["design", "Edit Storefront", "ri-edit-line"],
    ["readiness", "Store Readiness", "ri-checkbox-circle-line"],
    ["payouts", "Payouts", "ri-wallet-3-line"],
  ];
  const metrics = [
    ["ri-box-3-line", activeProducts, "Active Products"],
    ["ri-shopping-bag-3-line", openOrders, "Open Orders"],
    ["ri-eye-line", analytics?.storeViews ?? 0, "Store Visits"],
    ["ri-wallet-3-line", formatPrice(grossSales), "Gross Sales"],
  ];
  const metricStyles = [
    { panel: "bg-gradient-to-br from-primary-50 to-background-50", icon: "bg-primary-100 text-primary-800" },
    { panel: "bg-gradient-to-br from-secondary-50 to-background-50", icon: "bg-secondary-100 text-secondary-800" },
    { panel: "bg-gradient-to-br from-primary-50 to-background-50", icon: "bg-primary-100 text-primary-800" },
    { panel: "bg-gradient-to-br from-background-100 to-background-50", icon: "bg-background-200 text-foreground-700" },
  ];

  return (
    <section className={`${DASHBOARD_PANEL} mt-8 overflow-hidden border-secondary-200 shadow-[0_22px_60px_rgba(83,55,35,0.1)]`}>
      <div className="flex items-start justify-between gap-4 border-b border-secondary-200 bg-gradient-to-r from-secondary-100/80 via-background-50 to-primary-50/80 px-5 py-6 sm:px-7">
        <div>
          <p className={DASHBOARD_EYEBROW}>Seller workspace</p>
          <h2 className={DASHBOARD_SECTION_HEADING}>Storefront overview</h2>
          <p className={DASHBOARD_SECTION_SUBTITLE}>{ownerName ? `Welcome back, ${ownerName}` : "Manage your business and storefront in one place."}</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary-200 bg-primary-100 text-xl text-primary-800 shadow-sm"><i className="ri-store-2-line" /></span>
      </div>

      <div className="grid grid-cols-2 border-b border-secondary-200 sm:grid-cols-4">
        {metrics.map(([icon, value, label], index) => (
          <div key={label} className={`px-5 py-6 sm:px-6 ${metricStyles[index].panel} ${index % 2 ? "border-l border-secondary-200" : ""} ${index > 1 ? "border-t border-secondary-200 sm:border-t-0 sm:border-l" : ""}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${metricStyles[index].icon}`}><i className={`${icon} text-lg`} /></span>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground-950">{value}</p>
            <p className="mt-1 text-xs font-medium text-foreground-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border-t border-secondary-200 bg-background-50/80 px-4 py-4 sm:px-7" role="tablist" aria-label="Storefront management">
        <div className="flex min-w-max items-center gap-2">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => onTabChange(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${activeTab === id ? "bg-primary-600 text-white shadow-[0_8px_20px_rgba(31,112,78,0.22)]" : "border border-transparent text-foreground-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-900"}`}
            >
              <i className={icon} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SellerReadiness({ listings, products }) {
  const listing = listings[0];
  const ownProducts = listing ? products.filter((product) => String(product.listingId) === String(listing.id)) : [];
  const steps = [
    ["Payout method connected", Boolean(listing?.payoutConfigured)],
    ["Store design published", Boolean(listing?.storefrontConfigured)],
    ["At least one active product", ownProducts.some((product) => product.active)],
    ["Shipping or pickup configured", ownProducts.some((product) => product.fulfillmentMode && product.fulfillmentMode !== "none")],
    ["Inventory ready", ownProducts.some((product) => !product.trackStock || Number(product.stockQuantity) > 0 || product.variants?.some((variant) => Number(variant.stockQuantity) > 0))],
  ];
  const complete = steps.filter(([, done]) => done).length;
  return (
    <section className={`${DASHBOARD_PANEL} border-secondary-200 bg-gradient-to-r from-background-50 via-secondary-50/50 to-primary-50/60 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className={DASHBOARD_EYEBROW}>Store readiness</p><h3 className="mt-1 text-base font-semibold text-foreground-950">{complete} of {steps.length} steps complete</h3></div>
        <div className="h-2 w-36 overflow-hidden rounded-full bg-secondary-200"><div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700" style={{ width: `${complete / steps.length * 100}%` }} /></div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(([label, done]) => <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${done ? "border-primary-200 bg-primary-50 text-primary-900" : "border-background-200 bg-background-50/80 text-foreground-500"}`}><i className={done ? "ri-checkbox-circle-fill text-primary-600" : "ri-checkbox-blank-circle-line"} /><span>{label}</span></div>)}
      </div>
    </section>
  );
}
