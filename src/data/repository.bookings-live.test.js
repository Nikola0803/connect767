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

import { deleteRejectedBooking, deleteRejectedBookings } from "./repository";

describe("live booking management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a rejected booking through the authenticated booking endpoint", async () => {
    api.customClient.del.mockResolvedValue({ id: 42, deleted: true });

    await expect(deleteRejectedBooking(42)).resolves.toEqual({ id: 42, deleted: true });
    expect(api.customClient.del).toHaveBeenCalledWith("/bookings/42");
  });

  it("deletes multiple unique rejected bookings", async () => {
    api.customClient.del.mockResolvedValue({ deleted: true });

    await deleteRejectedBookings([42, 43, 42]);

    expect(api.customClient.del).toHaveBeenCalledTimes(2);
    expect(api.customClient.del).toHaveBeenCalledWith("/bookings/42");
    expect(api.customClient.del).toHaveBeenCalledWith("/bookings/43");
  });
});
