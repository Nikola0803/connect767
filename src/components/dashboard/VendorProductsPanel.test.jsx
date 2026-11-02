import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VendorProductsPanel from "./VendorProductsPanel";

const repository = vi.hoisted(() => ({
  getMyVendorProducts: vi.fn(),
  createVendorProduct: vi.fn(),
  updateVendorProduct: vi.fn(),
  deleteVendorProduct: vi.fn(),
  getMyVendorOrders: vi.fn(),
  getMyVendorAnalytics: vi.fn(),
  updateMyVendorOrder: vi.fn(),
}));

vi.mock("../../data/repository", () => repository);

describe("VendorProductsPanel storefront fees", () => {
  const renderPanel = (props) => render(<MemoryRouter><VendorProductsPanel {...props} /></MemoryRouter>);

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    repository.getMyVendorProducts.mockResolvedValue([]);
    repository.getMyVendorAnalytics.mockResolvedValue({
      storeViews: 12,
      productViews: 24,
      paidOrders: 1,
      payoutsCents: 10200,
    });
    repository.updateMyVendorOrder.mockResolvedValue({ updated: true });
    repository.getMyVendorOrders.mockResolvedValue([
      {
        id: 91,
        productName: "Island Gift Box",
        buyerName: "Buyer",
        buyerEmail: "buyer@example.com",
        amountCents: 11200,
        productAmountCents: 10000,
        shippingFeeCents: 1200,
        platformFeePercent: 10,
        platformFeeAmountCents: 1000,
        ownerPayoutAmountCents: 10200,
        ownerPayoutStatus: "pending",
        fulfillmentMethod: "shipping",
        shippingAddress: {},
      },
    ]);
  });

  it("discloses the fee and shows the seller's net payout", async () => {
    renderPanel({ listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: true }] });

    expect(screen.getByText(/Connect767 retains 10% of each product price/i)).toBeInTheDocument();
    expect(await screen.findByText("Island Gift Box")).toBeInTheDocument();
    expect(screen.getByText("−$10.00")).toBeInTheDocument();
    expect(screen.getAllByText("$102.00")).toHaveLength(2);
    expect(screen.getByText(/Payout pending/i)).toBeInTheDocument();
  });

  it("warns sellers to configure payouts before offering products", async () => {
    renderPanel({ listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: false }], initialListingId: "7" });

    expect(await screen.findByText(/add its bank account or digital payout details/i)).toBeInTheDocument();
  });

  it("opens dashboard sections and routes reviews to the storefront", async () => {
    renderPanel({ listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: true }] });

    fireEvent.click(await screen.findByRole("button", { name: /My Products/i }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(screen.getByRole("link", { name: /Reviews/i })).toHaveAttribute("href", "/listings/kalinago-tours/shop?tab=reviews");
    expect(screen.getByRole("link", { name: /Inquiries/i })).toHaveAttribute("href", "/messages");
  });

  it("opens the add-product form with the active storefront selected", async () => {
    renderPanel({
      listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: true }],
      initialListingId: "7",
    });

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Listing")).toHaveValue("7");
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
  });
});
