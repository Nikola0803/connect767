import { config } from "./config";
import { clearInvalidSession, getStoredToken, getStoredUser } from "./apiClient";

const GUEST_TOKEN_KEY = "c767_design_guest_token";
const initializationPromises = new Map();
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${config.customApiUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(guestToken ? { "X-C767-Guest-Token": guestToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch((error) => {
      if (error.name === "AbortError") throw error;
      return {};
    });
    if (!response.ok) {
      clearInvalidSession(response.status, payload, token);
      const error = new Error(payload.message || "The design security service is unavailable.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    if (payload.guestToken) persist(GUEST_TOKEN_KEY, payload.guestToken);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function initializeDesignSecurityInternal({ sport, title }) {
  if (!config.customApiUrl) {
    return {
      authenticated: Boolean(getStoredUser()?.id),
      projectId: "",
      guestToken: "",
      limit: null,
      remaining: null,
      downloadUnlocked: false,
      projectFiles: [],
      localPreview: true,
    };
  }
  let session = await securityRequest("/design-security/session", { method: "POST", body: {} });
  if (!Number.isFinite(session.limit) || !Number.isFinite(session.remaining) || session.limit < 0 || session.remaining < 0) {
    throw new Error("AI usage could not be verified. Please retry the usage check.");
  }
  if (!session.authenticated) {
    return {
      ...session,
      authenticated: false,
      accountRequired: true,
      projectId: "",
      guestToken: session.guestToken || stored(GUEST_TOKEN_KEY),
      downloadUnlocked: false,
      projectFiles: [],
    };
  }
  const key = projectStorageKey(sport);
  let projectId = stored(key);
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

export async function loadDesignHistory(projectId) {
  if (!projectId || !getStoredToken() || !config.customApiUrl) return null;
  return securityRequest(`/design-security/history?projectId=${encodeURIComponent(projectId)}`);
}

export async function saveDesignHistoryEntry(projectId, entry) {
  if (!projectId || !entry || !getStoredToken() || !config.customApiUrl) return null;
  return securityRequest("/design-security/history", {
    method: "POST",
    body: { projectId, action: "append", entry },
  });
}

export async function startDesignConversation(projectId, title = "New design") {
  if (!projectId || !getStoredToken() || !config.customApiUrl) return null;
  return securityRequest("/design-security/history", {
    method: "POST",
    body: { projectId, action: "new", title },
  });
}

export async function importDesignHistory(projectId, current = [], archived = []) {
  if (!projectId || !getStoredToken() || !config.customApiUrl) return null;
  return securityRequest("/design-security/history", {
    method: "POST",
    body: { projectId, action: "import", current, archived },
  });
}

export async function clearDesignHistory(projectId) {
  if (!projectId || !getStoredToken() || !config.customApiUrl) return null;
  return securityRequest(`/design-security/history?projectId=${encodeURIComponent(projectId)}`, { method: "DELETE" });
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
