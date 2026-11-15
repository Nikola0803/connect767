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
      image,
    });

    const [, form] = api.customClient.post.mock.calls[0];
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("listingId")).toBe("12");
    expect(form.get("text")).toBe("Fresh fruit today");
    expect(form.get("type")).toBe("offer");
    expect(form.get("emotion")).toBe("proud");
    expect(form.get("image")).toBe(image);
  });
});
