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
      setForm({ ...empty, ...saved });
      setMessage(mode === "payouts" ? "Payout settings saved." : "Storefront design published.");
      setPreview(false);
    } catch {
      setMessage("Couldn't publish the storefront design. Please try again.");
    } finally {
      setSaving(false);
    }
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

          {preview && <StorefrontPreview listing={listing} form={form} products={listingProducts} />}
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
            {mode === "design" && <Button type="button" variant="outline" onClick={() => setPreview((value) => !value)}>{preview ? "Hide preview" : "Preview changes"}</Button>}
            <Button type="button" variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : mode === "payouts" ? "Save payout settings" : "Save & publish"}</Button>
          </div>
        </div>
      )}
      {loading && <p className="mt-5 text-sm text-foreground-500">Loading storefront design…</p>}
    </section>
  );
}

function StorefrontPreview({ listing, form, products }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-background-200 bg-background-100/40">
      <div>
        <div className="p-6">
          <span className="text-xs text-foreground-500">{listing?.title}</span>
          <p className="mt-5 whitespace-pre-line text-sm text-foreground-600">{form.welcomeText}</p>
          <span className="mt-5 inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: form.accentColor }}>Browse products</span>
        </div>
      </div>
      <div className="grid gap-3 border-t border-background-200 p-4 sm:grid-cols-3">
        {products.slice(0, 3).map((product) => <div key={product.id} className="rounded-xl bg-background-50 p-3"><p className="truncate text-xs font-semibold">{product.name}</p>{form.featuredProductIds.includes(Number(product.id)) && <span className="mt-2 inline-block text-[10px] font-bold uppercase" style={{ color: form.accentColor }}>Featured</span>}</div>)}
      </div>
      {(form.shippingMessage || form.policies) && (
        <div className="grid gap-4 border-t border-background-200 p-5 text-xs text-foreground-600 sm:grid-cols-3">
          <PreviewText title="Shipping & pickup" text={form.shippingMessage} />
          <PreviewText title="Policies" text={form.policies} />
        </div>
      )}
    </div>
  );
}

function PreviewText({ title, text }) {
  if (!text) return <div />;
  return <div><p className="font-semibold text-foreground-900">{title}</p><p className="mt-1 line-clamp-3 whitespace-pre-line leading-relaxed">{text}</p></div>;
}
