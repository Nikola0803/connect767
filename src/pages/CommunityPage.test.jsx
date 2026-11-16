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
  toggleCommunityBookmark: vi.fn().mockResolvedValue({ bookmarked: true }),
  toggleCommunityFollow: vi.fn().mockResolvedValue({ following: true }),
  toggleCommunityReaction: vi.fn(),
  toggleCommunityRepost: vi.fn().mockResolvedValue({ reposted: true, count: 1 }),
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

    const composer = await screen.findByLabelText("Status update. Type @ to mention a business.");
    expect(screen.queryByRole("button", { name: /attach/i })).not.toBeInTheDocument();
    expect(composer).toHaveAttribute("aria-expanded", "false");
    fireEvent.focus(composer);
    expect(composer).toHaveAttribute("aria-expanded", "true");
    const attachButton = await screen.findByRole("button", { name: /attach/i });
    fireEvent.click(attachButton);
    expect(screen.getByRole("menu", { name: "Attach to update" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Feeling" }));
    expect(screen.queryByRole("menu", { name: "Attach to update" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose a feeling or activity" })).toBeInTheDocument();

    fireEvent.click(attachButton);
    expect(screen.getByRole("menu", { name: "Attach to update" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("group", { name: "Choose a feeling or activity" })).not.toBeInTheDocument());
  });

  it("keeps every mobile feed filter and composer mode interactive", async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    const composer = await screen.findByLabelText("Status update. Type @ to mention a business.");
    const consolidatedFilters = screen.getByRole("region", { name: "Community feed filters" });
    expect(consolidatedFilters).toContainElement(screen.getByRole("button", { name: "Feed view: For you" }));
    expect(consolidatedFilters).toContainElement(screen.getByRole("button", { name: "Post type: All Posts" }));

    for (const label of ["Following", "Latest", "Trending", "Businesses", "Community", "For you"]) {
      fireEvent.click(screen.getByRole("button", { name: /^Feed view:/ }));
      fireEvent.click(screen.getByRole("menuitemradio", { name: label }));
      expect(screen.getByRole("button", { name: `Feed view: ${label}` })).toHaveAttribute("aria-expanded", "false");
    }

    for (const label of ["Offers", "Opportunities", "Events", "Announcements", "Requests", "All Posts"]) {
      fireEvent.click(screen.getByRole("button", { name: /^Post type:/ }));
      fireEvent.click(screen.getByRole("menuitemradio", { name: label }));
      expect(screen.getByRole("button", { name: `Post type: ${label}` })).toHaveAttribute("aria-expanded", "false");
    }

    fireEvent.click(screen.getByRole("button", { name: "Feed view: For you" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Community" }));
    fireEvent.click(screen.getByRole("button", { name: "Post type: All Posts" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Requests" }));
    expect(screen.getByRole("button", { name: "Feed view: For you" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post type: Requests" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Offer" })).not.toBeInTheDocument();
    fireEvent.change(composer, { target: { value: "Fresh fruit boxes available today" } });
    const offerButton = await screen.findByRole("button", { name: "Offer" });
    fireEvent.click(offerButton);
    expect(offerButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText(/Describe your offer/i)).toBeInTheDocument();
    expect(screen.getByText("Offer details")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "$25" } });
    expect(screen.getByLabelText("Price")).toHaveValue("$25");

    expect(screen.getByRole("button", { name: "Post offer" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Announcement" }));
    expect(screen.getByPlaceholderText(/important announcement/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(screen.getByPlaceholderText(/what you need/i)).toBeInTheDocument();
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
    const composer = screen.getByLabelText("Status update. Type @ to mention a business.");
    fireEvent.change(composer, { target: { value: "@sadick", selectionStart: 7 } });

    const result = await screen.findByRole("option", { name: /Sadick Eustache/i });
    expect(result.querySelector("img")).toHaveAttribute("src", "https://connect767.com/sadick-profile.jpg");
    fireEvent.click(result);
    expect(composer).toHaveValue("@Sadick Eustache ");
  });

  it("adds the directory-wide audience tag from @@everyone", async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);

    const composer = await screen.findByLabelText("Status update. Type @ to mention a business.");
    fireEvent.change(composer, { target: { value: "New opportunity @@ever", selectionStart: 22 } });

    const everyone = await screen.findByRole("option", { name: /@everyone/i });
    fireEvent.click(everyone);
    expect(composer).toHaveValue("New opportunity @everyone ");
    expect(screen.getByText("everyone")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove everyone" }));
    expect(composer).toHaveValue("New opportunity ");
    expect(screen.queryByRole("button", { name: "Remove everyone" })).not.toBeInTheDocument();
  });

  it("exits the mention picker without tagging anyone", async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);

    const composer = await screen.findByLabelText("Status update. Type @ to mention a business.");
    fireEvent.change(composer, { target: { value: "@ev", selectionStart: 3 } });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel mention without tagging" }));
    expect(composer).toHaveValue("");
    expect(screen.queryByRole("listbox", { name: "Directory listing suggestions" })).not.toBeInTheDocument();

    fireEvent.change(composer, { target: { value: "Before @high", selectionStart: 12 } });
    fireEvent.keyDown(composer, { key: "Escape" });
    expect(composer).toHaveValue("Before ");
    expect(screen.queryByRole("listbox", { name: "Directory listing suggestions" })).not.toBeInTheDocument();
  });

  it("allows document attachments on every post type", async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);

    fireEvent.focus(await screen.findByLabelText("Status update. Type @ to mention a business."));
    fireEvent.click(await screen.findByRole("button", { name: "Offer" }));
    fireEvent.click(screen.getByRole("button", { name: /attach/i }));
    expect(screen.getByRole("menuitem", { name: /File PDF, Word, Excel/i })).toBeInTheDocument();

    const documentFile = new File(["job-description"], "job-description.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Attach a document"), { target: { files: [documentFile] } });
    expect(screen.getByText("job-description.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /File added/i })).toBeInTheDocument();

    for (const postType of ["General Post", "Announcement", "Request", "Event", "Opportunity"]) {
      fireEvent.click(screen.getByRole("button", { name: postType }));
      expect(screen.getByText("job-description.pdf")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /File added/i }));
      expect(screen.getByRole("menuitem", { name: /File PDF, Word, Excel/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /File added/i }));
    }
  });
});
