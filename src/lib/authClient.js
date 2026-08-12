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
