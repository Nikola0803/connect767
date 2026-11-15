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

import { createCommunityPost } from "./repository";

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
});
