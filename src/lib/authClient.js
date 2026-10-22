import { isLiveApi } from "./config";
import { customClient, setStoredToken, setStoredUser, getStoredToken } from "./apiClient";

/**
 * Auth against the Connect767 CMS plugin's self-contained JWT endpoints
 * (connect767/v1/auth/login, /auth/register) — no third-party JWT plugin
 * required, works from a plain plugin install. See connect767-cms's
 * includes/class-rest-auth.php and includes/class-jwt.php.
 *
 * Until VITE_WP_BASE_URL is set, both functions simulate success so the UI
 * can be built and tested end-to-end without a backend.
 */

export async function login({ email, password }) {
  if (!isLiveApi) {
    await simulateLatency();
    if (!email || !password) throw new AuthError("Email and password are required.");
    const fakeToken = `local-dev-token.${btoa(email)}`;
    const user = { email, name: email.split("@")[0] };
    setStoredToken(fakeToken);
    setStoredUser(user);
    return { token: fakeToken, user };
  }

  try {
    const payload = await customClient.post("/auth/login", { email, password });
    setStoredToken(payload.token);
    setStoredUser(payload.user);
    return { token: payload.token, user: payload.user };
  } catch (err) {
    throw new AuthError(err.payload?.message || "Incorrect email or password.");
  }
}

export async function register({ name, email, password, accountType }) {
  if (!isLiveApi) {
    await simulateLatency();
    if (!name || !email || !password) throw new AuthError("All fields are required.");
    const fakeToken = `local-dev-token.${btoa(email)}`;
    const user = { email, name, accountType };
    setStoredToken(fakeToken);
    setStoredUser(user);
    return { token: fakeToken, user };
  }

  try {
    const payload = await customClient.post("/auth/register", { name, email, password, accountType });
    setStoredToken(payload.token);
    setStoredUser(payload.user);
    return { token: payload.token, user: payload.user };
  } catch (err) {
    throw new AuthError(err.payload?.message || "Something went wrong. Please try again.");
  }
}

export async function requestPasswordReset(email) {
  if (!isLiveApi) {
    await simulateLatency();
    return {
      message: "If an account exists for that email, a password reset link is on its way.",
    };
  }

  try {
    return await customClient.post("/auth/forgot-password", { email });
  } catch (err) {
    throw new AuthError(err.payload?.message || "We couldn't send the reset email. Please try again.");
  }
}

export async function resetPassword({ login: userLogin, key, password }) {
  if (!isLiveApi) {
    await simulateLatency();
    if (!userLogin || !key) throw new AuthError("This password reset link is invalid or incomplete.");
    if (!password || password.length < 8) throw new AuthError("Password must be at least 8 characters.");
    return { message: "Your password has been reset. You can now sign in." };
  }

  try {
    return await customClient.post("/auth/reset-password", { login: userLogin, key, password });
  } catch (err) {
    throw new AuthError(err.payload?.message || "This reset link is invalid or has expired.");
  }
}

export function logout() {
  setStoredToken(null);
  setStoredUser(null);
}

export function isAuthenticated() {
  return Boolean(getStoredToken());
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

function simulateLatency() {
  return new Promise((resolve) => setTimeout(resolve, 500));
}
