import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommunityPage from "./CommunityPage";
import { getMyListings } from "../data/repository";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("../hooks/useAsync", () => {
  const state = { data: { posts: [] }, loading: false, error: null, reload: vi.fn() };
  return { useAsync: () => state };
});

vi.mock("../data/repository", () => ({
  createCommunityComment: vi.fn(),
  createCommunityPost: vi.fn(),
  getCommunityPosts: vi.fn(),
  getListings: vi.fn().mockResolvedValue([]),
  getMyListings: vi.fn(),
  toggleCommunityReaction: vi.fn(),
}));

describe("CommunityPage composer menus", () => {
  beforeEach(() => {
    vi.mocked(getMyListings).mockResolvedValue([
      { id: 42, title: "James Local Fruits", slug: "james-local-fruits", status: "publish" },
    ]);
  });

  it("shows only one attachment or feeling panel at a time", async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);

    const attachButton = await screen.findByRole("button", { name: /attach/i });
    fireEvent.click(attachButton);
    expect(screen.getByRole("menu", { name: "Attach to update" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Feeling/activity" }));
    expect(screen.queryByRole("menu", { name: "Attach to update" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose a feeling or activity" })).toBeInTheDocument();

    fireEvent.click(attachButton);
    expect(screen.getByRole("menu", { name: "Attach to update" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("group", { name: "Choose a feeling or activity" })).not.toBeInTheDocument());
  });
});
