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
      coverUrl: "/cover.jpg",
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
        listings={[{ id: 7, title: "Kalinago Tours" }]}
        products={[
          { id: 11, listingId: 7, name: "Basket" },
          { id: 12, listingId: 7, name: "Cocoa tea" },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose a storefront"), { target: { value: "7" } });
    expect(await screen.findByDisplayValue("Island-made essentials")).toBeInTheDocument();
    expect(screen.queryByText("Store logo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choose storefront logo image")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Choose storefront banner image")).toBeInTheDocument();
    expect(screen.getByText(/Where should we send your storefront payouts/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Digital payment/i })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Banner headline"), { target: { value: "Discover Kalinago craft" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(screen.getByText("Discover Kalinago craft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));

    await waitFor(() => expect(repository.updateMyStorefrontSettings).toHaveBeenCalledWith(
      "7",
      expect.objectContaining({
        headline: "Discover Kalinago craft",
        productOrder: [12, 11],
        bookingPayoutMethod: "digital",
      }),
    ));
    expect(await screen.findByText("Storefront design published.")).toBeInTheDocument();
  });
});
