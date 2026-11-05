import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StorefrontCustomizer from "./StorefrontCustomizer";

const repository = vi.hoisted(() => ({
  getMyStorefrontSettings: vi.fn(),
  updateMyStorefrontSettings: vi.fn(),
}));

vi.mock("../../data/repository", () => repository);

describe("StorefrontCustomizer", () => {
  beforeEach(() => {
    repository.getMyStorefrontSettings.mockResolvedValue({
      headline: "Island-made essentials",
      welcomeText: "Welcome to our store.",
      accentColor: "#245c48",
      aboutText: "Made in Dominica.",
      shippingMessage: "Ships island-wide or collect in Roseau.",
      policies: "Returns within seven days.",
      productGrid: "3",
      imageRatio: "portrait",
      cardCorners: "soft",
      contentWidth: "wide",
      defaultTab: "overview",
      bookingPayoutMethod: "digital",
      bookingPayoutDigitalProvider: "PayPal",
      bookingPayoutDigitalAccount: "payments@example.com",
      featuredProductIds: [11],
      productOrder: [12, 11],
    });
    repository.updateMyStorefrontSettings.mockImplementation(async (_id, form) => form);
  });

  it("loads owner settings, previews changes, and publishes them", async () => {
    render(
      <StorefrontCustomizer
        initialListingId="7"
        listings={[{ id: 7, title: "Kalinago Tours", slug: "kalinago-tours" }]}
        products={[
          { id: 11, listingId: 7, name: "Basket" },
          { id: 12, listingId: 7, name: "Cocoa tea" },
        ]}
      />,
    );

    expect(await screen.findByDisplayValue("Welcome to our store.")).toBeInTheDocument();
    expect(screen.queryByText("Store logo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choose storefront logo image")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choose storefront banner image")).not.toBeInTheDocument();
    expect(screen.queryByText("Reposition storefront banner")).not.toBeInTheDocument();
    expect(screen.queryByText(/Where should we send your storefront payouts/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Storefront text"), { target: { value: "Discover Kalinago craft" } });
    fireEvent.change(screen.getByLabelText("Product columns"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Product image shape"), { target: { value: "landscape" } });
    fireEvent.change(screen.getByLabelText("Card corners"), { target: { value: "square" } });
    fireEvent.change(screen.getByLabelText("Page width"), { target: { value: "standard" } });
    fireEvent.change(screen.getByLabelText("First tab visitors see"), { target: { value: "products" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(screen.getByTitle("Full storefront preview")).toHaveAttribute("src", expect.stringContaining("/listings/kalinago-tours/shop?designPreview=1"));
    expect(screen.getByTitle("Full storefront preview")).toHaveAttribute("src", expect.stringContaining("previewKey="));
    const previewStorageKey = Object.keys(window.localStorage).find((key) => key.startsWith("connect767-storefront-preview:kalinago-tours:"));
    expect(previewStorageKey).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(previewStorageKey)).settings).toEqual(expect.objectContaining({
      productGrid: "4",
      imageRatio: "landscape",
      cardCorners: "square",
      contentWidth: "standard",
      defaultTab: "products",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));

    await waitFor(() => expect(repository.updateMyStorefrontSettings).toHaveBeenCalledWith(
      "7",
      expect.objectContaining({
        welcomeText: "Discover Kalinago craft",
        productOrder: [12, 11],
        bookingPayoutMethod: "digital",
        productGrid: "4",
        imageRatio: "landscape",
        cardCorners: "square",
        contentWidth: "standard",
        defaultTab: "products",
      }),
    ));
    expect(await screen.findByText("Storefront design published.")).toBeInTheDocument();
  });

  it("opens the selected storefront directly from the dashboard edit action", async () => {
    render(
      <StorefrontCustomizer
        initialListingId="7"
        listings={[{ id: 7, title: "Kalinago Tours" }]}
        products={[]}
      />,
    );

    expect(screen.getByText("Kalinago Tours")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Welcome to our store.")).toBeInTheDocument();
    expect(repository.getMyStorefrontSettings).toHaveBeenCalledWith("7");
  });

  it("shows payout controls only in the payout section", async () => {
    render(
      <StorefrontCustomizer
        mode="payouts"
        initialListingId="7"
        listings={[{ id: 7, title: "Kalinago Tours" }]}
        products={[]}
      />,
    );

    expect(await screen.findByText(/Where should we send your storefront payouts/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Digital payment/i })).toBeChecked();
    expect(screen.queryByLabelText("Storefront text")).not.toBeInTheDocument();
  });
});
