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
  it("shows only the numeric experience value beneath Yrs Exp.", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={{ ...listing, yearsExperience: "12" }} />
      </MemoryRouter>
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("12 years")).not.toBeInTheDocument();
  });

  it("shows the parent category once and keeps industry in its dedicated field", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={listing} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByTestId("listing-category-industry")).toHaveTextContent("Services");
    expect(screen.getByTestId("listing-category-industry")).not.toHaveTextContent(
      "Accounting & Bookkeeping",
    );
    expect(screen.getByText("Accounting & Bookkeeping")).toBeInTheDocument();
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

  it("shows a rental rate unit instead of an appointment duration", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{
            ...listing,
            bookingEnabled: true,
            bookingType: "rental",
            bookingPriceCents: 20000,
            bookingDurationMinutes: 30,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Book · $200 / night")).toBeInTheDocument();
    expect(screen.queryByText(/30 min/i)).not.toBeInTheDocument();
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

  it("fills the cover frame even when a legacy listing saved contain mode", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={{ ...listing, coverFit: "contain" }} />
      </MemoryRouter>,
    );

    const cover = screen.getByRole("img", { name: /Island Bookkeeper/ });
    expect(cover).toHaveClass("object-cover");
    expect(cover).not.toHaveClass("object-contain");
  });
});
