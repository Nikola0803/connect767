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
  });

  it("applies an optional signup-only visual scale", () => {
    const { container } = render(
      <MemoryRouter>
        <ListingTierCards scale={0.7} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toHaveAttribute("data-visual-scale", "0.7");
  });
});
