import { useEffect, useState } from "react";
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
export default function ListingProducts({ slug, isPreview }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(!isPreview);
  const [activeProduct, setActiveProduct] = useState(null);

  useEffect(() => {
    if (isPreview) {
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
  }, [slug, isPreview]);

  if (isPreview || loading || products.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 pt-10 border-t border-background-200/70">
      <h2 className="font-heading text-2xl font-light text-foreground-950 mb-6">
        Buy from {products.length > 0 ? "this business" : ""}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-background-200/70 bg-background-50 overflow-hidden flex flex-col"
          >
            <div className="w-full h-36 bg-background-100 flex items-center justify-center overflow-hidden">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <i className="ri-shopping-bag-3-line text-3xl text-foreground-300" />
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-heading text-base font-medium text-foreground-950 mb-1">
                {p.name}
              </h3>
              {p.description && (
                <p className="text-xs text-foreground-600 font-label mb-3 line-clamp-2 flex-1">
                  {p.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="font-heading text-lg font-semibold text-foreground-950">
                  {formatPrice(p.priceCents)}
                </span>
                <Button variant="primary" size="sm" onClick={() => setActiveProduct(p)}>
                  Buy
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
