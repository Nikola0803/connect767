import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  customClient: { get: vi.fn(), post: vi.fn() },
  wpClient: { get: vi.fn(), post: vi.fn() },
  wcStoreClient: { get: vi.fn() },
}));

vi.mock("../lib/config", () => ({ isLiveApi: true }));
vi.mock("../lib/apiClient", () => ({
  ...api,
  getStoredUser: vi.fn(),
}));

import { updateMyStorefrontSettings } from "./repository";

describe("live storefront settings persistence", () => {
  it("sends every layout value as a JSON field", async () => {
    api.customClient.post.mockResolvedValue({ saved: true });

    await updateMyStorefrontSettings(1593, {
      productGrid: "4",
      imageRatio: "landscape",
      cardCorners: "square",
      contentWidth: "wide",
      defaultTab: "overview",
      featuredProductIds: [10],
      productOrder: [10, 11],
    });

    expect(api.customClient.post).toHaveBeenCalledWith(
      "/vendor-storefronts/1593",
      expect.objectContaining({
        productGrid: "4",
        imageRatio: "landscape",
        cardCorners: "square",
        contentWidth: "wide",
        defaultTab: "overview",
        featuredProductIds: [10],
        productOrder: [10, 11],
      }),
    );
    expect(api.customClient.post.mock.calls[0][1]).not.toBeInstanceOf(FormData);
  });
});
