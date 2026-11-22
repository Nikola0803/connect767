import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ListingTierCards from "./ListingTierCards";

describe("ListingTierCards", () => {
  it("links each homepage plan to the matching listing tier", () => {
    render(
      <MemoryRouter>
        <ListingTierCards />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Start Free/i })).toHaveAttribute(
      "href",
      "/listings/submit?tier=free",
    );
    expect(screen.getByRole("link", { name: /Go Classified/i })).toHaveAttribute(
      "href",
      "/listings/submit?tier=classified",
    );
    expect(screen.getAllByRole("button", { name: "Share" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Connect767 listing plans" })).toBeInTheDocument();
    expect(screen.getAllByText("Connect767 Built-in Storefront")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    const shareMenu = screen.getByRole("menu");
    expect(shareMenu).toHaveAttribute("data-placement", "top");
    expect(screen.getByRole("menuitem", { name: "Text message" })).toBeInTheDocument();
  });

  it("selects a plan in the listing form", () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <ListingTierCards selectedTier="free" onSelect={onSelect} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Classified" }));
    expect(onSelect).toHaveBeenCalledWith("classified");
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
  });

  it("applies an optional signup-only visual scale", () => {
    const { container } = render(
      <MemoryRouter>
        <ListingTierCards scale={0.7} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toHaveAttribute("data-visual-scale", "0.7");
  });

  it("expands the feature details for both signup plans independently", () => {
    render(
      <MemoryRouter>
        <ListingTierCards compact selectedTier="free" onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    const freeDetails = screen.getByRole("button", { name: "View Free Listing plan details" });
    const classifiedDetails = screen.getByRole("button", { name: "View Classified plan details" });

    fireEvent.click(freeDetails);
    expect(freeDetails).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1 listing")).toBeVisible();

    fireEvent.click(classifiedDetails);
    expect(classifiedDetails).toHaveAttribute("aria-expanded", "true");
    expect(freeDetails).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Up to 15 listings")).toBeVisible();
  });
});
