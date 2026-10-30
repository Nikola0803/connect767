import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "./useCart";

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

const product = { slug: "classic-tee", title: "Classic Tee", price: 20, image: "tee.jpg" };
const variation = { id: 501, label: "Large / Blue", price: 22, image: "tee-blue.jpg" };

beforeEach(() => {
  localStorage.clear();
});

describe("useCart", () => {
  it("throws when used outside a CartProvider", () => {
    // renderHook swallows the render error into result.error in older APIs,
    // but with React 19 it throws synchronously — assert via a try/catch
    // wrapper so this test itself doesn't fail from the uncaught error.
    expect(() => renderHook(() => useCart())).toThrow("useCart must be used within a CartProvider");
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it("adds a new line item and opens the cart drawer", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ slug: "classic-tee", qty: 1, price: 20 });
    expect(result.current.isOpen).toBe(true);
  });

  it("merges quantity when the same product+variation is added again", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));
    act(() => result.current.addItem(product, null, 2));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].qty).toBe(3);
    expect(result.current.count).toBe(3);
  });

  it("blocks quantities above available stock and shows a stock notice", () => {
    const limitedProduct = { ...product, stockQuantity: 2, backordersAllowed: false };
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(limitedProduct, null, 2));
    let wasAdded;
    act(() => {
      wasAdded = result.current.addItem(limitedProduct, null, 1);
    });

    expect(wasAdded).toBe(false);
    expect(result.current.items[0].qty).toBe(2);
    expect(result.current.stockNotice).toMatchObject({
      title: "Classic Tee",
      available: 2,
      inCart: 2,
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("allows quantities above stock when backorders are enabled", () => {
    const backorderProduct = { ...product, stockQuantity: 1, backordersAllowed: true };
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(backorderProduct, null, 2));

    expect(result.current.items[0].qty).toBe(2);
    expect(result.current.stockNotice).toBeNull();
  });

  it("uses the selected variation's stock limit instead of the parent product total", () => {
    const variableProduct = { ...product, stockQuantity: 10, backordersAllowed: false };
    const limitedLarge = {
      ...variation,
      stockQuantity: 1,
      backordersAllowed: false,
    };
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => result.current.addItem(variableProduct, limitedLarge, 1));
    let wasAdded;
    act(() => {
      wasAdded = result.current.addItem(variableProduct, limitedLarge, 1);
    });

    expect(wasAdded).toBe(false);
    expect(result.current.items[0]).toMatchObject({ variationId: 501, qty: 1 });
    expect(result.current.stockNotice).toMatchObject({ available: 1, inCart: 1 });
  });

  it("tracks the same product with different variations as separate line items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));
    act(() => result.current.addItem(product, variation, 1));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[1]).toMatchObject({ variationId: 501, price: 22 });
  });

  it("changes quantity in the cart without exceeding variation stock", () => {
    const limitedVariation = {
      ...variation,
      stockQuantity: 2,
      backordersAllowed: false,
    };
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, limitedVariation, 1));
    const key = result.current.items[0].key;

    act(() => result.current.updateQuantity(key, 2));
    expect(result.current.items[0].qty).toBe(2);

    let wasUpdated;
    act(() => {
      wasUpdated = result.current.updateQuantity(key, 3);
    });
    expect(wasUpdated).toBe(false);
    expect(result.current.items[0].qty).toBe(2);
    expect(result.current.stockNotice).toMatchObject({ available: 2, inCart: 2 });
  });

  it("changes size in the cart and updates its variation details", () => {
    const large = { ...variation, label: "L", stockQuantity: 1, backordersAllowed: false };
    const medium = {
      id: 502,
      label: "M",
      price: 21,
      image: "tee-medium.jpg",
      stockQuantity: 4,
      backordersAllowed: false,
      inStock: true,
      purchasable: true,
    };
    const variableProduct = {
      ...product,
      variationName: "Size",
      variationOptions: [large, medium],
    };
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(variableProduct, large, 1));
    const largeKey = result.current.items[0].key;

    act(() => result.current.changeVariation(largeKey, 502));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      key: "classic-tee::502",
      variationId: 502,
      variationLabel: "M",
      image: "tee-medium.jpg",
      price: 21,
      stockQuantity: 4,
      qty: 1,
    });
  });

  it("merges cart lines when changing to a size already in the cart", () => {
    const large = { ...variation, label: "L", stockQuantity: 3, backordersAllowed: false };
    const medium = {
      ...variation,
      id: 502,
      label: "M",
      stockQuantity: 3,
      backordersAllowed: false,
    };
    const variableProduct = {
      ...product,
      variationName: "Size",
      variationOptions: [large, medium],
    };
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(variableProduct, large, 1));
    act(() => result.current.addItem(variableProduct, medium, 1));

    act(() => result.current.changeVariation("classic-tee::501", 502));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ variationId: 502, qty: 2 });
  });

  it("removes a line item by key", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));
    const key = result.current.items[0].key;
    act(() => result.current.removeItem(key));

    expect(result.current.items).toEqual([]);
  });

  it("clearCart empties every item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));
    act(() => result.current.addItem(product, variation, 2));
    act(() => result.current.clearCart());

    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it("persists items to localStorage so a refresh doesn't lose the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));

    const stored = JSON.parse(localStorage.getItem("c767_cart_items"));
    expect(stored).toHaveLength(1);
    expect(stored[0].slug).toBe("classic-tee");
  });

  it("loads a persisted cart back in on mount", () => {
    localStorage.setItem(
      "c767_cart_items",
      JSON.stringify([{ key: "classic-tee", slug: "classic-tee", title: "Classic Tee", price: 20, qty: 4, variationId: null }])
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.count).toBe(4);
  });

  it("fails open to an empty cart when localStorage has corrupt JSON", () => {
    localStorage.setItem("c767_cart_items", "{not-valid-json");
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
  });
});
