import { describe, it, expect, beforeEach, vi } from "vitest";
import { wpClient, customClient, getStoredToken, setStoredToken, getStoredUser, setStoredUser, ApiError } from "./apiClient";

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: "status",
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("token/user storage round-trip", () => {
  it("stores and retrieves the auth token", () => {
    expect(getStoredToken()).toBeNull();
    setStoredToken("abc123");
    expect(getStoredToken()).toBe("abc123");
  });

  it("clears the token when set to a falsy value", () => {
    setStoredToken("abc123");
    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });

  it("stores and retrieves the cached user as parsed JSON", () => {
    setStoredUser({ id: 1, email: "a@b.com" });
    expect(getStoredUser()).toEqual({ id: 1, email: "a@b.com" });
  });

  it("dispatches a c767-auth-changed event when the token changes", () => {
    const handler = vi.fn();
    window.addEventListener("c767-auth-changed", handler);
    setStoredToken("xyz");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("c767-auth-changed", handler);
  });
});

describe("wpClient/customClient request building", () => {
  it("GET builds a query string, skipping empty/undefined/null params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await wpClient.get("/listing", { search: "cafe", empty: "", missing: undefined, nil: null });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("search=cafe");
    expect(url).not.toContain("empty=");
    expect(url).not.toContain("missing=");
    expect(url).not.toContain("nil=");
  });

  it("attaches a Bearer token when one is stored", async () => {
    setStoredToken("my-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await customClient.get("/vendor-products/mine");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer my-token");
  });

  it("omits the Authorization header when no token is stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await customClient.get("/shop/products");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("never sets Content-Type for a FormData body, letting the browser set the multipart boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const form = new FormData();
    form.append("name", "test");
    await customClient.post("/vendor-products", form);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("sets Content-Type: application/json for a plain object body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await customClient.post("/uniform-quotes", { name: "test" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ name: "test" }));
  });

  it("throws an ApiError with the server's message on a non-ok response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "Incorrect email or password." }, false, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(customClient.post("/auth/login", { email: "a@b.com", password: "wrong" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Incorrect email or password.",
    });
  });

  it("ApiError falls back to the response statusText when the server sends no message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(customClient.get("/shop/products")).rejects.toBeInstanceOf(ApiError);
  });
});
