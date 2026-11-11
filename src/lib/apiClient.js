import { config } from "./config";

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request(url, options = {}) {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    // Never set Content-Type for FormData — the browser must set it itself
    // (multipart/form-data; boundary=...), which it can only do correctly
    // if the header isn't already present.
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let payload = null;
  let invalidJson = false;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      invalidJson = true;
      payload = { message: res.ok ? "The server returned an invalid response." : text.trim() };
    }
  }

  if (!res.ok) {
    // An expired/revoked JWT must not leave the interface looking signed in.
    // Only clear an existing session; expected 401s from a failed login have
    // no stored token and therefore do not emit a misleading logout event.
    if (res.status === 401 && token) {
      setStoredUser(null);
      setStoredToken(null);
    }
    throw new ApiError(payload?.message || res.statusText, res.status, payload);
  }
  if (invalidJson) {
    throw new ApiError(payload.message, 502, payload);
  }
  return payload;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

/** WordPress core REST API (wp/v2) — listings CPT, blog posts, taxonomies. */
export const wpClient = {
  get(path, params, options = {}) {
    return request(`${config.wpApiUrl}${path}${buildQuery(params)}`, options);
  },
  post(path, body) {
    return request(`${config.wpApiUrl}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

/** Custom endpoints exposed by the companion Connect767 plugin. */
export const customClient = {
  get(path, params) {
    return request(`${config.customApiUrl}${path}${buildQuery(params)}`);
  },
  post(path, body) {
    return request(`${config.customApiUrl}${path}`, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },
  del(path) {
    return request(`${config.customApiUrl}${path}`, { method: "DELETE" });
  },
};

/** Public WooCommerce Store API — read-only product compatibility fallback. */
export const wcStoreClient = {
  get(path, params) {
    return request(`${config.wcStoreApiUrl}${path}${buildQuery(params)}`);
  },
};

export function getStoredToken() {
  try {
    return localStorage.getItem("c767_auth_token");
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem("c767_auth_token", token);
    else localStorage.removeItem("c767_auth_token");
  } catch {
    /* localStorage unavailable (e.g. private mode) — auth just won't persist */
  }
  window.dispatchEvent(new CustomEvent("c767-auth-changed"));
}

/**
 * The JWT payload only carries `user_id` (see class-jwt.php) — no email or
 * name, so there's nothing to usefully decode client-side. Login/register
 * responses include the full user object already, so that's cached
 * directly instead; useAuth.js reads it back rather than trying to decode
 * the token.
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem("c767_auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) localStorage.setItem("c767_auth_user", JSON.stringify(user));
    else localStorage.removeItem("c767_auth_user");
  } catch {
    /* localStorage unavailable — auth just won't persist */
  }
}

export { ApiError };
