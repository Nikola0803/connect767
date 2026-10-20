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
  it("shows the parent category selected by the listing form", () => {
    render(
      <MemoryRouter>
        <DirectoryListingCard listing={listing} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.queryByText("Directory profile")).not.toBeInTheDocument();
  });
});
