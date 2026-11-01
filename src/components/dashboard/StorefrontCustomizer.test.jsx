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
      logoUrl: "/logo.jpg",
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
    fireEvent.change(screen.getByLabelText("Banner headline"), { target: { value: "Discover Kalinago craft" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(screen.getByText("Discover Kalinago craft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));

    await waitFor(() => expect(repository.updateMyStorefrontSettings).toHaveBeenCalledWith(
      "7",
      expect.objectContaining({ headline: "Discover Kalinago craft", productOrder: [12, 11] }),
    ));
    expect(await screen.findByText("Storefront design published.")).toBeInTheDocument();
  });
});
