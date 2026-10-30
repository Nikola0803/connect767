import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Cart state used to live entirely inside ShopPage.jsx's own useState —
 * meaning it reset (and the Header had no idea it existed) the moment you
 * navigated to an individual product page or anywhere else. Lifted into a
 * real shared context so "add to cart" works the same and persists
 * everywhere, and a product's specific variation (size/color) is tracked
 * as its own line item rather than merged into the base product.
 *
 * Also persisted to localStorage — before this, the cart was pure
 * in-memory React state with nothing backing it, so it silently emptied
 * on every single page refresh (or closing the tab), which is a real,
 * basic e-commerce expectation to have gotten wrong. Every real online
 * store keeps your cart across a refresh; this didn't.
 */
const CartContext = createContext(null);
const STORAGE_KEY = "c767_cart_items";

function lineKey(slug, variationId) {
  return variationId ? `${slug}::${variationId}` : slug;
}

function loadPersistedItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt JSON, localStorage disabled (private browsing), etc. —
    // fail open to an empty cart rather than crash the whole app.
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadPersistedItems);
  const itemsRef = useRef(items);
  const [isOpen, setIsOpen] = useState(false);
  const [stockNotice, setStockNotice] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* localStorage unavailable — cart just won't survive a refresh in
         that case, same as before this fix, not worse */
    }
  }, [items]);

  const addItem = (product, variation, qty = 1) => {
    const key = lineKey(product.slug, variation?.id);
    const stockSource = variation || product;
    const stockQuantity = Number.isFinite(stockSource?.stockQuantity)
      ? Math.max(0, stockSource.stockQuantity)
      : null;
    const currentItems = itemsRef.current;
    const existingQuantity = currentItems.find((item) => item.key === key)?.qty || 0;
    const requestedQuantity = existingQuantity + qty;

    if (
      stockQuantity !== null &&
      stockSource?.backordersAllowed !== true &&
      requestedQuantity > stockQuantity
    ) {
      setStockNotice({
        key,
        title: product.title,
        available: stockQuantity,
        inCart: existingQuantity,
      });
      setIsOpen(true);
      return false;
    }

    const existing = currentItems.find((item) => item.key === key);
    const nextItems = existing
      ? currentItems.map((item) =>
          item.key === key ? { ...item, qty: item.qty + qty } : item
        )
      : [
          ...currentItems,
          {
            key,
            slug: product.slug,
            variationId: variation?.id || null,
            title: product.title,
            image: variation?.image || product.image,
            price: variation?.price ?? product.price,
            variationLabel: variation?.label || "",
            stockQuantity,
            backordersAllowed: stockSource?.backordersAllowed === true,
            qty,
          },
        ];
    itemsRef.current = nextItems;
    setItems(nextItems);
    setStockNotice(null);
    setIsOpen(true);
    return true;
  };

  const removeItem = (key) => {
    const nextItems = itemsRef.current.filter((item) => item.key !== key);
    itemsRef.current = nextItems;
    setItems(nextItems);
  };
  const clearCart = () => {
    itemsRef.current = [];
    setItems([]);
  };

  const count = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);

  const value = {
    items,
    count,
    isOpen,
    setIsOpen,
    addItem,
    removeItem,
    clearCart,
    stockNotice,
    clearStockNotice: () => setStockNotice(null),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
