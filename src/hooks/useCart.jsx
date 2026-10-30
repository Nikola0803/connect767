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

function normalizedStockQuantity(source) {
  return Number.isFinite(source?.stockQuantity)
    ? Math.max(0, source.stockQuantity)
    : null;
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
    const stockQuantity = normalizedStockQuantity(stockSource);
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
          item.key === key
            ? {
                ...item,
                qty: item.qty + qty,
                productImage: product.image || item.productImage || item.image,
                variationName: product.variationName || item.variationName || "",
                variationOptions: product.variationOptions || item.variationOptions || [],
              }
            : item
        )
      : [
          ...currentItems,
          {
            key,
            slug: product.slug,
            variationId: variation?.id || null,
            title: product.title,
            image: variation?.image || product.image,
            productImage: product.image,
            price: variation?.price ?? product.price,
            variationLabel: variation?.label || "",
            variationName: product.variationName || "",
            variationOptions: product.variationOptions || [],
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

  const updateQuantity = (key, quantity) => {
    const currentItems = itemsRef.current;
    const item = currentItems.find((candidate) => candidate.key === key);
    if (!item) return false;

    const nextQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    if (
      item.stockQuantity !== null &&
      item.stockQuantity !== undefined &&
      item.backordersAllowed !== true &&
      nextQuantity > item.stockQuantity
    ) {
      setStockNotice({
        key,
        title: item.title,
        available: item.stockQuantity,
        inCart: item.qty,
      });
      setIsOpen(true);
      return false;
    }

    const nextItems = currentItems.map((candidate) =>
      candidate.key === key ? { ...candidate, qty: nextQuantity } : candidate
    );
    itemsRef.current = nextItems;
    setItems(nextItems);
    setStockNotice(null);
    return true;
  };

  const changeVariation = (key, variationId) => {
    const currentItems = itemsRef.current;
    const item = currentItems.find((candidate) => candidate.key === key);
    if (!item) return false;

    const variation = (item.variationOptions || []).find(
      (option) => Number(option.id) === Number(variationId)
    );
    if (!variation || variation.purchasable === false || variation.inStock === false) {
      setStockNotice({ key, title: item.title, available: 0, inCart: item.qty });
      setIsOpen(true);
      return false;
    }

    const nextKey = lineKey(item.slug, variation.id);
    if (nextKey === key) return true;

    const existingTarget = currentItems.find((candidate) => candidate.key === nextKey);
    const requestedQuantity = item.qty + (existingTarget?.qty || 0);
    const stockQuantity = normalizedStockQuantity(variation);
    if (
      stockQuantity !== null &&
      variation.backordersAllowed !== true &&
      requestedQuantity > stockQuantity
    ) {
      setStockNotice({
        key: nextKey,
        title: item.title,
        available: stockQuantity,
        inCart: existingTarget?.qty || 0,
      });
      setIsOpen(true);
      return false;
    }

    const nextItem = {
      ...(existingTarget || item),
      key: nextKey,
      variationId: variation.id,
      variationLabel: variation.label || "",
      image: variation.image || item.productImage || item.image,
      price: variation.price ?? item.price,
      stockQuantity,
      backordersAllowed: variation.backordersAllowed === true,
      qty: requestedQuantity,
    };
    const insertionIndex = currentItems.findIndex((candidate) => candidate.key === key);
    const nextItems = currentItems.filter(
      (candidate) => candidate.key !== key && candidate.key !== nextKey
    );
    nextItems.splice(Math.max(0, insertionIndex), 0, nextItem);
    itemsRef.current = nextItems;
    setItems(nextItems);
    setStockNotice(null);
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
    updateQuantity,
    changeVariation,
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
