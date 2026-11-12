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
  it("shows only Classified when the tier also includes featured placement", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{ ...listing, badge: "Classified", isFeatured: true }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Classified")).toBeInTheDocument();
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
  });

  it("shows Featured when it is the listing's standalone promotion", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{ ...listing, badge: "Featured", isFeatured: true }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.queryByText("Classified")).not.toBeInTheDocument();
  });

  it("never shows Featured on a Free listing", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard
          listing={{ ...listing, badge: "Free", isFeatured: true }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(screen.queryByText("Classified")).not.toBeInTheDocument();
  });

  it("shows only the numeric experience value beneath Yrs. Exp.", () => {
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
    expect(fallbackCover.querySelector("img")).toHaveClass("object-cover", "listing-cover-media");
    expect(fallbackCover.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("Dominican-Talent-C-Logo.png"),
    );
    expect(fallbackCover.querySelector("img")).not.toHaveClass("object-contain");
    expect(document.querySelector('img[src=""]')).not.toBeInTheDocument();
  });

  it("uses one uploaded image to fill the directory-card cover frame", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={{ ...listing, coverFit: "contain" }} />
      </MemoryRouter>,
    );

    const cover = screen.getByRole("img", { name: /Island Bookkeeper/ });
    expect(cover).toHaveClass("object-cover", "listing-cover-media");
    expect(cover).not.toHaveClass("object-contain");
    expect(document.querySelectorAll('img[src="/bookkeeper.jpg"]')).toHaveLength(1);
  });

  it("keeps promoted listing badges in front of the cover photo", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={{ ...listing, badge: "Classified" }} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Classified").parentElement).toHaveClass("z-20");
  });

  it.each(["Free", "Classified"])(
    "does not show a share icon on %s directory preview cards",
    (badge) => {
      render(
        <MemoryRouter>
          <DirectoryListingCard listing={{ ...listing, badge }} />
        </MemoryRouter>,
      );

      expect(screen.queryByRole("button", { name: "Share listing" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Save listing|Remove from saved/ })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Island Bookkeeper/i })).toHaveAttribute(
        "href",
        "/listings/island-bookkeeper",
      );
    },
  );
});
