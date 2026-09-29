import { useEffect, useRef, useState } from "react";
import { loadPaypalSdk } from "../lib/paypalClient";

/**
 * Generic PayPal Smart Button — extracted from CheckoutPage.jsx so the
 * Classified listing fee (AddListingPage.jsx) and the vendor marketplace
 * "Buy" flow (ListingProducts.jsx) can offer PayPal too, instead of it only
 * existing on the Shop checkout. Callers supply `createOrder`/`captureOrder`
 * instead of this component knowing anything about carts, listings, or
 * vendor products specifically.
 *
 * `createOrder()` must resolve to `{ orderId, paypalOrderId }` — `orderId`
 * is whatever local id (WooCommerce order / listing id / vendor_order id)
 * the caller needs to pass to `captureOrder()` once PayPal approves.
 * `captureOrder(orderId)` must resolve to `{ status }`, mirroring every
 * other payment path in this app: never trust the SDK's own `onApprove`
 * firing as proof of payment, always ask the server (which itself asks
 * PayPal directly) whether the capture actually completed.
 */
export default function PaypalButton({ clientId, disabled, createOrder, captureOrder, onSuccess, onError }) {
  const containerRef = useRef(null);
  const [sdkError, setSdkError] = useState(null);

  const stateRef = useRef({ createOrder, captureOrder, onSuccess, onError });
  stateRef.current = { createOrder, captureOrder, onSuccess, onError };
  // See CheckoutPage.jsx's original PaypalButton for why this flag exists —
  // without it, a specific error from createOrder() gets clobbered by the
  // SDK's own generic onError a moment later.
  const reportedSpecificErrorRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadPaypalSdk(clientId)
      .then((paypal) => {
        if (cancelled || !containerRef.current || !paypal?.Buttons) return;
        containerRef.current.innerHTML = "";

        paypal
          .Buttons({
            style: { layout: "vertical", label: "paypal", height: 48 },
            createOrder: async () => {
              try {
                const { orderId, paypalOrderId } = await stateRef.current.createOrder();
                containerRef.current.dataset.localOrderId = orderId;
                return paypalOrderId;
              } catch (err) {
                reportedSpecificErrorRef.current = true;
                stateRef.current.onError(
                  err.message || "Couldn't start PayPal checkout — please try again."
                );
                throw err;
              }
            },
            onApprove: async () => {
              const localOrderId = containerRef.current?.dataset.localOrderId;
              const { onSuccess: currentOnSuccess, onError: currentOnError } = stateRef.current;
              try {
                const result = await stateRef.current.captureOrder(localOrderId);
                if (result.status === "paid") {
                  currentOnSuccess(localOrderId);
                } else {
                  currentOnError("Payment is still processing — check your email for confirmation shortly.");
                }
              } catch {
                currentOnError("Payment went through, but we couldn't confirm it immediately. Check your email.");
              }
            },
            onError: () => {
              if (reportedSpecificErrorRef.current) {
                reportedSpecificErrorRef.current = false;
                return;
              }
              stateRef.current.onError("PayPal checkout failed. Please try again.");
            },
          })
          .render(containerRef.current);
      })
      .catch(() => {
        if (!cancelled) setSdkError("Couldn't load PayPal. Please try again shortly.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (sdkError) {
    return <p className="text-sm text-accent-600 font-label">{sdkError}</p>;
  }

  return <div ref={containerRef} aria-disabled={disabled} className={disabled ? "opacity-60 pointer-events-none" : ""} />;
}
