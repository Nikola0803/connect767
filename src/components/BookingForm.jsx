import { useState } from "react";
import { submitBooking } from "../data/repository";
import Button from "./ui/Button";
import { FormField, Input, Textarea } from "./ui/FormField";

/**
 * "Request a booking" form on a listing profile.
 *
 * Only rendered when the owner has bookings switched on. The backend
 * (class-rest-bookings.php) has supported this since the beginning and the
 * pricing page advertises it as a Classified feature, but no form was ever
 * built — so enabling bookings changed nothing a customer could see.
 *
 * Deliberately not gated behind sign-in. Someone trying to book a plumber
 * shouldn't have to create an account first, and the endpoint is public for
 * exactly that reason.
 */
export default function BookingForm({ slug, businessName }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Mirrors the server's rule exactly (name + at least one way to reply), so
  // the customer is told before submitting rather than by a 400.
  const valid = form.name.trim() && (form.email.trim() || form.phone.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) {
      setError("Add your name and either an email or a phone number.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await submitBooking(slug, form);
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send your request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-6 text-center">
        <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-700 mb-3">
          <i className="ri-check-line text-xl" />
        </div>
        <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1.5">
          Request sent
        </h3>
        <p className="text-sm text-foreground-600 font-label">
          {businessName} has your request and will get back to you directly. Nothing is confirmed
          or charged yet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-background-200/70 bg-background-50 p-5 md:p-6"
    >
      <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1">
        Request a booking
      </h3>
      <p className="text-xs text-foreground-600 font-label mb-5">
        Send {businessName} your details and preferred time. They'll confirm with you directly —
        this doesn't book or charge anything automatically.
      </p>

      <div className="space-y-3">
        <FormField label="Your name" htmlFor="booking-name" required>
          <Input id="booking-name" value={form.name} onChange={update("name")} placeholder="Full name" />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Email" htmlFor="booking-email">
            <Input
              id="booking-email"
              type="email"
              value={form.email}
              onChange={update("email")}
              placeholder="you@email.com"
            />
          </FormField>
          <FormField label="Phone" htmlFor="booking-phone">
            <Input
              id="booking-phone"
              value={form.phone}
              onChange={update("phone")}
              placeholder="+1 (767) 555-0100"
            />
          </FormField>
        </div>
        <p className="text-[11px] text-foreground-500 font-label -mt-1">
          At least one of email or phone, so they can reply.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Preferred date" htmlFor="booking-date">
            <Input
              id="booking-date"
              type="date"
              value={form.preferredDate}
              onChange={update("preferredDate")}
            />
          </FormField>
          <FormField label="Preferred time" htmlFor="booking-time">
            <Input
              id="booking-time"
              type="time"
              value={form.preferredTime}
              onChange={update("preferredTime")}
            />
          </FormField>
        </div>

        <FormField
          label="Anything else?"
          htmlFor="booking-notes"
          hint="Drag the corner to make this box bigger"
        >
          <Textarea
            id="booking-notes"
            rows={3}
            value={form.notes}
            onChange={update("notes")}
            placeholder="What do you need, how many people, any details that help them prepare…"
          />
        </FormField>
      </div>

      {error && (
        <p className="text-xs text-accent-600 font-label mt-3 flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        icon="ri-calendar-check-line"
        iconPosition="left"
        disabled={sending}
        className="w-full mt-4"
      >
        {sending ? "Sending…" : "Send booking request"}
      </Button>
    </form>
  );
}
