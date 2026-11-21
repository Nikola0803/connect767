import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDesignSecurity } from "./designSecurity";
vi.mock("./config", () => ({ config: { customApiUrl: "https://studio.test/api" } }));
vi.mock("./apiClient", () => ({ getStoredUser: () => null, getStoredToken: () => "" }));
const response = (payload, ok = true, status = 200) => ({ ok, status, json: async () => payload });
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("studio usage initialization", () => {
  it("reads guest limits from the backend without creating an authenticated project", async () => {
    fetch.mockResolvedValue(response({ authenticated: false, limit: 3, remaining: 2, guestToken: "test-guest" }));
    expect(await initializeDesignSecurity({ sport: "soccer" })).toMatchObject({ limit: 3, remaining: 2, projectId: "", accountRequired: true, downloadUnlocked: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("https://studio.test/api/design-security/session");
  });
  it("distinguishes confirmed zero allowance from an unavailable lookup", async () => {
    fetch.mockResolvedValueOnce(response({ authenticated: false, limit: 0, remaining: 0 }));
    expect(await initializeDesignSecurity({ sport: "cricket" })).toMatchObject({ limit: 0, remaining: 0 });
    fetch.mockResolvedValueOnce(response({ message: "Offline" }, false, 503));
    await expect(initializeDesignSecurity({ sport: "cricket" })).rejects.toThrow("Offline");
  });
  it("rejects malformed quotas and permits a retry", async () => {
    fetch.mockResolvedValueOnce(response({ authenticated: false }));
    await expect(initializeDesignSecurity({ sport: "netball" })).rejects.toThrow("AI usage could not be verified");
    fetch.mockResolvedValueOnce(response({ authenticated: false, limit: 3, remaining: 3 }));
    expect(await initializeDesignSecurity({ sport: "netball" })).toMatchObject({ remaining: 3 });
  });
  it("deduplicates initialization for one project", async () => {
    fetch.mockResolvedValue(response({ authenticated: false, limit: 3, remaining: 3 }));
    const [first, second] = await Promise.all([initializeDesignSecurity({ sport: "basketball" }), initializeDesignSecurity({ sport: "basketball" })]);
    expect(first).toEqual(second);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("terminates stalled lookups", async () => {
    vi.useFakeTimers();
    fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")))));
    const pending = expect(initializeDesignSecurity({ sport: "other" })).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(12000);
    await pending;
  });
  it("also times out a response that stalls after headers arrive", async () => {
    vi.useFakeTimers();
    fetch.mockImplementation(async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")))) }));
    const pending = expect(initializeDesignSecurity({ sport: "goalkeeper" })).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(12000);
    await pending;
  });
});
