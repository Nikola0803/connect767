import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CartProvider } from "../hooks/useCart";
import ShopPage from "./ShopPage";

vi.mock("../data/repository", () => ({
  getProducts: vi.fn(async () => [
    { id: 1, slug: "ready-kit", title: "Ready Kit", image: "/ready.png", images: [], price: 30, readyMade: true, uniformCategory: "soccer", minimumOrderQuantity: 22, categories: [], tags: [] },
    { id: 2, slug: "shop-shirt", title: "Shop Shirt", image: "/shirt.png", images: [], price: 20, readyMade: false, categories: [], tags: [] },
  ]),
  getShopCategories: vi.fn(async () => []),
}));

describe("ShopPage URL navigation", () => {
  it("leaves Ready-Made mode immediately when the Shop URL removes its category query", async () => {
    render(
      <MemoryRouter initialEntries={["/shop?category=ready-made-designs"]}>
        <CartProvider>
          <Link to="/shop">Open Shop</Link>
          <Routes><Route path="/shop" element={<ShopPage />} /></Routes>
        </CartProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ready-Made Sports")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Open Shop" }));
    await waitFor(() => expect(screen.getByText("The Connect767 Shop")).toBeInTheDocument());
    expect(screen.queryByText("Ready-Made Sports")).not.toBeInTheDocument();
  });
});
