import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DirectoryPage from "./DirectoryPage";

vi.mock("../components/DirectoryListingCard", () => ({
  default: ({ listing }) => <article data-testid="directory-card">{listing.title}</article>,
}));

vi.mock("../data/repository", () => ({
  getDirectoryCategories: vi.fn(async () => [
    { slug: "all", label: "All Categories" },
  ]),
  getListings: vi.fn(async () => [
    {
      id: 1,
      slug: "older-premium-listing",
      title: "Older Premium Listing",
      dateCreated: "2026-09-01T12:00:00Z",
      price: "$$$",
      rating: "5",
      reviewCount: 30,
    },
    {
      id: 2,
      slug: "newest-budget-listing",
      title: "Newest Budget Listing",
      dateCreated: "2026-11-24T12:00:00Z",
      price: "$",
      rating: "3",
      reviewCount: 2,
    },
  ]),
}));

function cardTitles() {
  return screen.getAllByTestId("directory-card").map((card) => card.textContent);
}

describe("DirectoryPage sorting", () => {
  it("defaults to Newest and reorders the visible cards when another option is selected", async () => {
    render(<MemoryRouter initialEntries={["/listings"]}><DirectoryPage /></MemoryRouter>);

    const sort = await screen.findByRole("combobox", { name: "Sort" });
    await waitFor(() => expect(screen.getAllByTestId("directory-card")).toHaveLength(2));

    expect(sort).toHaveValue("newest");
    expect(cardTitles()).toEqual(["Newest Budget Listing", "Older Premium Listing"]);

    fireEvent.change(sort, { target: { value: "price-high" } });
    expect(sort).toHaveValue("price-high");
    expect(cardTitles()).toEqual(["Older Premium Listing", "Newest Budget Listing"]);
  });
});
