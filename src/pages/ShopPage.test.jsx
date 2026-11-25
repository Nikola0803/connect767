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
  getShopCategories: vi.fn(async () => [
    { slug: "all", label: "All Products", icon: "ri-store-3-line" },
    { slug: "ready-made-designs", label: "Ready-Made Designs", icon: "ri-layout-grid-line" },
  ]),
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
    expect(screen.getByText("Ready Kit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Open Shop" }));
    await waitFor(() => expect(screen.getByText("The Connect767 Shop")).toBeInTheDocument());
    expect(screen.queryByText("Ready-Made Sports")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready Kit")).not.toBeInTheDocument();
    expect(screen.getByText("Shop Shirt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pre-Design Uniforms" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ready-Made Designs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Design Uniforms" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open cart" })).not.toBeInTheDocument();
  });

  it("includes matching pre-designed uniforms in a global shop search", async () => {
    render(
      <MemoryRouter initialEntries={["/shop?q=pre-design"]}>
        <CartProvider>
          <Routes><Route path="/shop" element={<ShopPage />} /></Routes>
        </CartProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ready Kit")).toBeInTheDocument();
    expect(screen.queryByText("Shop Shirt")).not.toBeInTheDocument();
  });

  it("continues hiding pre-designed uniforms from the unsearched shop grid", async () => {
    render(
      <MemoryRouter initialEntries={["/shop"]}>
        <CartProvider>
          <Routes><Route path="/shop" element={<ShopPage />} /></Routes>
        </CartProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Shop Shirt")).toBeInTheDocument();
    expect(screen.queryByText("Ready Kit")).not.toBeInTheDocument();
  });
});
