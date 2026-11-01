import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  getListingProducts,
  getCheckoutConfig,
  createVendorProductCheckout,
  confirmVendorOrder,
  createVendorProductPaypalOrder,
  captureVendorProductPaypalOrder,
} from "../data/repository";
import { getStripe } from "../lib/stripeClient";
import PaypalButton from "./PaypalButton";
import Button from "./ui/Button";
import { FormField, Input } from "./ui/FormField";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * "Buy" cards on a Classified listing's public profile — the marketplace
 * feature ("buy things like a multivendor marketplace"). Only ever shows
 * items the owner added from their dashboard's "Products & Services"
 * section and marked active; the backend independently re-checks the
 * listing is actually Classified and the product is active regardless of
 * what this component sends.
 *
 * "Platform collects" payment model: checkout charges this site's own
 * Stripe/PayPal account directly (class-rest-vendor-products.php), the
 * exact same PaymentIntent/order + server-side-confirm pattern already
 * used for Shop checkout and the Classified listing fee. The site owner is
 * responsible for paying vendors out themselves, outside the app.
 */
export default function ListingProducts({
  slug,
  isPreview = false,
  listingTitle = "this listing",
  onAvailabilityChange,
  fullStorefront = false,
  initialProducts = null,
}) {
  const suppliedProducts = Array.isArray(initialProducts) ? initialProducts : null;
  const [products, setProducts] = useState(suppliedProducts || []);
  const [loading, setLoading] = useState(!isPreview && !suppliedProducts);
  const [activeProduct, setActiveProduct] = useState(null);

  useEffect(() => {
    if (isPreview) {
      setLoading(false);
      setProducts([]);
      return;
    }
    if (suppliedProducts) {
      setProducts(suppliedProducts);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getListingProducts(slug)
      .then((data) => {
        if (!cancelled) setProducts(data || []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, isPreview, initialProducts]);

  useEffect(() => {
    onAvailabilityChange?.(!loading && products.length > 0);
    return () => onAvailabilityChange?.(false);
  }, [loading, products.length, onAvailabilityChange]);

  if (isPreview) {
    return null;
  }

  if (loading) {
    return fullStorefront ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" role="status">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="overflow-hidden rounded-2xl border border-background-200 bg-background-50">
            <div className="aspect-[4/3] animate-pulse bg-background-100" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-2/3 animate-pulse rounded bg-background-200" />
              <div className="h-3 w-full animate-pulse rounded bg-background-100" />
              <div className="h-9 w-full animate-pulse rounded-full bg-background-100" />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading storefront products</span>
      </div>
    ) : null;
  }

  if (products.length === 0) return null;

  const visibleProducts = fullStorefront ? products : products.slice(0, 3);

  return (
    <section className={fullStorefront ? "" : "mt-10 border-t border-background-200/70 pt-10"}>
      {!fullStorefront && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">
              Shop this listing
            </p>
            <h2 className="font-heading text-2xl font-light text-foreground-950">
              Products from {listingTitle}
            </h2>
          </div>
          {products.length > 3 && (
            <Link
              to={`/listings/${slug}/shop`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-900"
            >
              View all {products.length} products
              <i className="ri-arrow-right-line" />
            </Link>
          )}
        </div>
      )}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          fullStorefront ? "gap-x-6 gap-y-12 lg:grid-cols-3" : "gap-5 lg:grid-cols-3"
        }`}
      >
        {visibleProducts.map((p) => (
          <article
            key={p.id}
            className={
              fullStorefront
                ? "group flex min-w-0 flex-col"
                : "group flex flex-col overflow-hidden rounded-2xl border border-background-200/70 bg-background-50 transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-[0_18px_50px_rgba(18,63,44,0.12)]"
            }
          >
            <div className={`relative w-full overflow-hidden bg-background-100 ${fullStorefront ? "aspect-[5/4] rounded-[20px]" : "aspect-[4/3]"}`}>
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-100">
                  <i className="ri-shopping-bag-3-line text-4xl text-primary-400" />
                </div>
              )}
              {!fullStorefront && (
                <span className="absolute left-3 top-3 rounded-full bg-background-50/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-800 shadow-sm">
                  Sold by this listing
                </span>
              )}
              {fullStorefront && (
                <button
                  type="button"
                  onClick={() => setActiveProduct(p)}
                  aria-label={`Buy ${p.name}`}
                  className="absolute bottom-4 right-4 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-background-50 text-foreground-950 opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100"
                >
                  <i className="ri-add-line text-lg" />
                </button>
              )}
            </div>
            <div className={`flex flex-1 flex-col ${fullStorefront ? "pt-4" : "p-5"}`}>
              <h3 className={`font-heading font-medium leading-snug text-foreground-950 ${fullStorefront ? "text-base" : "mb-1 text-lg"}`}>
                {p.name}
              </h3>
              {p.description && (
                <p className={`line-clamp-2 flex-1 text-xs leading-relaxed text-foreground-600 font-label ${fullStorefront ? "mt-1.5" : "mb-4"}`}>
                  {p.description}
                </p>
              )}
              <div className={`mt-auto flex items-center justify-between gap-3 ${fullStorefront ? "pt-4" : "border-t border-background-200/70 pt-4"}`}>
                <span className={`font-heading font-semibold text-foreground-950 ${fullStorefront ? "text-base" : "text-lg"}`}>
                  {formatPrice(p.priceCents)}
                </span>
                <Button
                  variant={fullStorefront ? "outline" : "primary"}
                  size="sm"
                  className={fullStorefront ? "rounded-full px-4" : ""}
                  onClick={() => setActiveProduct(p)}
                >
                  {fullStorefront ? "View item" : "Buy now"}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!fullStorefront && products.length <= 3 && (
        <Link
          to={`/listings/${slug}/shop`}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-900"
        >
          Open the complete storefront
          <i className="ri-arrow-right-line" />
        </Link>
      )}

      {activeProduct && (
        <BuyModal product={activeProduct} onClose={() => setActiveProduct(null)} />
      )}
    </section>
  );
}
function BuyModal({ product, onClose }) {
  const [step, setStep] = useState("details"); // details -> choosePayment -> payment -> done
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const startCheckout = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please add your name and email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const config = await getCheckoutConfig();
      if (!config?.stripeEnabled && !config?.paypalEnabled) {
        setError("Payment isn't set up on this site yet — please contact the business directly.");
        setSubmitting(false);
        return;
      }
      setPaymentConfig(config);
      setStep("choosePayment");
    } catch {
      setError("Couldn't start checkout — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startCardPayment = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await createVendorProductCheckout(product.id, {
        name: name.trim(),
        email: email.trim(),
      });
      setClientSecret(result.clientSecret);
      setOrderId(result.orderId);
      setStep("payment");
    } catch {
      setError("Couldn't start card payment — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground-950/50">
      <div className="w-full max-w-md rounded-2xl bg-background-50 p-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-100 cursor-pointer text-foreground-500"
        >
          <i className="ri-close-line" />
        </button>

        <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1">
          {product.name}
        </h3>
        <p className="text-sm text-foreground-600 font-label mb-5">
          {formatPrice(product.priceCents)}
        </p>

        {step === "details" && (
          <form onSubmit={startCheckout} className="space-y-4">
            <FormField label="Your name" htmlFor="buy-name">
              <Input id="buy-name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Email" htmlFor="buy-email">
              <Input
                id="buy-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            {error && <p className="text-sm text-accent-600 font-label">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? "Starting…" : "Continue to payment"}
            </Button>
          </form>
        )}

        {step === "choosePayment" && paymentConfig && (
          <div>
            {error && <p className="text-sm text-accent-600 font-label mb-4">{error}</p>}

            {paymentConfig.stripeEnabled && (
              <Button
                variant="primary"
                className="w-full"
                onClick={startCardPayment}
                disabled={submitting}
              >
                {submitting ? "Starting…" : "Pay with card"}
              </Button>
            )}

            {paymentConfig.stripeEnabled && paymentConfig.paypalEnabled && (
              <div className="flex items-center gap-3 my-4 text-xs text-foreground-500 font-label">
                <span className="flex-1 h-px bg-background-200" />
                or
                <span className="flex-1 h-px bg-background-200" />
              </div>
            )}

            {paymentConfig.paypalEnabled && (
              <PaypalButton
                clientId={paymentConfig.paypalClientId}
                createOrder={async () => {
                  const result = await createVendorProductPaypalOrder(product.id, {
                    name: name.trim(),
                    email: email.trim(),
                  });
                  return { orderId: result.orderId, paypalOrderId: result.paypalOrderId };
                }}
                captureOrder={(id) => captureVendorProductPaypalOrder(id)}
                onSuccess={() => setStep("done")}
                onError={(message) => setError(message)}
              />
            )}
          </div>
        )}

        {step === "payment" && clientSecret && paymentConfig && (
          <Elements stripe={getStripe(paymentConfig.stripePublishableKey)} options={{ clientSecret }}>
            <BuyPaymentForm
              orderId={orderId}
              onSuccess={() => setStep("done")}
            />
          </Elements>
        )}

        {step === "done" && (
          <p className="text-sm text-primary-700 font-label flex items-start gap-2">
            <i className="ri-checkbox-circle-fill mt-0.5 flex-shrink-0" />
            Payment received — a receipt is on its way to {email}.
          </p>
        )}
      </div>
    </div>
  );
}

function BuyPaymentForm({ orderId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await confirmVendorOrder(orderId);
      if (result.status === "paid") {
        onSuccess();
      } else {
        setError("Payment is still processing — check your email for confirmation shortly.");
      }
    } catch {
      setError("Payment went through, but we couldn't confirm it immediately. Check your email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700">
          {error}
        </div>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full mt-5"
        disabled={!stripe || submitting}
      >
        {submitting ? "Processing…" : "Pay & buy"}
      </Button>
    </form>
  );
}
