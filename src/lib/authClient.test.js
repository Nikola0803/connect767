import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({ isLiveApi: true }));
vi.mock("./apiClient", () => ({
  customClient: { post: vi.fn() },
  setStoredToken: vi.fn(),
  setStoredUser: vi.fn(),
  getStoredToken: vi.fn(),
}));

import { customClient } from "./apiClient";
import { requestPasswordReset, resetPassword } from "./authClient";

describe("password recovery API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a reset email without exposing account state", async () => {
    const response = { message: "If an account exists for that email, a password reset link is on its way." };
    customClient.post.mockResolvedValue(response);

    await expect(requestPasswordReset("person@example.com")).resolves.toEqual(response);
    expect(customClient.post).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "person@example.com",
    });
  });

  it("submits the reset key, login, and new password", async () => {
    customClient.post.mockResolvedValue({ message: "Your password has been reset. You can now sign in." });

    await resetPassword({ login: "person", key: "reset-key", password: "new-password" });

    expect(customClient.post).toHaveBeenCalledWith("/auth/reset-password", {
      login: "person",
      key: "reset-key",
      password: "new-password",
    });
  });

  it("uses the API error when a reset link is invalid", async () => {
    customClient.post.mockRejectedValue({ payload: { message: "This password reset link is invalid or has expired." } });

    await expect(resetPassword({ login: "person", key: "bad-key", password: "new-password" }))
      .rejects.toThrow("This password reset link is invalid or has expired.");
  });
});
