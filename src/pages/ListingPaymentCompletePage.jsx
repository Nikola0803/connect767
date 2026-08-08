import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getListingCheckoutSessionStatus } from "../data/repository";
import Button from "../components/ui/Button";
import { Spinner } from "../components/ui/States";

/**
 * Return page for the Classified listing's Checkout Session (`returnUrl`
 * in AddListingPage.jsx's startClassifiedPayment). Stripe redirects the
 * whole browser here after `checkout.confirm()` succeeds — the wizard's
 * own in-memory form state is gone by this point, so this page relies
 * entirely on independently verifying `?session_id=` with the server
 * rather than trusting anything carried over from the previous page.
 */
export default function ListingPaymentCompletePage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState(sessionId ? "checking" : "missing");

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getListingCheckoutSessionStatus(sessionId)
      .then((result) => {
        if (!cancelled) setStatus(result.status === "complete" ? "complete" : "incomplete");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "checking") {
    return <Spinner className="pt-16 md:pt-20 min-h-[70vh]" />;
  }

  const isSuccess = status === "complete";

  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14">
      <div className="text-center max-w-lg">
        <div
          className={`w-14 h-14 mx-auto flex items-center justify-center rounded-full mb-5 ${
            isSuccess ? "bg-primary-100 text-primary-600" : "bg-accent-100 text-accent-600"
          }`}
        >
          <i className={`text-2xl ${isSuccess ? "ri-check-line" : "ri-error-warning-line"}`} />
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-3">
          {isSuccess
            ? "Payment received"
            : status === "incomplete"
            ? "Payment not completed"
            : "Couldn't confirm payment"}
        </h1>
        <p className="text-sm text-foreground-600 mb-8">
          {isSuccess
            ? "Your Classified listing is paid and will be live shortly."
            : status === "incomplete"
            ? "It looks like checkout didn't finish — nothing was charged. You can try submitting again."
            : status === "missing"
            ? "We couldn't find a payment session to check — if you just paid, check your email for confirmation."
            : "We couldn't verify this right away — check your email, or try again in a moment."}
        </p>
        <Button to={isSuccess ? "/listings" : "/listings/submit?tier=classified"} icon="ri-arrow-right-line">
          {isSuccess ? "Browse the directory" : "Back to listing wizard"}
        </Button>
      </div>
    </div>
  );
}
