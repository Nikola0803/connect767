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
import {
  bookingRateUnit,
  bookingTypeLabel,
  isRentalBookingType,
  normalizeRentalRateUnit,
  rentalUnitsBetween,
} from "../lib/bookingTypes";
import { bookingPriceForSelection, checkoutAfterFlatRateSelection, normalizeBookingRateRules } from "../lib/bookingRates";
import PaypalButton from "./PaypalButton";
import BookingPriceCalendar from "./booking/BookingPriceCalendar";
import Button from "./ui/Button";
import { FormField, Input, Select, Textarea } from "./ui/FormField";

const formatPrice = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const pluralize = (unit, count) => `${unit}${count === 1 ? "" : "s"}`;
const formatDuration = (minutes) => {
  const value = Number(minutes) || 0;
  if (value < 60) return `${value} minutes`;
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} ${hours === 1 ? "hour" : "hours"}`;
};
const formatStayRange = (start, end) => {
  if (!start || !end) return "";
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();
  const startLabel = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = sameMonth
    ? `${endDate.getDate()}, ${endDate.getFullYear()}`
    : endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  return `${startLabel}–${endLabel}`;
};

function BookingCardPayment({ booking, amountCents, onSuccess }) {
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
        {submitting ? "Processing…" : `Pay ${formatPrice(amountCents)} & confirm booking`}
      </Button>
    </form>
  );
}

export default function BookingForm({
  slug,
  businessName,
  bookingType = "appointment",
  priceCents = 0,
  rentalRateUnit = "",
  rateRules = [],
  durationMinutes = 30,
  priceUnit = "appointment",
  maxDurationMinutes = 120,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    checkIn: "",
    checkOut: "",
    notes: "",
    durationMinutes: String(durationMinutes),
  });
  const [step, setStep] = useState("details");
  const [booking, setBooking] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const isRental = isRentalBookingType(bookingType);
  const rateUnit = isRentalBookingType(bookingType)
    ? normalizeRentalRateUnit(rentalRateUnit, bookingType)
    : bookingRateUnit(bookingType);
  const units = rentalUnitsBetween(form.checkIn, form.checkOut, rateUnit);
  const unitLabel = pluralize(rateUnit, units);
  const normalizedRules = normalizeBookingRateRules(rateRules);
  const totalCents = bookingPriceForSelection({
    bookingType: isRental ? bookingType : "appointment",
    basePriceCents: priceCents,
    rules: normalizedRules,
    preferredDate: form.preferredDate,
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    rateUnit,
    durationMinutes: form.durationMinutes,
    priceUnit,
  });
  const hasPaidRates = Number(priceCents) > 0 || normalizedRules.some((rule) => rule.priceCents > 0);
  const variablePricing = normalizedRules.length > 0;
  const hasDateSelection = isRental ? units > 0 : Boolean(form.preferredDate);
  const isPaid = hasDateSelection ? totalCents > 0 : hasPaidRates;
  const paymentAmountCents = Math.max(0, Number(booking?.amountCents ?? totalCents) || 0);
  const showingPayment = step === "choosePayment" || step === "card";
  const commonValid = [form.name, form.email, form.phone, form.notes].every((value) => value.trim());
  const valid = commonValid && (!isPaid || termsAccepted) && (isRental
    ? Boolean(form.checkIn && form.checkOut && units > 0)
    : Boolean(form.preferredDate && form.preferredTime));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isPaid && !termsAccepted) {
      setError("You must accept the Paid Booking Terms before continuing to payment.");
      return;
    }
    if (!valid) {
      setError(isRental
        ? `Complete every required field and choose an end date after the ${rateUnit === "night" ? "check-in" : "start"} date.`
        : "Complete every required field before submitting your appointment request.");
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
      const result = await submitBooking(slug, { ...form, durationMinutes: Number(form.durationMinutes), bookingType, termsAccepted });
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
            ? isRental
              ? `Your ${units}-${rateUnit} ${bookingTypeLabel(bookingType).toLowerCase()} booking with ${businessName} is confirmed.`
              : `Your ${formatDuration(form.durationMinutes)} appointment with ${businessName} is confirmed.`
            : isRental
              ? `${businessName} will review your rental dates and confirm with you directly.`
              : `${businessName} will review your preferred time and confirm with you directly.`}
        </p>
        {confirmed && !isRental && meetingUrl && (
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
        {confirmed && !isRental && !meetingUrl && (
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
        <h3 className="font-heading text-lg font-medium text-foreground-950">{showingPayment ? businessName : isRental ? `Book ${bookingTypeLabel(bookingType).toLowerCase()}` : "Book an appointment"}</h3>
        {!showingPayment && (
          <span className="text-sm font-semibold text-primary-800 whitespace-nowrap">
            {isPaid
              ? `${variablePricing ? "From " : ""}${formatPrice(priceCents)}${isRental ? ` / ${rateUnit}` : priceUnit === "minute" ? " / minute" : priceUnit === "hour" ? " / hour" : ""}`
              : "Free"}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground-600 font-label mb-5">
        {isRental ? (rateUnit === "night" ? "Select your check-in and check-out dates. " : "Select your start and end dates. ") : `Choose a meeting length from ${formatDuration(durationMinutes)} to ${formatDuration(Math.max(durationMinutes, maxDurationMinutes))}. `}{isPaid
          ? isRental ? `Your total is calculated by the number of ${rateUnit}s. Date-specific prices are shown on the calendar before payment.` : "Choose a preferred time. Any date-specific rate is shown before secure payment and confirmation."
          : isRental ? "Send a request and the owner will confirm availability." : "Choose a preferred time; the business will confirm it with you."}
      </p>

      {step === "details" && (
        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <FormField label="Your name" htmlFor="booking-name" required>
              <Input id="booking-name" value={form.name} onChange={update("name")} placeholder="Full name" required />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Email" htmlFor="booking-email" required>
                <Input id="booking-email" type="email" value={form.email} onChange={update("email")} placeholder="you@email.com" required />
              </FormField>
              <FormField label="Phone" htmlFor="booking-phone" required>
                <Input id="booking-phone" type="tel" value={form.phone} onChange={update("phone")} placeholder="+1 (767) 555-0100" required />
              </FormField>
            </div>
            <BookingPriceCalendar
              basePriceCents={priceCents}
              rules={normalizedRules}
              mode={isRental ? "range" : "single"}
              selectedStart={isRental ? form.checkIn : form.preferredDate}
              selectedEnd={isRental ? form.checkOut : ""}
              onSelect={(start, end) => setForm((current) => isRental
                ? { ...current, checkIn: start, checkOut: end }
                : { ...current, preferredDate: start })}
              unitLabel={isRental ? rateUnit : priceUnit === "minute" ? "minute" : priceUnit === "hour" ? "hour" : "meeting"}
              endDateIsCheckout={isRental}
            />
            {isRental ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={rateUnit === "night" ? "Check-in" : "Start date"} htmlFor="booking-check-in" required>
                <Input id="booking-check-in" type="date" min={new Date().toISOString().slice(0, 10)} value={form.checkIn} onChange={update("checkIn")} required />
              </FormField>
              <FormField label={rateUnit === "night" ? "Check-out" : "End date"} htmlFor="booking-check-out" required>
                <Input
                  id="booking-check-out"
                  type="date"
                  min={form.checkIn || new Date().toISOString().slice(0, 10)}
                  value={form.checkOut}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    checkOut: checkoutAfterFlatRateSelection(current.checkIn, event.target.value, normalizedRules),
                  }))}
                  required
                />
              </FormField>
            </div> : <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Preferred date" htmlFor="booking-date" required>
                <Input id="booking-date" type="date" value={form.preferredDate} onChange={update("preferredDate")} required />
              </FormField>
              <FormField label="Preferred time" htmlFor="booking-time" required>
                <Input id="booking-time" type="time" value={form.preferredTime} onChange={update("preferredTime")} required />
              </FormField>
              <FormField label="Meeting length" htmlFor="booking-duration" required>
                <Select id="booking-duration" value={form.durationMinutes} onChange={update("durationMinutes")} required>
                  {Array.from(
                    { length: Math.floor((Math.max(Number(durationMinutes), Number(maxDurationMinutes)) - Number(durationMinutes)) / 15) + 1 },
                    (_, index) => Number(durationMinutes) + index * 15,
                  ).map((minutes) => <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>)}
                </Select>
              </FormField>
            </div>}
            {isRental && units > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-primary-50 px-4 py-3 text-sm font-label">
                <span>{formatStayRange(form.checkIn, form.checkOut)} · {units} {unitLabel} · rates shown on calendar</span>
                <strong className="text-primary-900">Total {formatPrice(totalCents)}</strong>
              </div>
            )}
            {!isRental && form.preferredDate && (
              <div className="flex items-center justify-between rounded-lg bg-primary-50 px-4 py-3 text-sm font-label">
                <span>{new Date(`${form.preferredDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {formatDuration(form.durationMinutes)}</span>
                <strong className="text-primary-900">{totalCents > 0 ? formatPrice(totalCents) : "Free"}</strong>
              </div>
            )}
            <FormField label="Notes & Preferences" htmlFor="booking-notes" required>
              <Textarea id="booking-notes" rows={3} value={form.notes} onChange={update("notes")} placeholder="What do you need, how many people, or anything that helps them prepare…" required />
            </FormField>
            {isPaid && (
              <label className="flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-100/50 px-3.5 py-3 text-xs font-label text-foreground-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-background-300"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  required
                />
                <span>
                  I agree to the{" "}
                  <a
                    href="/terms#paid-booking"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-700 hover:text-primary-800 font-semibold underline underline-offset-2"
                  >
                    Paid Booking Terms
                  </a>
                  , including Connect767&apos;s 10% transaction fee.
                </span>
              </label>
            )}
          </div>
          {error && <p className="text-xs text-accent-600 font-label mt-3">{error}</p>}
          <Button type="submit" variant="primary" icon="ri-calendar-check-line" iconPosition="left" disabled={sending || (isPaid && !termsAccepted)} className="w-full mt-4">
            {sending ? "Starting…" : isPaid && isRental && units === 0 ? "Select rental dates" : isPaid ? `Continue to payment · ${formatPrice(totalCents)}` : "Send booking request"}
          </Button>
        </form>
      )}

      {step === "choosePayment" && paymentConfig && (
        <div>
          <p className="text-sm text-foreground-700 font-label mb-4">
            {isRental ? "Your selected rental dates are held pending payment." : "Your requested time is held pending payment."} Choose how to pay.
          </p>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 mb-4 font-label">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Amount to pay</p>
              <p className="text-sm text-foreground-600 mt-0.5">
                {isRental ? `${formatStayRange(form.checkIn, form.checkOut)} · ${units} ${unitLabel}` : `${new Date(`${form.preferredDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${formatDuration(form.durationMinutes)}`}
              </p>
            </div>
            <strong className="font-heading text-xl text-primary-900 whitespace-nowrap">{formatPrice(paymentAmountCents)}</strong>
          </div>
          {error && <p className="text-xs text-accent-600 font-label mb-3">{error}</p>}
          {paymentConfig.stripeEnabled && (
            <Button variant="primary" onClick={startCard} disabled={sending} className="w-full" icon="ri-bank-card-line" iconPosition="left">
              {sending ? "Starting…" : `Pay ${formatPrice(paymentAmountCents)} with card`}
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
          <BookingCardPayment booking={booking} amountCents={paymentAmountCents} onSuccess={finish} />
        </Elements>
      )}
    </div>
  );
}
