import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCart } from "../hooks/useCart";
import {
  getCheckoutConfig,
  createPaymentIntent,
  confirmOrder,
  checkout,
  createCartPaypalOrder,
  captureCartPaypalOrder,
} from "../data/repository";
import { isLiveApi } from "../lib/config";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/FormField";
import { Spinner } from "../components/ui/States";
import PaypalButton from "../components/PaypalButton";

let stripePromise = null;
function getStripe(publishableKey) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

export default function CheckoutPage() {
  const { items, clearCart } = useCart();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [email, setEmail] = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fallingBack, setFallingBack] = useState(false);

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  useEffect(() => {
    getCheckoutConfig()
      .then(setConfig)
      .catch(() => setConfig({ stripeEnabled: false, stripePublishableKey: "" }))
      .finally(() => setLoading(false));
  }, []);

  const startEmbeddedCheckout = async () => {
    setError(null);
    try {
      const result = await createPaymentIntent(items, email);
      setClientSecret(result.clientSecret);
      setOrderId(result.orderId);
    } catch (err) {
      setError(err.message || "Couldn't start checkout. Please try again.");
    }
  };

  const useWooCommerceFallback = async () => {
    setFallingBack(true);
    setError(null);
    try {
      const result = await checkout(items, email);
      clearCart();
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err.message || "Couldn't start checkout. Please try again.");
      setFallingBack(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="pt-16 md:pt-20 min-h-[60vh] flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-foreground-600 mb-4">Your cart is empty.</p>
          <Button to="/shop" variant="primary">
            Back to shop
          </Button>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner className="pt-16 md:pt-20 min-h-[60vh]" />;

  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-10 max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl font-light text-foreground-950 mb-6">Checkout</h1>

        <div className="rounded-xl border border-background-200/70 bg-background-50 p-5 mb-6">
          {items.map((item) => (
            <div key={item.key} className="flex justify-between text-sm py-1.5">
              <span className="text-foreground-700">
                {item.title} {item.variationLabel && `(${item.variationLabel})`} × {item.qty}
              </span>
              <span className="font-semibold text-foreground-950">
                ${(item.price * item.qty).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-base font-semibold pt-3 mt-2 border-t border-background-200/70">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-accent-50 border border-accent-200 text-sm text-accent-700">
            {error}
          </div>
        )}

        {!isLiveApi && (
          <p className="text-sm text-foreground-500 font-label mb-4">
            Checkout requires a connected WordPress/WooCommerce backend.
          </p>
        )}

        {!clientSecret ? (
          <>
            <label className="block text-xs font-semibold text-foreground-800 mb-1.5" htmlFor="checkout-email">
              Email
            </label>
            <Input
              id="checkout-email"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-5"
            />

            {config?.stripeEnabled && (
              <Button variant="primary" size="lg" className="w-full" onClick={startEmbeddedCheckout} disabled={!isLiveApi}>
                Continue to payment
              </Button>
            )}

            {config?.stripeEnabled && config?.paypalEnabled && (
              <div className="flex items-center gap-3 my-3 text-xs text-foreground-500 font-label">
                <span className="flex-1 h-px bg-background-200" />
                or
                <span className="flex-1 h-px bg-background-200" />
              </div>
            )}

            {config?.paypalEnabled && (
              <PaypalButton
                clientId={config.paypalClientId}
                disabled={!isLiveApi}
                createOrder={async () => {
                  const result = await createCartPaypalOrder(items, email);
                  return { orderId: result.orderId, paypalOrderId: result.paypalOrderId };
                }}
                captureOrder={(id) => captureCartPaypalOrder(id)}
                onSuccess={(id) => {
                  clearCart();
                  navigate(`/checkout/thank-you?order=${id}`);
                }}
                onError={(message) => setError(message)}
              />
            )}

            {!config?.stripeEnabled && !config?.paypalEnabled && (
              <>
                <p className="text-xs text-foreground-500 font-label mb-3">
                  Card payment isn't set up yet on this site — continuing takes you to
                  WooCommerce's own secure payment page instead.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={useWooCommerceFallback}
                  disabled={!isLiveApi || fallingBack}
                >
                  {fallingBack ? "Redirecting…" : "Continue to payment"}
                </Button>
              </>
            )}
          </>
        ) : (
          <Elements stripe={getStripe(config.stripePublishableKey)} options={{ clientSecret }}>
            <StripePaymentForm orderId={orderId} onSuccess={() => navigate(`/checkout/thank-you?order=${orderId}`)} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function StripePaymentForm({ orderId, onSuccess }) {
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

    // Never trust the client's own belief that payment succeeded —
    // confirmOrder() asks Stripe directly, server-side, before marking
    // the WooCommerce order paid.
    try {
      const result = await confirmOrder(orderId);
      if (result.status === "paid") {
        onSuccess();
      } else {
        setError("Payment is still processing — check your email for confirmation shortly.");
        setSubmitting(false);
      }
    } catch {
      setError("Payment went through, but we couldn't confirm it immediately. Check your email.");
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
        {submitting ? "Processing…" : "Pay now"}
      </Button>
    </form>
  );
}
