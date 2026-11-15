import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityPage from "./CommunityPage";
import { deleteCommunityPost, getMyListings } from "../data/repository";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("../hooks/useAsync", () => {
  const state = { data: { posts: [{ id: 7, listingId: 42, listingSlug: "james-local-fruits", listingTitle: "James Local Fruits", text: "Fresh fruit today", type: "status", createdAt: new Date().toISOString(), comments: [] }] }, loading: false, error: null, reload: vi.fn() };
  return { useAsync: () => state };
});

vi.mock("../data/repository", () => ({
  createCommunityComment: vi.fn(),
  createCommunityPost: vi.fn(),
  deleteCommunityPost: vi.fn().mockResolvedValue({ deleted: true }),
  getCommunityPosts: vi.fn(),
  getListings: vi.fn().mockResolvedValue([]),
  getMyListings: vi.fn(),
  reportCommunityPost: vi.fn().mockResolvedValue({ reported: true }),
  toggleCommunityReaction: vi.fn(),
  updateCommunityPost: vi.fn().mockResolvedValue({ id: 7, text: "Updated post" }),
}));

describe("CommunityPage composer menus", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getMyListings).mockResolvedValue([
      { id: 42, title: "James Local Fruits", slug: "james-local-fruits", status: "publish" },
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

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

  it("provides owner post options and deletes only after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Post options" }));
    expect(screen.getByRole("menuitem", { name: "Save post" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy post link" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Hide this post" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit post" })).toBeInTheDocument();

    const deleteButton = await screen.findByRole("menuitem", { name: "Delete post" });
    fireEvent.click(deleteButton);
    await waitFor(() => expect(deleteCommunityPost).toHaveBeenCalledWith(7));
  });
});
