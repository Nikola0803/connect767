import { useEffect, useMemo, useState } from "react";
import { getMyStorefrontSettings, updateMyStorefrontSettings } from "../../data/repository";
import Button from "../ui/Button";
import { FormField, Input, Textarea } from "../ui/FormField";
import PayoutSettingsFields from "../PayoutSettingsFields";
import {
  DASHBOARD_EYEBROW,
  DASHBOARD_SECTION_HEADING,
  DASHBOARD_SECTION_SUBTITLE,
} from "./dashboardStyles";

const empty = {
  headline: "",
  welcomeText: "",
  accentColor: "#0f6b4f",
  aboutText: "",
  shippingMessage: "",
  policies: "",
  productGrid: "auto",
  imageRatio: "square",
  cardCorners: "rounded",
  contentWidth: "standard",
  defaultTab: "products",
  featuredProductIds: [],
  productOrder: [],
  bookingPayoutMethod: "",
  bookingPayoutAccountName: "",
  bookingPayoutBankName: "",
  bookingPayoutBankCountry: "Dominica",
  bookingPayoutAccountNumber: "",
  bookingPayoutRoutingNumber: "",
  bookingPayoutSwiftCode: "",
  bookingPayoutDigitalProvider: "",
  bookingPayoutDigitalAccount: "",
};

