/**
 * PayPal's JS SDK is a script tag, not an npm package (unlike Stripe.js) —
 * loading it this way means no new dependency/build step is needed, and it
 * always gets PayPal's latest SDK build. Cached the same way stripeClient.js
 * caches its `loadStripe()` promise: keyed by client ID, so switching
 * environments (e.g. sandbox -> live client ID) loads a fresh script
 * instead of silently reusing the old one.
 */
let scriptPromise = null;
let loadedClientId = null;

export function loadPaypalSdk(clientId) {
  if (!clientId) return Promise.reject(new Error("No PayPal client ID configured."));

  if (scriptPromise && loadedClientId === clientId) {
    return scriptPromise;
  }
  loadedClientId = clientId;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-c767-paypal-sdk]");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&currency=USD&intent=capture`;
    script.dataset.c767PaypalSdk = "1";
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("Couldn't load the PayPal SDK."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}
