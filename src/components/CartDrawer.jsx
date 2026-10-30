import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    setIsOpen,
    removeItem,
    updateQuantity,
    changeVariation,
    stockNotice,
    clearStockNotice,
  } = useCart();
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
        className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] z-50 bg-background-50 shadow-lg transform transition-transform duration-300 ${
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

          {stockNotice && (
            <div
              role="alert"
              className="mx-5 mt-4 flex gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4 text-accent-950"
            >
              <i className="ri-information-line mt-0.5 text-lg text-accent-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Only {stockNotice.available} available</p>
                <p className="mt-1 text-xs leading-relaxed text-accent-800">
                  {stockNotice.inCart > 0
                    ? `${stockNotice.inCart} ${stockNotice.inCart === 1 ? "item is" : "items are"} already in your cart. You can’t add more ${stockNotice.title} than the available stock.`
                    : `${stockNotice.title} is currently unavailable in the quantity requested.`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss stock notice"
                onClick={clearStockNotice}
                className="h-7 w-7 flex-shrink-0 rounded-full text-accent-700 hover:bg-accent-100 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          )}

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
                  <div
                    key={item.key}
                    className="flex gap-3 rounded-xl border border-background-200/70 bg-white p-3"
                  >
                    <div className="w-20 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-background-100">
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
                      <p className="mt-0.5 text-xs text-foreground-500 font-label">
                        ${item.price.toFixed(2)} each
                      </p>
                      {item.variationOptions?.length > 0 && (
                        <label className="mt-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">
                          {item.variationName || "Size"}
                          <select
                            aria-label={`${item.variationName || "Size"} for ${item.title}`}
                            value={item.variationId || ""}
                            onChange={(event) => changeVariation(item.key, event.target.value)}
                            className="mt-1 h-9 w-full rounded-lg border border-background-300 bg-background-50 px-2 text-xs font-semibold normal-case tracking-normal text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                          >
                            {item.variationOptions.map((option) => (
                              <option
                                key={option.id}
                                value={option.id}
                                disabled={option.inStock === false || option.purchasable === false}
                              >
                                {option.label}
                                {option.inStock === false ? " — Sold out" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div
                          className="inline-flex h-9 items-center rounded-lg border border-background-300 bg-background-50"
                          aria-label={`Quantity for ${item.title}`}
                        >
                          <button
                            type="button"
                            aria-label={`Decrease ${item.title} quantity`}
                            disabled={item.qty <= 1}
                            onClick={() => updateQuantity(item.key, item.qty - 1)}
                            className="h-full w-8 rounded-l-lg text-foreground-700 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-35 cursor-pointer"
                          >
                            <i className="ri-subtract-line" />
                          </button>
                          <span className="min-w-7 text-center text-xs font-bold text-foreground-900" aria-live="polite">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase ${item.title} quantity`}
                            onClick={() => updateQuantity(item.key, item.qty + 1)}
                            className="h-full w-8 rounded-r-lg text-foreground-700 hover:bg-background-100 cursor-pointer"
                          >
                            <i className="ri-add-line" />
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${item.title}`}
                          onClick={() => removeItem(item.key)}
                          className="h-9 w-9 rounded-lg text-sm text-foreground-400 hover:bg-accent-50 hover:text-accent-500 cursor-pointer"
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-background-200/70">
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
