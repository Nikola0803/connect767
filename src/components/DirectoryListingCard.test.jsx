import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DirectoryListingCard from "./DirectoryListingCard";

const listing = {
  slug: "island-bookkeeper",
  title: "Island Bookkeeper",
  categorySlug: "accounting-and-bookkeeping",
  parentCategorySlug: "services",
  industrySlug: "accounting-and-bookkeeping",
  industryLabel: "Accounting & Bookkeeping",
  image: "/bookkeeper.jpg",
  price: "$$",
  location: "Roseau, Dominica",
  reviews: "(0)",
};

describe("DirectoryListingCard parent category", () => {
  it("shows both the parent category and industry in the card header", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={listing} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByTestId("listing-category-industry")).toHaveTextContent(
      "Services · Accounting & Bookkeeping",
    );
    expect(screen.queryByText("Directory profile")).not.toBeInTheDocument();
  });

  it("uses a known industry's parent before stale legacy category data", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{
            ...listing,
            parentCategorySlug: "",
            categorySlug: "other",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Services")).toBeInTheDocument();
  });

  it("uses Other only when no industry can be associated with a parent", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{
            ...listing,
            parentCategorySlug: "",
            categorySlug: "",
            industrySlug: "unknown-industry",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("keeps Other when it is explicitly selected as the parent category", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{
            ...listing,
            parentCategorySlug: "other",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("keeps booking details on the card and removes the cover badge", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{
            ...listing,
            bookingEnabled: true,
            bookingPriceCents: 0,
            bookingDurationMinutes: 30,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Free booking")).not.toBeInTheDocument();
    expect(screen.getByText("Book · Free · 30 min")).toBeInTheDocument();
  });

  it("shows the branded default cover instead of a broken image when no cover was saved", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={{ ...listing, image: "" }} />
      </MemoryRouter>,
    );

    const fallbackCover = screen.getByRole("img", {
      name: "Connect767 default cover for Island Bookkeeper",
    });

    expect(fallbackCover).toBeInTheDocument();
    expect(fallbackCover.parentElement).toHaveClass("aspect-[4/3]");
    expect(fallbackCover.querySelector("img")).toHaveClass("object-cover");
    expect(fallbackCover.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("Dominican-Talent-C-Logo.png"),
    );
    expect(fallbackCover.querySelector("img")).not.toHaveClass("object-contain");
    expect(document.querySelector('img[src=""]')).not.toBeInTheDocument();
  });
});
