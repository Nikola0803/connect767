import { loadStripe } from "@stripe/stripe-js";

/**
 * Single shared Stripe.js instance for the whole app. Stripe's own docs
 * recommend calling loadStripe() exactly once and reusing the resulting
 * promise — every checkout-like flow (Shop checkout, Classified listing
 * payment) should share this rather than each maintaining its own copy.
 * Keyed by publishable key so it still behaves correctly if that ever
 * changes at runtime (e.g. switching from a test to a live key).
 */
let stripePromise = null;
let loadedKey = null;

export function getStripe(publishableKey) {
  if (!stripePromise || loadedKey !== publishableKey) {
    stripePromise = loadStripe(publishableKey);
    loadedKey = publishableKey;
  }
  return stripePromise;
}
