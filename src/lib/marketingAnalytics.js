import { config, isLiveApi } from "./config";

const VISITOR_KEY = "c767_marketing_visitor";
const SESSION_KEY = "c767_marketing_session";
const SESSION_ACTIVITY_KEY = "c767_marketing_session_activity";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ALLOWED_EVENTS = new Set(["page_view", "registration_started", "listing_started"]);
const memory = new Map();

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") || `${Date.now()}-${Math.random()}`;
}

function persistentId() {
  try {
    let value = localStorage.getItem(VISITOR_KEY);
    if (!value) {
      value = randomId();
      localStorage.setItem(VISITOR_KEY, value);
    }
    return value;
  } catch {
    if (!memory.has(VISITOR_KEY)) memory.set(VISITOR_KEY, randomId());
    return memory.get(VISITOR_KEY);
  }
}

function sessionId() {
  const now = Date.now();
  try {
    const lastActivity = Number(sessionStorage.getItem(SESSION_ACTIVITY_KEY) || 0);
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value || now - lastActivity > SESSION_TIMEOUT_MS) {
      value = randomId();
      sessionStorage.setItem(SESSION_KEY, value);
    }
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    return value;
  } catch {
    if (!memory.has(SESSION_KEY)) memory.set(SESSION_KEY, randomId());
    return memory.get(SESSION_KEY);
  }
}

function attribution() {
  const query = new URLSearchParams(window.location.search);
  const explicitSource = query.get("utm_source") || "";
  const referrerHost = (() => {
    try {
      const host = document.referrer ? new URL(document.referrer).hostname : "";
      return host && host !== window.location.hostname ? host : "";
    } catch {
      return "";
    }
  })();
  return {
    source: explicitSource || referrerHost || "direct",
    medium: query.get("utm_medium") || (referrerHost ? "referral" : ""),
    campaign: query.get("utm_campaign") || "",
  };
}

export function trackMarketingEvent(event, { path } = {}) {
  if (!isLiveApi || !ALLOWED_EVENTS.has(event)) return Promise.resolve(false);
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return Promise.resolve(false);

  return fetch(`${config.customApiUrl}/marketing/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      visitorId: persistentId(),
      sessionId: sessionId(),
      path: path || `${window.location.pathname}${window.location.search}`,
      ...attribution(),
    }),
    keepalive: true,
    credentials: "omit",
  }).then((response) => response.ok).catch(() => false);
}

export function trackMarketingEventOnce(event, scope = event) {
  const key = `c767_marketing_once_${scope}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    if (memory.has(key)) return;
    memory.set(key, true);
  }
  trackMarketingEvent(event);
}
