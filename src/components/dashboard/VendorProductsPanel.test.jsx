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
  getMyStorefrontSettings: vi.fn(),
  updateMyStorefrontSettings: vi.fn(),
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
    repository.getMyStorefrontSettings.mockResolvedValue({
      accentColor: "#0f6b4f",
      bookingPayoutMethod: "digital",
      bookingPayoutDigitalProvider: "PayPal",
      bookingPayoutDigitalAccount: "seller@example.com",
      featuredProductIds: [],
      productOrder: [],
    });
    repository.updateMyStorefrontSettings.mockImplementation(async (_id, form) => form);
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

    fireEvent.click(screen.getByRole("tab", { name: /^Products$/i }));
    expect(screen.getByText(/Connect767 retains 10% of each product price/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Payouts/i }));
    expect(await screen.findByText("Island Gift Box")).toBeInTheDocument();
    expect(screen.getByText("−$10.00")).toBeInTheDocument();
    expect(screen.getByText("$102.00")).toBeInTheDocument();
    expect(screen.getByText(/Payout pending/i)).toBeInTheDocument();
  });

  it("warns sellers to configure payouts before offering products", async () => {
    renderPanel({ listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: false }], initialListingId: "7" });

    expect(await screen.findByText(/Open the Payouts tab and add a bank account or digital payout method/i)).toBeInTheDocument();
  });

  it("switches between the storefront management tabs", async () => {
    renderPanel({ listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: true }] });

    fireEvent.click(screen.getByRole("tab", { name: /^Products$/i }));
    expect(screen.getByRole("button", { name: /List a product/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Edit Storefront/i }));
    expect(await screen.findByRole("heading", { name: /Customize storefront/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Payouts/i }));
    expect(await screen.findByRole("heading", { name: /Payout settings/i })).toBeInTheDocument();
  });

  it("opens the add-product form with the active storefront selected", async () => {
    renderPanel({
      listings: [{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: true }],
      initialListingId: "7",
    });

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByText(/one Connect767 storefront, Kalinago Tours/i)).toBeInTheDocument();
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
  });

  it("keeps one storefront when the account owns multiple listings", async () => {
    repository.getMyVendorProducts.mockResolvedValueOnce([
      { id: 41, listingId: 7, name: "Basket", priceCents: 2500, active: true },
    ]);

    renderPanel({
      listings: [
        { id: 7, title: "Kalinago Tours", slug: "kalinago-tours", payoutConfigured: true },
        { id: 8, title: "Second Profile", slug: "second-profile", payoutConfigured: true },
      ],
      initialStorefrontListingId: "8",
    });

    expect(await screen.findByText("Kalinago Tours")).toBeInTheDocument();
    await waitFor(() => expect(repository.getMyStorefrontSettings).toHaveBeenCalledWith("7"));
    expect(screen.queryByText("Second Profile")).not.toBeInTheDocument();
  });
});
