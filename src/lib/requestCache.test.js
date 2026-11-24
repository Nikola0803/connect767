import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedRequest, clearRequestCache, requestCacheSize } from "./requestCache";

beforeEach(() => {
  clearRequestCache();
  vi.useRealTimers();
});

describe("cachedRequest", () => {
  it("deduplicates concurrent reads and reuses a fresh result", async () => {
    const loader = vi.fn().mockResolvedValue({ id: 1 });
    const [first, second] = await Promise.all([
      cachedRequest("listings", loader),
      cachedRequest("listings", loader),
    ]);

    expect(first).toEqual({ id: 1 });
    expect(second).toEqual({ id: 1 });
    expect(await cachedRequest("listings", loader)).toEqual({ id: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(requestCacheSize()).toBe(1);
  });

  it("returns stale data immediately while refreshing it", async () => {
    vi.useFakeTimers();
    const loader = vi.fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    expect(await cachedRequest("products", loader, { freshMs: 100, staleMs: 1000 })).toBe("first");
    vi.advanceTimersByTime(150);
    expect(await cachedRequest("products", loader, { freshMs: 100, staleMs: 1000 })).toBe("first");
    await vi.runAllTimersAsync();
    expect(await cachedRequest("products", loader, { freshMs: 100, staleMs: 1000 })).toBe("second");
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
