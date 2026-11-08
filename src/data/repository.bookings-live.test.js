import { describe, expect, it, vi } from "vitest";

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

import { deleteRejectedBooking } from "./repository";

describe("live booking management", () => {
  it("deletes a rejected booking through the authenticated booking endpoint", async () => {
    api.customClient.del.mockResolvedValue({ id: 42, deleted: true });

    await expect(deleteRejectedBooking(42)).resolves.toEqual({ id: 42, deleted: true });
    expect(api.customClient.del).toHaveBeenCalledWith("/bookings/42");
  });
});
