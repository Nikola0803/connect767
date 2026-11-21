import { config } from "./config";
import { getStoredToken, getStoredUser } from "./apiClient";

const GUEST_TOKEN_KEY = "c767_design_guest_token";
const initializationPromises = new Map();
const guestProjectStorageKey = (sport) => `c767_design_project:guest:${String(sport || "other").toLowerCase()}`;
const projectStorageKey = (sport) => {
  const user = getStoredUser();
  return `c767_design_project:${user?.id ? `user-${user.id}` : "guest"}:${String(sport || "other").toLowerCase()}`;
};

const stored = (key) => {
  try { return window.localStorage.getItem(key) || ""; } catch { return ""; }
};
const persist = (key, value) => {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch { /* Server state remains authoritative when storage is unavailable. */ }
};

async function securityRequest(path, { method = "GET", body, guestToken = stored(GUEST_TOKEN_KEY) } = {}) {
  if (!config.customApiUrl) throw new Error("Design security requires the Connect767 server.");
  const token = getStoredToken();
  const response = await fetch(`${config.customApiUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(guestToken ? { "X-C767-Guest-Token": guestToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "The design security service is unavailable.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (payload.guestToken) persist(GUEST_TOKEN_KEY, payload.guestToken);
  return payload;
}

async function initializeDesignSecurityInternal({ sport, title }) {
  if (!config.customApiUrl) {
    return {
      authenticated: Boolean(getStoredUser()?.id),
      projectId: `local-${String(sport || "uniform").toLowerCase()}`,
      guestToken: "",
      limit: 3,
      remaining: 3,
      downloadUnlocked: false,
      projectFiles: [],
      localPreview: true,
    };
  }
  let session = await securityRequest("/design-security/session", { method: "POST", body: {} });
  const key = projectStorageKey(sport);
  let projectId = stored(key);
  if (!projectId && getStoredUser()?.id) {
    const guestProjectId = stored(guestProjectStorageKey(sport));
    const guestToken = stored(GUEST_TOKEN_KEY);
    if (guestProjectId && guestToken) {
      try {
        const claimed = await securityRequest("/design-security/projects/claim", {
          method: "POST",
          body: { projectId: guestProjectId },
          guestToken,
        });
        projectId = claimed.projectId;
        session = { ...session, ...claimed };
        persist(key, projectId);
        persist(guestProjectStorageKey(sport), "");
      } catch {
        // A stale guest project must not prevent a signed-in customer from starting fresh.
      }
    }
  }
  if (projectId) {
    try {
      session = await securityRequest(`/design-security/status?projectId=${encodeURIComponent(projectId)}`, {
        guestToken: session.guestToken || stored(GUEST_TOKEN_KEY),
      });
    } catch (error) {
      if (![403, 404].includes(error.status)) throw error;
      projectId = "";
      persist(key, "");
    }
  }
  if (!projectId) {
    const project = await securityRequest("/design-security/projects", {
      method: "POST",
      body: { sport, title },
      guestToken: session.guestToken || stored(GUEST_TOKEN_KEY),
    });
    projectId = project.projectId;
    session = { ...session, ...project };
    persist(key, projectId);
  }
  return {
    downloadUnlocked: false,
    projectFiles: [],
    ...session,
    projectId,
    guestToken: session.guestToken || stored(GUEST_TOKEN_KEY),
  };
}

export function initializeDesignSecurity(options = {}) {
  const key = projectStorageKey(options.sport);
  const existing = initializationPromises.get(key);
  if (existing) return existing;

  const pending = initializeDesignSecurityInternal(options).finally(() => {
    if (initializationPromises.get(key) === pending) initializationPromises.delete(key);
  });
  initializationPromises.set(key, pending);
  return pending;
}

export async function refreshDesignSecurity(projectId = "") {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return securityRequest(`/design-security/status${query}`);
}

export function aiSecurityHeaders(context, requestId) {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    "X-C767-Request-Id": requestId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(context?.guestToken ? { "X-C767-Guest-Token": context.guestToken } : {}),
  };
}

export function newAIRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function downloadProtectedDesign(file) {
  if (!file?.id) throw new Error("No protected design file is available.");
  const authorization = getStoredToken();
  if (!authorization) throw new Error("Sign in to download your purchased design.");
  const ticket = await securityRequest("/design-security/download-token", {
    method: "POST",
    body: { fileId: Number(file.id) },
  });
  const response = await fetch(ticket.url, { headers: { Authorization: `Bearer ${authorization}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "The protected design could not be downloaded.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.original_name || `connect767-design.${file.file_type || "png"}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function clearGuestDesignSecurity() {
  persist(GUEST_TOKEN_KEY, "");
}
