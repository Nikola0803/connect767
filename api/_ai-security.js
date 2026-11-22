const DEFAULT_WORDPRESS_URL = "https://admin.connect767.com";

const header = (req, name) => {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "");
};

const config = () => ({
  baseUrl: String(process.env.C767_WP_BASE_URL || DEFAULT_WORDPRESS_URL).replace(/\/$/, ""),
  secret: String(process.env.C767_AI_SERVICE_SECRET || ""),
  required: process.env.C767_AI_SECURITY_REQUIRED === "1" || Boolean(process.env.VERCEL),
});

async function callSecurity(req, path, body) {
  const current = config();
  if (!current.secret) {
    if (current.required) throw Object.assign(new Error("AI security is not configured."), { status: 503 });
    return { bypassed: true, allowed: true, remaining: null, limit: null };
  }
  const response = await fetch(`${current.baseUrl}/wp-json/connect767/v1/design-security/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-C767-Service-Key": current.secret,
      ...(header(req, "authorization") ? { "X-C767-User-Authorization": header(req, "authorization") } : {}),
      ...(header(req, "x-c767-guest-token") ? { "X-C767-Guest-Token": header(req, "x-c767-guest-token") } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "The AI security service rejected this request.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function reserveAIRequest(req, { requestId, operation, projectId }) {
  if (!/^Bearer\s+\S+$/i.test(header(req, "authorization"))) {
    throw Object.assign(new Error("Sign in or create an account before using AI design tools."), {
      status: 401,
      payload: { data: { requiresAccount: true } },
    });
  }
  return callSecurity(req, "ai/reserve", { requestId, operation, projectId });
}

export async function settleAIRequest(req, { requestId, successful, providerReference = "" }) {
  try {
    return await callSecurity(req, "ai/settle", { requestId, successful, providerReference });
  } catch (error) {
    // The provider result must still reach the customer. Settlement failures
    // are logged and reconciled from the reserved ledger entry.
    console.error("AI usage settlement failed", { requestId, message: error?.message });
    return null;
  }
}

export async function secureGeneratedFile(req, { requestId, b64, mimeType, fileType = "png", originalName }) {
  return callSecurity(req, "files/store", { requestId, b64, mimeType, fileType, originalName });
}

export function securityErrorResponse(error, requestId) {
  return {
    status: Number(error?.status) || 503,
    payload: {
      error: error?.message || "The AI security service is unavailable.",
      requestId,
      remaining: error?.payload?.data?.remaining ?? error?.payload?.remaining ?? null,
      limit: error?.payload?.data?.limit ?? error?.payload?.limit ?? null,
      requiresAccount: Boolean(error?.payload?.data?.requiresAccount ?? error?.payload?.requiresAccount),
    },
  };
}
