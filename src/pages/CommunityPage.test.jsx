import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityPage, { listingAvatar } from "./CommunityPage";
import { deleteCommunityPost, getListings, getMyListings } from "../data/repository";

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
      { id: 42, title: "James Local Fruits", slug: "james-local-fruits", status: "publish", logo: "", coverPhoto: "https://connect767.com/james-cover.jpg" },
    ]);
    vi.mocked(getListings).mockResolvedValue([
      { id: 84, title: "Sadick Eustache", slug: "sadick-eustache", status: "publish", logo: "https://connect767.com/sadick-profile.jpg", location: "Houston, Texas" },
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

  it("uses the cover photo when a listing has no profile image and supports inline directory tags", async () => {
    expect(listingAvatar({ logo: "", coverPhoto: "cover.jpg", image: "fallback.jpg" })).toBe("cover.jpg");
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);

    expect(await screen.findByAltText("James Local Fruits profile")).toHaveAttribute("src", "https://connect767.com/james-cover.jpg");
    const composer = screen.getByPlaceholderText(/Share a business update from James Local Fruits/i);
    fireEvent.change(composer, { target: { value: "@sadick", selectionStart: 7 } });

    const result = await screen.findByRole("option", { name: /Sadick Eustache/i });
    expect(result.querySelector("img")).toHaveAttribute("src", "https://connect767.com/sadick-profile.jpg");
    fireEvent.click(result);
    expect(composer).toHaveValue("@Sadick Eustache ");
  });
});
