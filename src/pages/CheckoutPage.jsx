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
  createCartLocalDominicaOrder,
} from "../data/repository";
import { isLiveApi } from "../lib/config";
import Button from "../components/ui/Button";
import { FormField, Input, Select, Textarea } from "../components/ui/FormField";
import { Spinner } from "../components/ui/States";
import PaypalButton from "../components/PaypalButton";
import { readyMadeCartIssues } from "../lib/readyMadeMinimums";
import { getStoredUser } from "../lib/apiClient";
import ReadyMadeCheckoutRoster, { readyMadeExtrasStatus } from "../components/ReadyMadeCheckoutRoster";
import { UNIFORM_SHIPPING_COUNTRIES, uniformShippingRate } from "../lib/uniformShipping";
import { uniformAddressRegions, validateUniformShippingAddress } from "../lib/uniformAddress";

let stripePromise = null;
const emptyShipping = {
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postcode: "",
  country: "US",
  phone: "",
};
const emptyOrderContact = { name: "", email: "", phone: "", club: "", notes: "" };

function getStripe(publishableKey) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

export default function CheckoutPage() {
  const { items, clearCart } = useCart();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState(emptyShipping);
  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [orderAccessToken, setOrderAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fallingBack, setFallingBack] = useState(false);
  const [placingLocalOrder, setPlacingLocalOrder] = useState(false);
  const [useDifferentOrderContact, setUseDifferentOrderContact] = useState(false);
  const [orderContact, setOrderContact] = useState(emptyOrderContact);
  const [checkoutStep, setCheckoutStep] = useState("roster");
  const [readyMadeRoster, setReadyMadeRoster] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("c767_ready_made_roster") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [readyMadeExtras, setReadyMadeExtras] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("c767_ready_made_extras") || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  });

  const productTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const minimumIssues = readyMadeCartIssues(items);
  const hasReadyMadeDesigns = items.some((item) => item.readyMade);
  const readyMadeItemKeys = items.filter((item) => item.readyMade).map((item) => item.key).sort().join("|");
  const accountRequired = hasReadyMadeDesigns && !getStoredUser();
  const extrasStatus = readyMadeExtrasStatus(items, readyMadeExtras, readyMadeRoster);
  const extrasTotal = extrasStatus.supporterTotal + extrasStatus.extraSocksTotal + extrasStatus.productionTotal;
  const total = productTotal + extrasTotal;
  const readyMadeShippingUnits = items.filter((item) => item.readyMade).reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0) + extrasStatus.supporterQuantity;
  const readyMadeShippingRate = hasReadyMadeDesigns ? uniformShippingRate(shipping.country, readyMadeShippingUnits) : null;
  const orderContext = hasReadyMadeDesigns ? {
    readyMadeRoster,
    readyMadeExtras: { ...readyMadeExtras, supporterJerseys: extrasStatus.supporterJerseys },
    readyMadeOrderContact: { enabled: useDifferentOrderContact, ...orderContact },
  } : {};
  const readyMadeAddressValidation = validateUniformShippingAddress(shipping);
  const addressRegions = uniformAddressRegions(shipping.country);
  const standardShippingComplete = Boolean(shipping.firstName.trim() && shipping.lastName.trim() && shipping.address1.trim() && shipping.city.trim() && (shipping.country !== "US" || (shipping.state.trim() && shipping.postcode.trim())));
  const orderContactValid = !useDifferentOrderContact || Boolean(
    orderContact.name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(orderContact.email.trim()),
  );
  const shippingComplete = Boolean(email.trim() && orderContactValid && (hasReadyMadeDesigns ? readyMadeAddressValidation.valid : standardShippingComplete));

  const updateShipping = (field) => (event) => {
    const value = event.target.value;
    setShipping((current) => field === "country" ? { ...current, country: value, state: "", postcode: "" } : { ...current, [field]: value });
  };

  const requireShipping = () => {
    if (accountRequired) {
      setError("Sign in before checking out with a ready-made uniform design.");
      return false;
    }
    if (minimumIssues.length) {
      setError(minimumIssues.map((issue) => issue.message).join(" "));
      return false;
    }
    if (shippingComplete) return true;
    setError(useDifferentOrderContact && !orderContactValid ? "Enter the order contact name and a valid email address." : "Enter your email and complete every required shipping-address field.");
    return false;
  };

  useEffect(() => {
    getCheckoutConfig()
      .then(setConfig)
      .catch(() => setConfig({ stripeEnabled: false, stripePublishableKey: "" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("c767_ready_made_roster", JSON.stringify(readyMadeRoster));
    } catch {
      // Checkout still works when browser storage is unavailable.
    }
  }, [readyMadeRoster]);

  useEffect(() => {
    try {
      localStorage.setItem("c767_ready_made_extras", JSON.stringify(readyMadeExtras));
    } catch {
      // Checkout still works when browser storage is unavailable.
    }
  }, [readyMadeExtras]);

  useEffect(() => {
    const currentKeys = new Set(readyMadeItemKeys.split("|").filter(Boolean));
    setReadyMadeRoster((current) => current.filter((row) => currentKeys.has(row.productKey)));
  }, [readyMadeItemKeys]);

  const startEmbeddedCheckout = async () => {
    if (!requireShipping()) return;
    setError(null);
    try {
      const result = await createPaymentIntent(items, email, shipping, orderContext);
      setClientSecret(result.clientSecret);
      setOrderId(result.orderId);
      setOrderAccessToken(result.accessToken);
    } catch (err) {
      setError(err.message || "Couldn't start checkout. Please try again.");
    }
  };

  const useWooCommerceFallback = async () => {
    if (!requireShipping()) return;
    setFallingBack(true);
    setError(null);
    try {
      const result = await checkout(items, email, shipping, orderContext);
      clearCart();
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err.message || "Couldn't start checkout. Please try again.");
      setFallingBack(false);
    }
  };

  const placeLocalDominicaOrder = async () => {
    if (!requireShipping() || shipping.country !== "DM") return;
    setPlacingLocalOrder(true);
    setError(null);
    try {
      const result = await createCartLocalDominicaOrder(items, email, shipping, orderContext);
      clearCart();
      navigate(`/checkout/thank-you?order=${result.orderId}&payment=local-dominica`);
    } catch (err) {
      setError(err.message || "Couldn't reserve this order for local payment.");
      setPlacingLocalOrder(false);
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

        {hasReadyMadeDesigns && (
          <div aria-label="Ready-made checkout progress" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-background-200 bg-background-50 p-2">
            <button type="button" onClick={() => setCheckoutStep("roster")} className={`rounded-xl px-3 py-3 text-left ${checkoutStep === "roster" ? "bg-primary-700 text-white" : "bg-background-100 text-foreground-600"}`}>
              <span className="block font-label text-[9px] font-bold uppercase tracking-widest opacity-70">Step 2</span>
              <span className="text-sm font-bold">Team Roster</span>
            </button>
            <div className={`rounded-xl px-3 py-3 ${checkoutStep === "review" ? "bg-primary-700 text-white" : "bg-background-100 text-foreground-500"}`}>
              <span className="block font-label text-[9px] font-bold uppercase tracking-widest opacity-70">Step 3</span>
              <span className="text-sm font-bold">Review &amp; Checkout</span>
            </div>
          </div>
        )}

        {accountRequired && (
          <div role="alert" className="mb-6 rounded-xl border border-accent-300 bg-accent-50 p-4 text-sm text-accent-950">
            <p className="font-bold">Account required</p>
            <p className="mt-1 text-xs leading-relaxed">Sign in to protect your order, payment record and ready-made design purchase.</p>
            <Button to="/auth/login?redirect=%2Fcheckout" variant="primary" className="mt-4">Sign In</Button>
          </div>
        )}

        {minimumIssues.length > 0 && (
          <div role="alert" className="mb-6 rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-900">
            <p className="font-bold">Ready-made order minimum not met</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
              {minimumIssues.map((issue) => <li key={`${issue.category}-${issue.message}`}>{issue.message}</li>)}
            </ul>
            <Button to="/shop?category=ready-made-designs" variant="secondary" className="mt-4">Return to Ready-Made Designs</Button>
          </div>
        )}

        {hasReadyMadeDesigns && checkoutStep === "roster" && (
          <ReadyMadeCheckoutRoster items={items} roster={readyMadeRoster} setRoster={setReadyMadeRoster} extras={readyMadeExtras} setExtras={setReadyMadeExtras} onContinue={() => setCheckoutStep("review")} />
        )}

        {hasReadyMadeDesigns && checkoutStep === "review" && readyMadeRoster.length > 0 && (
          <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-primary-950">Team Roster Confirmed</p><p className="mt-1 text-xs text-primary-800">{readyMadeRoster.length} roster row{readyMadeRoster.length === 1 ? "" : "s"}{extrasStatus.supporterQuantity ? ` · ${extrasStatus.supporterQuantity} supporter jerseys` : ""}{extrasStatus.requiredSocks ? ` · ${extrasStatus.socksQuantity} socks` : ""} saved with this order.</p></div><Button type="button" variant="secondary" size="sm" onClick={() => setCheckoutStep("roster")}>Edit Roster</Button></div>
          </div>
        )}

        {(!hasReadyMadeDesigns || checkoutStep === "review") && <div className="rounded-xl border border-background-200/70 bg-background-50 p-5 mb-6">
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
          {extrasStatus.supporterQuantity > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-foreground-700">Supporter Jerseys × {extrasStatus.supporterQuantity}</span><span className="font-semibold text-foreground-950">${extrasStatus.supporterTotal.toFixed(2)}</span></div>}
          {extrasStatus.extraSocks > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-foreground-700">Extra Socks × {extrasStatus.extraSocks}</span><span className="font-semibold text-foreground-950">${extrasStatus.extraSocksTotal.toFixed(2)}</span></div>}
          {extrasStatus.poloCollarTotal > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-foreground-700">Polo Style Collars × {extrasStatus.kitQuantity}</span><span className="font-semibold text-foreground-950">${extrasStatus.poloCollarTotal.toFixed(2)}</span></div>}
          {extrasStatus.longSleeveTotal > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-foreground-700">Long-Sleeve Upgrades × {extrasStatus.longSleeveQuantity}</span><span className="font-semibold text-foreground-950">${extrasStatus.longSleeveTotal.toFixed(2)}</span></div>}
          {extrasStatus.embroideryTotal > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-foreground-700">Embroidered Team Logos × {extrasStatus.kitQuantity}</span><span className="font-semibold text-foreground-950">${extrasStatus.embroideryTotal.toFixed(2)}</span></div>}
          {extrasStatus.insideCollarTotal > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-foreground-700">Inside-Collar Logo or Message × {extrasStatus.kitQuantity}</span><span className="font-semibold text-foreground-950">${extrasStatus.insideCollarTotal.toFixed(2)}</span></div>}
          <div className="flex justify-between text-base font-semibold pt-3 mt-2 border-t border-background-200/70">
            <span>Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-foreground-500 font-label">
            Shipping is calculated from the delivery address and included before payment.
          </p>
        </div>}

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

        {(!hasReadyMadeDesigns || checkoutStep === "review") && (!clientSecret ? (
          <>
            <div className="rounded-xl border border-background-200/70 bg-background-50 p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <i className="ri-truck-line text-primary-700" />
                <h2 className="font-heading text-xl font-medium text-foreground-950">Shipping address</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First name" htmlFor="shipping-first-name" required>
                  <Input id="shipping-first-name" autoComplete="given-name" value={shipping.firstName} onChange={updateShipping("firstName")} />
                </FormField>
                <FormField label="Last name" htmlFor="shipping-last-name" required>
                  <Input id="shipping-last-name" autoComplete="family-name" value={shipping.lastName} onChange={updateShipping("lastName")} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Company" htmlFor="shipping-company" hint="Optional">
                    <Input id="shipping-company" autoComplete="organization" value={shipping.company} onChange={updateShipping("company")} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Street address" htmlFor="shipping-address-1" required>
                    <Input id="shipping-address-1" autoComplete="address-line1" value={shipping.address1} onChange={updateShipping("address1")} />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Apartment, suite or unit" htmlFor="shipping-address-2" hint="Optional">
                    <Input id="shipping-address-2" autoComplete="address-line2" value={shipping.address2} onChange={updateShipping("address2")} />
                  </FormField>
                </div>
                <FormField label="City" htmlFor="shipping-city" required>
                  <Input id="shipping-city" autoComplete="address-level2" value={shipping.city} onChange={updateShipping("city")} />
                </FormField>
                <FormField label={shipping.country === "CA" ? "Province / territory" : addressRegions.length ? "State" : "Region / parish"} htmlFor="shipping-state" hint={addressRegions.length ? undefined : "Optional"} required={addressRegions.length > 0}>
                  {addressRegions.length ? <Select id="shipping-state" autoComplete="address-level1" value={shipping.state} onChange={updateShipping("state")}><option value="">Choose a region</option>{addressRegions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</Select> : <Input id="shipping-state" autoComplete="address-level1" value={shipping.state} onChange={updateShipping("state")} />}
                </FormField>
                <FormField label={shipping.country === "US" ? "ZIP code" : "Postal code"} htmlFor="shipping-postcode" hint={addressRegions.length ? undefined : "Optional"} required={addressRegions.length > 0}>
                  <Input id="shipping-postcode" autoComplete="postal-code" value={shipping.postcode} onChange={updateShipping("postcode")} />
                </FormField>
                <FormField label="Phone" htmlFor="shipping-phone" hint="Optional">
                  <Input id="shipping-phone" type="tel" autoComplete="tel" value={shipping.phone} onChange={updateShipping("phone")} />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Country" htmlFor="shipping-country" required>
                    <Select id="shipping-country" autoComplete="country" value={shipping.country} onChange={updateShipping("country")}>
                      {hasReadyMadeDesigns ? UNIFORM_SHIPPING_COUNTRIES.map((zone) => <optgroup key={zone.label} label={zone.label}>{zone.countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</optgroup>) : <><option value="US">United States</option><option value="DM">Dominica</option></>}
                    </Select>
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Email" htmlFor="checkout-email" required>
                    <Input
                      id="checkout-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
              {hasReadyMadeDesigns && <>
                <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-xs font-semibold text-foreground-800">
                  <input type="checkbox" checked={useDifferentOrderContact} onChange={(event) => setUseDifferentOrderContact(event.target.checked)} className="h-4 w-4 rounded border-background-300 text-primary-600 focus:ring-primary-500" />
                  Add Contact Details if Different From Order
                </label>
                {useDifferentOrderContact && <div className="mt-3 rounded-2xl border border-background-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-foreground-900">Order Contact <span className="text-accent-700">Required</span></h3>
                  <p className="mb-3 mt-1 text-xs text-foreground-500">We send the receipt, production proof and order updates here.</p>
                  <div className="space-y-3">
                    <Input aria-label="Order contact name" placeholder="Contact Name *" value={orderContact.name} onChange={(event) => setOrderContact((current) => ({ ...current, name: event.target.value }))} />
                    <Input type="email" aria-label="Order contact email address" placeholder="Email Address *" value={orderContact.email} onChange={(event) => setOrderContact((current) => ({ ...current, email: event.target.value }))} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input aria-label="Order contact phone number" placeholder="Phone" value={orderContact.phone} onChange={(event) => setOrderContact((current) => ({ ...current, phone: event.target.value }))} />
                      <Input aria-label="Club or team name" placeholder="Club / Team" value={orderContact.club} onChange={(event) => setOrderContact((current) => ({ ...current, club: event.target.value }))} />
                    </div>
                    <Textarea rows={2} aria-label="Additional order notes" placeholder="Deadline, delivery destination or production notes…" value={orderContact.notes} onChange={(event) => setOrderContact((current) => ({ ...current, notes: event.target.value }))} />
                  </div>
                </div>}
              </>}
              <p className="mt-4 text-xs text-foreground-500 font-label">
                {hasReadyMadeDesigns ? "Ready-made uniforms use the same North America and Caribbean shipping rates as the Custom Uniform Studio." : "Shipping is available to U.S. and Dominican addresses."} Carrier labels are created from the completed order in WooCommerce.
              </p>
              {readyMadeShippingRate && <div role="note" className="mt-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-xs text-primary-900"><strong>{readyMadeShippingRate.zoneLabel}:</strong> ${readyMadeShippingRate.amount.toFixed(2)} shipping for {readyMadeShippingRate.rangeLabel || (readyMadeShippingUnits >= 50 ? "50+ units" : "under 50 units")}.</div>}
            </div>

            {config?.stripeEnabled && (
              <Button variant="primary" size="lg" className="w-full" onClick={startEmbeddedCheckout} disabled={!isLiveApi || !shippingComplete}>
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
                disabled={!isLiveApi || !shippingComplete}
                createOrder={async () => {
                  if (!requireShipping()) throw new Error("Complete the shipping address first.");
                  const result = await createCartPaypalOrder(items, email, shipping, orderContext);
                  return {
                    orderId: result.orderId,
                    paypalOrderId: result.paypalOrderId,
                    accessToken: result.accessToken,
                  };
                }}
                captureOrder={(id, accessToken) => captureCartPaypalOrder(id, accessToken)}
                onSuccess={(id) => {
                  clearCart();
                  navigate(`/checkout/thank-you?order=${id}`);
                }}
                onError={(message) => setError(message)}
              />
            )}

            {shipping.country === "DM" && (
              <div className="mt-4">
                <div className="relative mb-3 overflow-hidden rounded-xl border border-[#159447] bg-gradient-to-r from-[#effcf4] via-white to-[#f4fff7] p-4 shadow-[0_8px_22px_rgba(0,92,48,0.08)]">
                  <span className="absolute inset-y-0 right-0 w-24 bg-[linear-gradient(135deg,transparent_18%,#0a6136_18%,#0a6136_40%,#f4cf18_40%,#f4cf18_50%,#111_50%,#111_60%,#fff_60%,#fff_70%,#0a6136_70%)] opacity-90" />
                  <div className="relative flex items-center gap-3 pr-20">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#08743f] text-xl text-white shadow-sm">
                      <i className="ri-shake-hands-line" />
                    </span>
                    <span>
                      <span className="block text-base font-bold text-[#064b2b]">Local Pickup / Pay in Dominica</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-foreground-600">Reserve the order with $0 pickup shipping, then arrange pickup and payment in person.</span>
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full border-primary-500 bg-primary-50 text-primary-800 hover:bg-primary-100"
                  onClick={placeLocalDominicaOrder}
                  disabled={!isLiveApi || placingLocalOrder || !shippingComplete}
                >
                  {placingLocalOrder ? "Reserving Order…" : "Choose Local Pickup & Pay in Dominica"}
                </Button>
                <p className="mt-2 text-center text-xs text-foreground-500 font-label">Payment instructions will be emailed after checkout. The order remains on hold until local payment is confirmed.</p>
              </div>
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
                  disabled={!isLiveApi || fallingBack || !shippingComplete}
                >
                  {fallingBack ? "Redirecting…" : "Continue to payment"}
                </Button>
              </>
            )}
          </>
        ) : (
          <Elements stripe={getStripe(config.stripePublishableKey)} options={{ clientSecret }}>
            <StripePaymentForm
              orderId={orderId}
              accessToken={orderAccessToken}
              onSuccess={() => navigate(`/checkout/thank-you?order=${orderId}`)}
            />
          </Elements>
        ))}
      </div>
    </div>
  );
}

function StripePaymentForm({ orderId, accessToken, onSuccess }) {
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
      const result = await confirmOrder(orderId, accessToken);
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
