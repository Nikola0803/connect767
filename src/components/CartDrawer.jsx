import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem } = useCart();
  const navigate = useNavigate();
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const close = () => setIsOpen(false);

  const goToCheckout = () => {
    close();
    navigate("/checkout");
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground-950/30"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 bg-background-50 shadow-lg transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-background-200/70">
            <h2 className="font-heading text-lg font-semibold text-foreground-950">Cart</h2>
            <button
              aria-label="Close cart"
              type="button"
              onClick={close}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-background-100 mb-4">
                <i className="ri-shopping-cart-2-line text-2xl text-foreground-300" />
              </div>
              <p className="text-foreground-600 text-sm mb-1">Your cart is empty</p>
              <p className="text-foreground-400 text-xs">Add some products to get started!</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {items.map((item) => (
                  <div key={item.key} className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-background-100">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground-950 leading-snug line-clamp-2">
                        {item.title}
                      </h4>
                      {item.variationLabel && (
                        <p className="text-xs text-foreground-500 font-label">
                          {item.variationLabel}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-foreground-500 font-label">
                          Qty {item.qty} · ${item.price.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${item.title}`}
                          onClick={() => removeItem(item.key)}
                          className="text-xs text-foreground-400 hover:text-accent-500 cursor-pointer"
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-background-200/70">
                <div className="flex items-center justify-between mb-4 text-sm">
                  <span className="text-foreground-600 font-label">Subtotal</span>
                  <span className="font-semibold text-foreground-950">${total.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={goToCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer"
                >
                  Checkout
                  <i className="ri-arrow-right-line" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
