import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  customClient: { get: vi.fn(), post: vi.fn(), del: vi.fn() },
  wpClient: { get: vi.fn(), post: vi.fn() },
  wcStoreClient: { get: vi.fn() },
}));

vi.mock("../lib/config", () => ({ isLiveApi: true }));
vi.mock("../lib/apiClient", () => ({
  ...api,
  getStoredUser: vi.fn(),
}));

import { createCommunityPost, deleteCommunityPost, getCommunityPosts, reportCommunityPost, toggleCommunityBookmark, toggleCommunityFollow, toggleCommunityReaction, toggleCommunityRepost, updateCommunityPost } from "./repository";

describe("community post publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.customClient.post.mockResolvedValue({ id: 42 });
  });

  it("keeps text-only updates as JSON payloads", async () => {
    const payload = { listingId: 12, text: "Fresh fruit today", type: "status", emotion: "excited" };

    await createCommunityPost(payload);

    expect(api.customClient.post).toHaveBeenCalledWith("/community/posts", payload);
  });

  it("uses multipart form data when an image is attached", async () => {
    const image = new File(["image-bytes"], "market.webp", { type: "image/webp" });

    await createCommunityPost({
      listingId: 12,
      text: "Fresh fruit today",
      type: "offer",
      emotion: "proud",
      activity: "",
      postLocation: "Roseau Market",
      latitude: 15.301,
      longitude: -61.388,
      mentions: [{ id: 44, slug: "island-delivery", title: "Island Delivery" }],
      image,
    });

    const [, form] = api.customClient.post.mock.calls[0];
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("listingId")).toBe("12");
    expect(form.get("text")).toBe("Fresh fruit today");
    expect(form.get("type")).toBe("offer");
    expect(form.get("emotion")).toBe("proud");
    expect(form.get("postLocation")).toBe("Roseau Market");
    expect(form.get("latitude")).toBe("15.301");
    expect(form.get("longitude")).toBe("-61.388");
    expect(JSON.parse(form.get("mentions"))).toEqual([{ id: 44, slug: "island-delivery", title: "Island Delivery" }]);
    expect(form.get("image")).toBe(image);
  });

  it("uses multipart form data when a video is attached", async () => {
    const video = new File(["video-bytes"], "shop-tour.mp4", { type: "video/mp4" });

    await createCommunityPost({
      listingId: 12,
      text: "Take a quick look inside our shop",
      type: "status",
      video,
    });

    const [, form] = api.customClient.post.mock.calls[0];
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("listingId")).toBe("12");
    expect(form.get("text")).toBe("Take a quick look inside our shop");
    expect(form.get("video")).toBe(video);
    expect(form.get("image")).toBeNull();
  });

  it("uses multipart form data when a document is attached", async () => {
    const file = new File(["job-description"], "job-description.pdf", { type: "application/pdf" });

    await createCommunityPost({
      listingId: 12,
      text: "We are hiring",
      type: "status",
      mentions: [{ id: 0, slug: "everyone", title: "Everyone in the directory", audience: "directory" }],
      file,
    });

    const [, form] = api.customClient.post.mock.calls[0];
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("file")).toBe(file);
    expect(form.get("image")).toBeNull();
    expect(form.get("video")).toBeNull();
    expect(JSON.parse(form.get("mentions"))).toEqual([{ id: 0, slug: "everyone", title: "Everyone in the directory", audience: "directory" }]);
  });

  it("keeps link updates as JSON payloads", async () => {
    const payload = {
      listingId: 12,
      text: "See our updated menu",
      type: "offer",
      linkUrl: "https://example.com/menu",
    };

    await createCommunityPost(payload);

    expect(api.customClient.post).toHaveBeenCalledWith("/community/posts", payload);
  });

  it("keeps live location visible when an older CMS response omits it", async () => {
    api.customClient.post.mockResolvedValueOnce({
      id: 42,
      text: "Fresh fruit today",
      type: "status",
    });
    const payload = {
      listingId: 12,
      text: "Fresh fruit today",
      type: "status",
      postLocation: "Live location · 15.3010, -61.3880",
      latitude: 15.301,
      longitude: -61.388,
      mentions: [],
    };

    const created = await createCommunityPost(payload);

    expect(created).toMatchObject({
      id: 42,
      postLocation: "Live location · 15.3010, -61.3880",
      latitude: 15.301,
      longitude: -61.388,
    });
  });

  it("keeps the selected listing profile image when an older CMS response omits it", async () => {
    api.customClient.post.mockResolvedValueOnce({ id: 43, text: "Fresh fruit today" });

    const created = await createCommunityPost({
      listingId: 12,
      text: "Fresh fruit today",
      type: "status",
      listingLogo: "https://connect767.com/uploads/james-local-fruits.webp",
    });

    expect(created.listingLogo).toBe("https://connect767.com/uploads/james-local-fruits.webp");
  });

  it("sends the selected unified reaction type", async () => {
    await toggleCommunityReaction(42, "love");
    await toggleCommunityReaction(42, "insightful");

    expect(api.customClient.post).toHaveBeenNthCalledWith(1, "/community/posts/42/reactions", { type: "love" });
    expect(api.customClient.post).toHaveBeenNthCalledWith(2, "/community/posts/42/reactions", { type: "insightful" });
  });

  it("uses protected post-management endpoints", async () => {
    api.customClient.del.mockResolvedValueOnce({ deleted: true, id: 42 });

    await deleteCommunityPost(42);
    await reportCommunityPost(42, "spam");
    await updateCommunityPost(42, "Updated message");

    expect(api.customClient.del).toHaveBeenCalledWith("/community/posts/42");
    expect(api.customClient.post).toHaveBeenCalledWith("/community/posts/42/reports", { reason: "spam" });
    expect(api.customClient.post).toHaveBeenCalledWith("/community/posts/42", { text: "Updated message" });
  });

  it("passes feed filters and persists social relationship actions", async () => {
    api.customClient.get.mockResolvedValueOnce({ posts: [], tab: "following" });

    await getCommunityPosts({ tab: "following", type: "opportunity", cursor: "2026-11-15T12:00:00Z" });
    await toggleCommunityBookmark(42);
    await toggleCommunityRepost(42, { listingId: 12 });
    await toggleCommunityFollow(12);

    expect(api.customClient.get).toHaveBeenCalledWith("/community/posts", { tab: "following", type: "opportunity", cursor: "2026-11-15T12:00:00Z" });
    expect(api.customClient.post).toHaveBeenCalledWith("/community/posts/42/bookmark", {});
    expect(api.customClient.post).toHaveBeenCalledWith("/community/posts/42/repost", { listingId: 12 });
    expect(api.customClient.post).toHaveBeenCalledWith("/community/listings/12/follow", {});
  });
});
