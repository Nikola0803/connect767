import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  captureBookingPaypalOrder,
  confirmBookingPayment,
  createBookingCheckout,
  createBookingPaypalOrder,
  getCheckoutConfig,
  submitBooking,
} from "../data/repository";
import { getStripe } from "../lib/stripeClient";
import PaypalButton from "./PaypalButton";
import Button from "./ui/Button";
import { FormField, Input, Textarea } from "./ui/FormField";

const formatPrice = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

function BookingCardPayment({ booking, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const pay = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (stripeError) {
      setError(stripeError.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }
    try {
      const result = await confirmBookingPayment(booking.bookingId, booking.accessToken);
      if (result.status === "paid") onSuccess(result);
      else setError("Payment is still processing. You'll receive confirmation by email.");
    } catch {
      setError("Payment went through, but confirmation is still processing. Check your email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={pay} className="mt-4">
      <PaymentElement />
      {error && <p className="text-xs text-accent-600 font-label mt-3">{error}</p>}
      <Button type="submit" variant="primary" className="w-full mt-4" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : "Pay & confirm booking"}
      </Button>
    </form>
  );
}

export default function BookingForm({
  slug,
  businessName,
  priceCents = 0,
  durationMinutes = 30,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [step, setStep] = useState("details");
  const [booking, setBooking] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const isPaid = Number(priceCents) > 0;
  const valid = form.name.trim() && (form.email.trim() || form.phone.trim());

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!valid) {
      setError("Add your name and either an email or a phone number.");
      return;
    }
    if (isPaid && !form.email.trim()) {
      setError("Add your email so we can send your receipt and private meeting link.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      let config = null;
      if (isPaid) {
        config = await getCheckoutConfig();
        if (!config?.stripeEnabled && !config?.paypalEnabled) {
          throw new Error("Online payment is temporarily unavailable. Please contact the business.");
        }
      }
      const result = await submitBooking(slug, form);
      setBooking(result);
      if (result.paymentRequired) {
        setPaymentConfig(config);
        setStep("choosePayment");
      } else {
        setStep("requested");
      }
    } catch (requestError) {
      setError(requestError.message || "Couldn't send your request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const startCard = async () => {
    setError(null);
    setSending(true);
    try {
      const result = await createBookingCheckout(booking.bookingId, booking.accessToken);
      setClientSecret(result.clientSecret);
      setStep("card");
    } catch (checkoutError) {
      setError(checkoutError.message || "Couldn't start card payment.");
    } finally {
      setSending(false);
    }
  };

  const finish = (result) => {
    setMeetingUrl(result.meetingUrl || "");
    setStep("confirmed");
  };

  if (step === "requested" || step === "confirmed") {
    const confirmed = step === "confirmed";
    return (
      <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-6 text-center">
        <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-700 mb-3">
          <i className={`${confirmed ? "ri-video-chat-fill" : "ri-check-line"} text-xl`} />
        </div>
        <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1.5">
          {confirmed ? "Booking confirmed" : "Request sent"}
        </h3>
        <p className="text-sm text-foreground-600 font-label">
          {confirmed
            ? `Your ${durationMinutes}-minute appointment with ${businessName} is confirmed.`
            : `${businessName} will review your preferred time and confirm with you directly.`}
        </p>
        {confirmed && meetingUrl && (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 mt-4 px-5 py-2.5 rounded-md bg-primary-600 text-background-50 text-sm font-semibold hover:bg-primary-700"
          >
            <i className="ri-video-chat-line" />
            Join meeting
          </a>
        )}
        {confirmed && !meetingUrl && (
          <p className="text-xs text-foreground-500 font-label mt-3">
            The business will send the meeting details separately. A confirmation was emailed to you.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-background-200/70 bg-background-50 p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-heading text-lg font-medium text-foreground-950">Book an appointment</h3>
        <span className="text-sm font-semibold text-primary-800 whitespace-nowrap">
          {isPaid ? formatPrice(priceCents) : "Free"}
        </span>
      </div>
      <p className="text-xs text-foreground-600 font-label mb-5">
        {durationMinutes}-minute appointment. {isPaid
          ? "Choose a preferred time, then pay securely to confirm and receive the private meeting link."
          : "Choose a preferred time; the business will confirm it with you."}
      </p>

      {step === "details" && (
        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <FormField label="Your name" htmlFor="booking-name" required>
              <Input id="booking-name" value={form.name} onChange={update("name")} placeholder="Full name" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Email" htmlFor="booking-email" required={isPaid}>
                <Input id="booking-email" type="email" value={form.email} onChange={update("email")} placeholder="you@email.com" />
              </FormField>
              <FormField label="Phone" htmlFor="booking-phone">
                <Input id="booking-phone" value={form.phone} onChange={update("phone")} placeholder="+1 (767) 555-0100" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Preferred date" htmlFor="booking-date">
                <Input id="booking-date" type="date" value={form.preferredDate} onChange={update("preferredDate")} />
              </FormField>
              <FormField label="Preferred time" htmlFor="booking-time">
                <Input id="booking-time" type="time" value={form.preferredTime} onChange={update("preferredTime")} />
              </FormField>
            </div>
            <FormField label="Anything else?" htmlFor="booking-notes">
              <Textarea id="booking-notes" rows={3} value={form.notes} onChange={update("notes")} placeholder="What do you need, how many people, or anything that helps them prepare…" />
            </FormField>
          </div>
          {error && <p className="text-xs text-accent-600 font-label mt-3">{error}</p>}
          <Button type="submit" variant="primary" icon="ri-calendar-check-line" iconPosition="left" disabled={sending} className="w-full mt-4">
            {sending ? "Starting…" : isPaid ? `Continue to payment · ${formatPrice(priceCents)}` : "Send booking request"}
          </Button>
        </form>
      )}

      {step === "choosePayment" && paymentConfig && (
        <div>
          <p className="text-sm text-foreground-700 font-label mb-4">
            Your requested time is held pending payment. Choose how to pay.
          </p>
          {error && <p className="text-xs text-accent-600 font-label mb-3">{error}</p>}
          {paymentConfig.stripeEnabled && (
            <Button variant="primary" onClick={startCard} disabled={sending} className="w-full" icon="ri-bank-card-line" iconPosition="left">
              {sending ? "Starting…" : "Pay with card"}
            </Button>
          )}
          {paymentConfig.stripeEnabled && paymentConfig.paypalEnabled && (
            <div className="flex items-center gap-3 my-4 text-xs text-foreground-500 font-label">
              <span className="h-px bg-background-200 flex-1" />or<span className="h-px bg-background-200 flex-1" />
            </div>
          )}
          {paymentConfig.paypalEnabled && (
            <PaypalButton
              clientId={paymentConfig.paypalClientId}
              createOrder={async () => {
                const result = await createBookingPaypalOrder(booking.bookingId, booking.accessToken);
                return { orderId: booking.bookingId, paypalOrderId: result.paypalOrderId };
              }}
              captureOrder={() => captureBookingPaypalOrder(booking.bookingId, booking.accessToken)}
              onSuccess={(_, result) => finish(result)}
              onError={(message) => setError(message)}
            />
          )}
        </div>
      )}

      {step === "card" && clientSecret && paymentConfig && (
        <Elements stripe={getStripe(paymentConfig.stripePublishableKey)} options={{ clientSecret }}>
          <BookingCardPayment booking={booking} onSuccess={finish} />
        </Elements>
      )}
    </div>
  );
}
