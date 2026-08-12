import { useEffect, useState } from "react";
import {
  getMyVendorProducts,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  getMyVendorOrders,
} from "../../data/repository";
import Button from "../ui/Button";
import { FormField, Input, Textarea, Select } from "../ui/FormField";

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
};

/**
 * Dashboard "Products & Services" + "Sales" — the seller side of the
 * marketplace feature that shows "Buy" cards on a Classified listing's
 * public profile (see ListingProducts.jsx). Only listings on the
 * Classified tier can add products — enforced again server-side in
 * class-rest-vendor-products.php regardless of what this form submits.
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
export default function VendorProductsPanel({ classifiedListings }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([getMyVendorProducts(), getMyVendorOrders()])
      .then(([p, o]) => {
        setProducts(p || []);
        setOrders(o || []);
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

  if (classifiedListings.length === 0) {
    return null;
  }

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm((v) => (editingId ? true : !v));
  };

  const openEditForm = (product) => {
    setEditingId(product.id);
    setForm({
      listingId: String(product.listingId),
      name: product.name,
      priceDollars: (Number(product.priceCents || 0) / 100).toFixed(2),
      description: product.description || "",
      imageFile: null,
      imagePreview: product.imageUrl || "",
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
    if (!form.listingId || !form.name.trim() || !priceCents) {
      setError("Pick a listing, add a name, and a price above $0.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateVendorProduct(editingId, {
          name: form.name.trim(),
          priceCents,
          description: form.description.trim(),
          ...(form.imageFile ? { imageFile: form.imageFile } : {}),
        });
      } else {
        await createVendorProduct({
          listingId: Number(form.listingId),
          name: form.name.trim(),
          priceCents,
          description: form.description.trim(),
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

  return (
    <>
      <div className="flex items-center justify-between mb-5 mt-12">
        <h2 className="font-heading text-xl font-medium text-foreground-950">
          Products &amp; services
        </h2>
        <Button variant="outline" size="sm" onClick={openAddForm} icon="ri-add-line">
          Add product
        </Button>
      </div>

      <p className="text-sm text-foreground-600 font-label mb-5">
        Sell directly from your Classified listing's page — customers pay by card, you get
        notified in "Sales" below to fulfill and pay out.
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-5 rounded-2xl border border-background-200/70 bg-background-100/40 space-y-4"
        >
          <FormField label="Listing" htmlFor="vp-listing">
            <Select
              id="vp-listing"
              value={form.listingId}
              onChange={update("listingId")}
              disabled={!!editingId}
            >
              <option value="">Select a Classified listing…</option>
              {classifiedListings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </FormField>
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

      {!loading && products.length === 0 && (
        <p className="text-sm text-foreground-500 font-label mb-10">
          No products yet — add one to start selling from your listing page.
        </p>
      )}

      {products.length > 0 && (
        <div className="space-y-3 mb-10">
          {products.map((p) => (
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
                <span className="text-sm text-foreground-700 font-label">
                  {formatPrice(p.priceCents)}
                </span>
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

      <h2 className="font-heading text-xl font-medium text-foreground-950 mb-5">Sales</h2>

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
                </div>
              </div>
              <span className="font-heading text-base font-semibold text-foreground-950 flex-shrink-0">
                {formatPrice(o.amountCents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
