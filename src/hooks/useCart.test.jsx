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

  it("tracks the same product with different variations as separate line items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(product, null, 1));
    act(() => result.current.addItem(product, variation, 1));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[1]).toMatchObject({ variationId: 501, price: 22 });
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
