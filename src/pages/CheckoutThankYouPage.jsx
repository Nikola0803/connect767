import { useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";

export default function CheckoutThankYouPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");
  const localPayment = searchParams.get("payment") === "local-dominica";
  const quoteRequest = searchParams.get("payment") === "quote";

  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14">
      <div className="text-center max-w-lg">
        <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-5">
          <i className="ri-check-line text-2xl" />
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-3">
          {quoteRequest ? "Quote requested" : localPayment ? "Order reserved" : "Order confirmed"}
        </h1>
        <p className="text-sm text-foreground-600 mb-2">
          {quoteRequest ? "Thanks for your request" : "Thanks for your order"}{orderId ? ` — #${orderId}` : ""}. {quoteRequest
            ? "Your order details were sent to the Connect767 team for review."
            : localPayment
            ? "Your order is awaiting local payment in Dominica."
            : "A confirmation email is on its way."}
        </p>
        <p className="text-sm text-foreground-600 mb-8">
          {quoteRequest
            ? "We will contact you with the formal quote. Payment and production have not started."
            : localPayment
            ? "The Connect767 team will email you with the local payment location and instructions before production begins."
            : "We'll let you know as soon as it ships."}
        </p>
        <Button to="/shop" variant="primary">
          Keep shopping
        </Button>
      </div>
    </div>
  );
}
