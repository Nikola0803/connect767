import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ListingProducts from "./ListingProducts";

const products = [
  { id: 1, name: "Island Gift Box", description: "A curated local collection", priceCents: 7200, imageUrl: "" },
  { id: 2, name: "Heritage Basket", description: "Handmade in Dominica", priceCents: 8800, imageUrl: "" },
];

describe("ListingProducts", () => {
  it("shows a profile storefront only when active products are supplied", () => {
    const onAvailabilityChange = vi.fn();
    render(
      <MemoryRouter>
        <ListingProducts
          slug="kalinago-tours"
          listingTitle="Kalinago Tours"
          initialProducts={products}
          onAvailabilityChange={onAvailabilityChange}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /products from kalinago tours/i })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /open the complete storefront/i })).toHaveAttribute(
      "href",
      "/listings/kalinago-tours/shop",
    );
    expect(onAvailabilityChange).toHaveBeenCalledWith(true);
  });

  it("renders no storefront when the listing has no products", () => {
    const { container } = render(
      <MemoryRouter>
        <ListingProducts slug="empty-listing" initialProducts={[]} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
