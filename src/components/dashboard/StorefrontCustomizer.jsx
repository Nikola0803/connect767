import { useEffect, useMemo, useState } from "react";
import { getMyStorefrontSettings, updateMyStorefrontSettings } from "../../data/repository";
import Button from "../ui/Button";
import { FormField, Input, Select, Textarea } from "../ui/FormField";

const empty = {
  headline: "",
  welcomeText: "",
  accentColor: "#0f6b4f",
  aboutText: "",
  shippingMessage: "",
  policies: "",
  coverUrl: "",
  logoUrl: "",
  coverFile: null,
  logoFile: null,
  featuredProductIds: [],
  productOrder: [],
  stripeConnectAccountId: "",
  connectPayoutEnabled: false,
};

export default function StorefrontCustomizer({ listings, products }) {
  const [listingId, setListingId] = useState("");
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
    if (!listingId) return;
    setLoading(true);
    setMessage("");
    getMyStorefrontSettings(listingId)
      .then((settings) => setForm({ ...empty, ...(settings || {}), coverFile: null, logoFile: null }))
      .catch(() => setMessage("Couldn't load this storefront's design."))
      .finally(() => setLoading(false));
  }, [listingId]);

  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const upload = (key, urlKey) => (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((value) => ({ ...value, [key]: file, [urlKey]: URL.createObjectURL(file) }));
  };
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
      setForm({ ...empty, ...saved, coverFile: null, logoFile: null });
      setMessage("Storefront design published.");
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">Store design</p>
          <h2 className="mt-1 font-heading text-xl font-medium text-foreground-950">Customize storefront</h2>
          <p className="mt-1 text-xs text-foreground-500">Preview every change before publishing it to customers.</p>
        </div>
        <Select aria-label="Choose a storefront" value={listingId} onChange={(event) => setListingId(event.target.value)} className="sm:max-w-xs">
          <option value="">Choose a listing…</option>
          {listings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
      </div>

      {listingId && !loading && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField label="Store logo" id="store-logo" url={form.logoUrl} onChange={upload("logoFile", "logoUrl")} square />
            <ImageField label="Banner cover photo" id="store-cover" url={form.coverUrl} onChange={upload("coverFile", "coverUrl")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Banner headline" htmlFor="store-headline"><Input id="store-headline" maxLength={80} value={form.headline} onChange={update("headline")} /></FormField>
            <FormField label="Brand color" htmlFor="store-color"><Input id="store-color" type="color" value={form.accentColor} onChange={update("accentColor")} className="h-11" /></FormField>
          </div>
          <FormField label="Welcome text" htmlFor="store-welcome" hint="Shown directly below the banner headline."><Textarea id="store-welcome" rows={2} maxLength={240} value={form.welcomeText} onChange={update("welcomeText")} /></FormField>
          <FormField label="About the store" htmlFor="store-about"><Textarea id="store-about" rows={4} maxLength={1200} value={form.aboutText} onChange={update("aboutText")} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Shipping & pickup message" htmlFor="store-shipping"><Textarea id="store-shipping" rows={3} maxLength={500} value={form.shippingMessage} onChange={update("shippingMessage")} /></FormField>
            <FormField label="Store policies" htmlFor="store-policies" hint="Returns, exchanges, processing time, and other terms."><Textarea id="store-policies" rows={3} maxLength={1000} value={form.policies} onChange={update("policies")} /></FormField>
          </div>

          <div className="rounded-xl border border-background-200 bg-background-100/50 p-4">
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${form.connectPayoutEnabled ? "bg-primary-100 text-primary-800" : "bg-background-200 text-foreground-600"}`}><i className="ri-bank-card-line" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground-900">Automated Stripe payouts</h3>
                <p className="mb-3 mt-1 text-xs leading-relaxed text-foreground-500">When Connect767 enables Stripe Connect, 10% is retained automatically and the remaining product total plus shipping is routed to your connected account.</p>
                <FormField label="Stripe Connect account ID" htmlFor="store-connect-account" hint="Optional. It begins with acct_. Connect767 must also enable Stripe Connect before automatic transfers begin.">
                  <Input id="store-connect-account" value={form.stripeConnectAccountId || ""} onChange={update("stripeConnectAccountId")} placeholder="acct_…" />
                </FormField>
              </div>
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

          {preview && <StorefrontPreview listing={listing} form={form} products={listingProducts} />}
          {message && <p className={`text-sm ${message.includes("published") ? "text-primary-700" : "text-accent-600"}`}>{message}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setPreview((value) => !value)}>{preview ? "Hide preview" : "Preview changes"}</Button>
            <Button type="button" variant="primary" onClick={save} disabled={saving}>{saving ? "Publishing…" : "Save & publish"}</Button>
          </div>
        </div>
      )}
      {loading && <p className="mt-5 text-sm text-foreground-500">Loading storefront design…</p>}
    </section>
  );
}

function ImageField({ label, id, url, onChange, square = false }) {
  return <div><p className="mb-2 text-sm font-semibold text-foreground-800">{label}</p><div className={`overflow-hidden rounded-xl border border-background-200 bg-background-100 ${square ? "h-24 w-24" : "h-24 w-full"}`}>{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl text-background-400"><i className="ri-image-add-line" /></div>}</div><label htmlFor={id} className="mt-2 inline-flex cursor-pointer text-xs font-semibold text-primary-700">Upload new image</label><input id={id} type="file" accept="image/*" onChange={onChange} className="hidden" /></div>;
}

function StorefrontPreview({ listing, form, products }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-background-200 bg-background-100/40">
      <div className="grid sm:grid-cols-2">
        <div className="p-6">
          <div className="flex items-center gap-3">
            {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: form.accentColor }}>{listing?.title?.[0]}</span>}
            <span className="text-xs text-foreground-500">{listing?.title}</span>
          </div>
          <h3 className="mt-5 font-heading text-3xl text-foreground-950">{form.headline || `Shop ${listing?.title}`}</h3>
          <p className="mt-3 whitespace-pre-line text-sm text-foreground-600">{form.welcomeText}</p>
          <span className="mt-5 inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: form.accentColor }}>Browse products</span>
        </div>
        <div className="min-h-52 bg-background-200">{form.coverUrl && <img src={form.coverUrl} alt="" className="h-full w-full object-cover" />}</div>
      </div>
      <div className="grid gap-3 border-t border-background-200 p-4 sm:grid-cols-3">
        {products.slice(0, 3).map((product) => <div key={product.id} className="rounded-xl bg-background-50 p-3"><p className="truncate text-xs font-semibold">{product.name}</p>{form.featuredProductIds.includes(Number(product.id)) && <span className="mt-2 inline-block text-[10px] font-bold uppercase" style={{ color: form.accentColor }}>Featured</span>}</div>)}
      </div>
      {(form.aboutText || form.shippingMessage || form.policies) && (
        <div className="grid gap-4 border-t border-background-200 p-5 text-xs text-foreground-600 sm:grid-cols-3">
          <PreviewText title="About" text={form.aboutText} />
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
