import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DirectoryListingCard from "./DirectoryListingCard";

const baseListing = {
  slug: "island-advisor",
  title: "Island Advisor",
  image: "/advisor.jpg",
  location: "Roseau, Dominica",
  category: "Services",
  industryLabel: "Consulting Services",
  price: "$$",
  reviews: "(0)",
};

function renderCard(listing) {
  return render(
    <MemoryRouter>
      <DirectoryListingCard listing={listing} />
    </MemoryRouter>,
  );
}

describe("DirectoryListingCard category label", () => {
  it("uses the listing category when its category slug is missing or unknown", () => {
    renderCard({ ...baseListing, categorySlug: "legacy-category" });

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.queryByText("Directory profile")).not.toBeInTheDocument();
  });

  it("prefers the canonical top-level category for known slugs", () => {
    renderCard({ ...baseListing, categorySlug: "products", category: "Handmade Jewelry" });

    expect(screen.getByText("Products")).toBeInTheDocument();
  });
});
