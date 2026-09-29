import { useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";

export default function CheckoutThankYouPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order");

  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14">
      <div className="text-center max-w-lg">
        <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-5">
          <i className="ri-check-line text-2xl" />
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-3">
          Order confirmed
        </h1>
        <p className="text-sm text-foreground-600 mb-2">
          Thanks for your order{orderId ? ` — #${orderId}` : ""}. A confirmation email is on its
          way.
        </p>
        <p className="text-sm text-foreground-600 mb-8">
          We'll let you know as soon as it ships.
        </p>
        <Button to="/shop" variant="primary">
          Keep shopping
        </Button>
      </div>
    </div>
  );
}