export default function StorefrontCustomizer({ listings, products, initialListingId = "", mode = "design" }) {
  const [listingId, setListingId] = useState(() => String(initialListingId || ""));
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewKey, setPreviewKey] = useState("");
  const [message, setMessage] = useState("");

  const listing = listings.find((item) => String(item.id) === String(listingId));
  const listingProducts = useMemo(() => {
    const own = products.filter((item) => String(item.listingId) === String(listingId));
    const order = form.productOrder || [];
    return [...own].sort((a, b) => {
      const ai = order.indexOf(Number(a.id));
      const bi = order.indexOf(Number(b.id));
      return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi);
    });
  }, [products, listingId, form.productOrder]);

  useEffect(() => {
    if (initialListingId && listings.some((item) => String(item.id) === String(initialListingId))) {
      setListingId(String(initialListingId));
      return;
    }
    if (listings.length === 1) setListingId(String(listings[0].id));
  }, [initialListingId, listings]);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    setMessage("");
    getMyStorefrontSettings(listingId)
      .then((settings) => setForm({ ...empty, ...(settings || {}) }))
      .catch(() => setMessage("Couldn't load this storefront's design."))
      .finally(() => setLoading(false));
  }, [listingId]);

  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const updateValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleFeatured = (id) => setForm((value) => ({
    ...value,
    featuredProductIds: value.featuredProductIds.includes(Number(id))
      ? value.featuredProductIds.filter((item) => item !== Number(id))
      : [...value.featuredProductIds, Number(id)],
  }));
  const move = (id, direction) => setForm((value) => {
    const base = listingProducts.map((item) => Number(item.id));
    const index = base.indexOf(Number(id));
    const target = index + direction;
    if (target < 0 || target >= base.length) return value;
    [base[index], base[target]] = [base[target], base[index]];
    return { ...value, productOrder: base };
  });

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const saved = await updateMyStorefrontSettings(listingId, form);
      // Preserve submitted layout values when an older plugin response omits
      // newly-added storefront fields. The next settings load will still use
      // the server as the source of truth.
      setForm((current) => ({ ...empty, ...current, ...(saved || {}) }));
      setMessage(mode === "payouts" ? "Payout settings saved." : "Storefront design published.");
      setPreview(false);
    } catch {
      setMessage("Couldn't publish the storefront design. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showPreview = () => {
    if (!listing?.slug) {
      setMessage("Save the directory listing before previewing its storefront.");
      return;
    }
    const nextPreviewKey = `${listing.slug}:${Date.now()}`;
    const payload = JSON.stringify({
      listingId: listing.id,
      listing,
      products: listingProducts,
      settings: form,
      createdAt: Date.now(),
    });
    // localStorage makes the draft available to both the embedded preview and
    // "Open full screen". Keep the legacy session key for older preview URLs.
    window.localStorage.setItem(`connect767-storefront-preview:${nextPreviewKey}`, payload);
    window.sessionStorage.setItem(`connect767-storefront-preview:${listing.slug}`, payload);
    setPreviewKey(nextPreviewKey);
    setPreview(true);
    setPreviewRevision((value) => value + 1);
    setMessage("");
  };

  return (
    <section className="mb-10 rounded-2xl border border-background-200 bg-background-50 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={DASHBOARD_EYEBROW}>{mode === "payouts" ? "Store finances" : "Store design"}</p>
          <h2 className={DASHBOARD_SECTION_HEADING}>{mode === "payouts" ? "Payout settings" : "Customize storefront"}</h2>
          <p className={DASHBOARD_SECTION_SUBTITLE}>{mode === "payouts" ? "Choose where proceeds from storefront sales should be sent." : "Preview every change before publishing it to customers."}</p>
        </div>
        {listing && <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-800"><i className="ri-store-2-line" />{listing.title}</span>}
      </div>

      {listingId && !loading && (
        <div className="mt-6 space-y-5">
          {mode === "design" && <>
          <FormField label="Brand color" htmlFor="store-color"><Input id="store-color" type="color" value={form.accentColor} onChange={update("accentColor")} className="h-11 sm:max-w-xs" /></FormField>
          <FormField label="Storefront text" htmlFor="store-welcome" hint="Shown in the Storefront section of your store."><Textarea id="store-welcome" rows={2} maxLength={240} value={form.welcomeText} onChange={update("welcomeText")} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Shipping & pickup message" htmlFor="store-shipping"><Textarea id="store-shipping" rows={3} maxLength={500} value={form.shippingMessage} onChange={update("shippingMessage")} /></FormField>
            <FormField label="Store policies" htmlFor="store-policies" hint="Returns, exchanges, processing time, and other terms."><Textarea id="store-policies" rows={3} maxLength={1000} value={form.policies} onChange={update("policies")} /></FormField>
          </div>

          <div className="rounded-2xl border border-background-200 bg-background-100/45 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground-900">Store layout</h3>
            <p className="mt-1 text-xs text-foreground-500">Choose how the public storefront presents products and content on desktop and mobile.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField label="Product columns" value={form.productGrid} onChange={update("productGrid")} options={[["auto", "Responsive (recommended)"], ["3", "Three columns"], ["4", "Four columns"]]} />
              <SelectField label="Product image shape" value={form.imageRatio} onChange={update("imageRatio")} options={[["square", "Square"], ["portrait", "Portrait"], ["landscape", "Landscape"]]} />
              <SelectField label="Card corners" value={form.cardCorners} onChange={update("cardCorners")} options={[["rounded", "Rounded"], ["soft", "Soft"], ["square", "Square"]]} />
              <SelectField label="Page width" value={form.contentWidth} onChange={update("contentWidth")} options={[["standard", "Standard"], ["wide", "Wide"]]} />
              <SelectField label="First tab visitors see" value={form.defaultTab} onChange={update("defaultTab")} options={[["products", "Products"], ["overview", "Overview"]]} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground-900">Featured products & display order</h3>
            <p className="mt-1 text-xs text-foreground-500">Choose featured items and use the arrows to arrange the storefront.</p>
            <div className="mt-3 space-y-2">
              {listingProducts.length === 0 && <p className="text-xs text-foreground-500">Add products to this listing first.</p>}
              {listingProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3 rounded-xl border border-background-200 px-3 py-2.5">
                  <input type="checkbox" aria-label={`Feature ${product.name}`} checked={form.featuredProductIds.includes(Number(product.id))} onChange={() => toggleFeatured(product.id)} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground-800">{product.name}</span>
                  <button type="button" aria-label={`Move ${product.name} up`} disabled={index === 0} onClick={() => move(product.id, -1)} className="disabled:opacity-30"><i className="ri-arrow-up-line" /></button>
                  <button type="button" aria-label={`Move ${product.name} down`} disabled={index === listingProducts.length - 1} onClick={() => move(product.id, 1)} className="disabled:opacity-30"><i className="ri-arrow-down-line" /></button>
                </div>
              ))}
            </div>
          </div>

          {preview && (
            <div className="overflow-hidden rounded-2xl border border-background-300 bg-background-50 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 bg-background-100/70 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-foreground-900">Full customer storefront preview</p>
                  <p className="text-[11px] text-foreground-500">This is the same page customers will see. Checkout remains disabled in preview mode.</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/listings/${listing.slug}/shop?designPreview=1&previewKey=${encodeURIComponent(previewKey)}&revision=${previewRevision}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-background-300 px-3 text-xs font-semibold text-foreground-800">Open full screen <i className="ri-external-link-line" /></a>
                  <button type="button" onClick={() => setPreview(false)} className="inline-flex h-9 items-center rounded-full border border-background-300 px-3 text-xs font-semibold text-foreground-700">Close</button>
                </div>
              </div>
              <iframe
                key={previewRevision}
                title="Full storefront preview"
                src={`/listings/${listing.slug}/shop?designPreview=1&previewKey=${encodeURIComponent(previewKey)}&revision=${previewRevision}`}
                className="h-[820px] w-full bg-background-50"
              />
            </div>
          )}
          </>}
          {mode === "payouts" && (
            <PayoutSettingsFields
              form={form}
              onChange={updateValue}
              forceVisible
              context="storefront"
            />
          )}
          {message && <p className={`text-sm ${message.includes("published") || message.includes("saved") ? "text-primary-700" : "text-accent-600"}`}>{message}</p>}
          <div className="flex flex-wrap gap-3">
            {mode === "design" && <Button type="button" variant="outline" onClick={showPreview}>{preview ? "Refresh full preview" : "Preview changes"}</Button>}
            <Button type="button" variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : mode === "payouts" ? "Save payout settings" : "Save & publish"}</Button>
          </div>
        </div>
      )}
      {loading && <p className="mt-5 text-sm text-foreground-500">Loading storefront design…</p>}
    </section>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block text-xs font-semibold text-foreground-800">
      {label}
      <select value={value} onChange={onChange} className="mt-2 h-11 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm font-medium text-foreground-800 outline-none focus:border-primary-400">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}
