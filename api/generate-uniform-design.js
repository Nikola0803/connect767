import { createHash, randomUUID } from "node:crypto";
import { reserveAIRequest, securityErrorResponse, settleAIRequest } from "./_ai-security.js";
import { basketballKitRule, basketballSocksRequested } from "../shared/uniformPromptRules.js";

export const config = { maxDuration: 60 };

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-6-luna";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestWindows = new Map();

const SPORTS = new Set(["Soccer", "Basketball", "Netball", "Cricket", "Goal Keeper", "Other"]);
const STYLES = new Set(["Modern & Bold", "Classic & Clean", "Minimal & Elegant", "Retro & Vintage", "Street & Edgy"]);
const COLOR_KEYS = ["body", "sleeve", "collar", "shorts", "socks", "shirtStrip", "sleeveStrip", "shortsStrip"];
const PATTERN_KEYS = ["none", "bands-h", "bands-v", "diagonal", "chevron", "sash", "halves", "shield", "star", "tricolour", "cross", "quarters", "camo", "splash", "fade"];
const PATTERN_VIEWS = ["front", "side", "back", "both", "all"];
const ELEMENT_KINDS = ["text", "artwork"];
const ELEMENT_VIEWS = ["front", "side", "back"];
const TEXT_LAYOUTS = ["single-line", "stacked"];
const REFERENCE_IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_REFERENCE_IMAGE_BYTES = 3 * 1024 * 1024;

const text = (value, maxLength) => typeof value === "string" ? value.trim().slice(0, maxLength) : "";
const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value);
const hex = (value, fallback = "#FFFFFF") => isHex(value) ? value.toUpperCase() : fallback;

function requestIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  return text(Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0], 128)
    || text(req.socket?.remoteAddress, 128)
    || "anonymous";
}

function safetyIdentifier(req) {
  return createHash("sha256").update(requestIp(req)).digest("hex").slice(0, 64);
}

function rateLimit(req) {
  const key = requestIp(req);
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return {
    allowed: current.count <= MAX_REQUESTS_PER_WINDOW,
    retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000)),
  };
}

function stringList(value, fallback) {
  const next = Array.isArray(value) ? value.map((item) => text(item, 30)).filter(Boolean) : [];
  return next.length ? [...new Set(next)].slice(0, 8) : fallback;
}

function referenceImage(value) {
  if (!value) return "";
  if (typeof value !== "string") throw new Error("The reference image is invalid.");
  const match = value.match(REFERENCE_IMAGE_PATTERN);
  if (!match) throw new Error("Use a PNG, JPEG or WebP reference image.");
  const estimatedBytes = Math.floor((match[2].length * 3) / 4);
  if (estimatedBytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("The reference image is too large. Use an image under 3 MB.");
  }
  return value;
}

export function normalizeUniformRequest(body = {}) {
  const sport = SPORTS.has(body.sport) ? body.sport : "Other";
  const style = STYLES.has(body.style) ? body.style : "Modern & Bold";
  const brandName = text(body.brandName, 80);
  const brief = text(body.brief, 900);
  if (!brandName) throw new Error("Team or brand name is required.");
  if (!brief) throw new Error("Describe the uniform you want.");

  const collarOptions = sport === "Basketball" ? ["Crew", "V-Neck"] : stringList(body.collarOptions, ["Crew", "V-Neck", "Polo"]);
  const sleeveOptions = sport === "Basketball" ? ["Sleeveless"] : stringList(body.sleeveOptions, ["Short", "Long", "Sleeveless", "Mixed"]);
  const current = {
    collar: collarOptions.includes(body.current?.collar) ? body.current.collar : collarOptions[0],
    sleeve: sleeveOptions.includes(body.current?.sleeve) ? body.current.sleeve : sleeveOptions[0],
    colors: Object.fromEntries(COLOR_KEYS.map((key) => [key, hex(body.current?.colors?.[key])])),
    patternKey: PATTERN_KEYS.includes(body.current?.patternKey) ? body.current.patternKey : "none",
  };
  const locks = {
    collar: Boolean(body.locks?.collar),
    sleeve: Boolean(body.locks?.sleeve),
    colors: Boolean(body.locks?.colors),
    pattern: Boolean(body.locks?.pattern),
    artwork: body.locks?.artwork !== false,
  };

  return {
    sport,
    style,
    brandName,
    brief,
    includeSocks: basketballSocksRequested(text(body.userPrompt, 2000), body.includeSocks === true),
    collarOptions,
    sleeveOptions,
    current,
    locks,
    referenceImage: referenceImage(body.referenceImage),
  };
}

export const uniformDesignSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    collar: { type: "string" },
    sleeve: { type: "string" },
    colors: {
      type: "object",
      properties: Object.fromEntries(COLOR_KEYS.map((key) => [key, { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" }])),
      required: COLOR_KEYS,
      additionalProperties: false,
    },
    pattern: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        key: { type: "string", enum: PATTERN_KEYS },
        view: { type: "string", enum: PATTERN_VIEWS },
      },
      required: ["enabled", "key", "view"],
      additionalProperties: false,
    },
    crestSuggestion: { type: "string" },
    productionElements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ELEMENT_KINDS },
          content: { type: "string" },
          view: { type: "string", enum: ELEMENT_VIEWS },
          x: { type: "number" },
          y: { type: "number" },
          size: { type: "number" },
          rotation: { type: "number" },
          color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
          layout: { type: "string", enum: TEXT_LAYOUTS },
        },
        required: ["kind", "content", "view", "x", "y", "size", "rotation", "color", "layout"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "summary", "collar", "sleeve", "colors", "pattern", "crestSuggestion", "productionElements"],
  additionalProperties: false,
};

export function buildUniformPrompt(input) {
  return [
    `Design an editable ${input.sport} team uniform for ${JSON.stringify(input.brandName)}.`,
    `Direction: ${input.style}. Customer brief: ${input.brief}`,
    `Allowed collars: ${input.collarOptions.join(", ")}. Allowed sleeves: ${input.sleeveOptions.join(", ")}.`,
    input.sport === "Basketball" ? basketballKitRule(input.includeSocks) : "",
    "Mixed sleeves means a team order containing some matching short-sleeve jerseys and some matching long-sleeve jerseys. It never means one jersey with different left and right sleeves. For a Mixed representative preview, render two matching short sleeves.",
    `Current editable design: ${JSON.stringify(input.current)}. Locked controls: ${JSON.stringify(input.locks)}.`,
    "Return a cohesive production-friendly palette for only these zones: shirt body, sleeves, collar, shorts or trousers, socks, shirt ends, sleeve ends, and shorts ends.",
    "Only apply the following sock rules when socks are included. Socks must remain one uninterrupted solid base color from cuff to toe and must have exactly three separate horizontal stripes confined to the top near the knee, with visible base-color gaps between stripes. All three stripes must use the same single solid stripe color. Never create a contrasting solid-color cuff, place stripes below the knee band, or place logos, text, numbers, decorative patterns, gradients or any other artwork on socks. Do not invent side panels, shoulder panels, gradients outside the named pattern, or unsupported garment parts.",
    `Choose pattern.key only from ${PATTERN_KEYS.join(", ")}. Use none when a clean solid kit is better.`,
    "Design all three editable surfaces: front, side, and back. Use pattern.view all when a pattern should wrap consistently across every surface; both remains available for legacy front-and-back-only designs.",
    "productionElements must describe every requested team name, word, number, sponsor, crest, logo or visual mark as editable production artwork. Use kind text for exact printable wording or numbers and kind artwork for a visual crest/logo prompt. Set layout to stacked when the concept should display text on two lines, otherwise single-line; use single-line for artwork because its layout value is ignored. The concept image and production map must use the same text layout. Set view to front, side, or back for the surface where each element belongs. Positions are percentages of the printable SHIRT panel (not the surrounding canvas or full kit). Use x 50 for horizontally centered chest artwork. For shirt artwork, y 20 means upper chest, y 40 center chest, and y 65 lower chest; never use shorts/socks coordinates. Keep important elements inside x 20-80 and y 20-65. Use side for sleeve marks, side-panel wording, or other details the brief places on the uniform profile. Use at most one artwork element and up to five text elements. Do not repeat garment patterns as artwork.",
    input.locks.artwork
      ? "Artwork is locked: return an empty productionElements array and an empty crestSuggestion."
      : "Artwork is unlocked: include the requested identity elements in productionElements so the editable map matches the AI concept. crestSuggestion should repeat the artwork element prompt when one is present.",
    input.referenceImage
      ? "An inspiration image is attached. Use its visual direction, panel rhythm and proportions as a reference, but translate it only into supported editable studio zones. Do not copy logos, words, numbers, people, backgrounds or protected brand marks."
      : "No inspiration image is attached; follow the written brief.",
  ].join(" ");
}

export function normalizeUniformPlan(plan, input) {
  const current = input.current;
  const normalizedCollar = input.collarOptions.includes(plan?.collar)
    ? plan.collar
    : /polo/i.test(String(plan?.collar || "")) && input.collarOptions.includes("Polo")
      ? "Polo"
      : current.collar;
  const normalizedSleeve = input.sleeveOptions.includes(plan?.sleeve)
    ? plan.sleeve
    : /mixed/i.test(String(plan?.sleeve || "")) && input.sleeveOptions.includes("Mixed")
      ? "Mixed"
      : current.sleeve;
  const nextColors = Object.fromEntries(COLOR_KEYS.map((key) => [
    key,
    input.locks.colors ? current.colors[key] : hex(plan?.colors?.[key], current.colors[key]),
  ]));
  const patternKey = PATTERN_KEYS.includes(plan?.pattern?.key) ? plan.pattern.key : "none";
  const patternEnabled = Boolean(plan?.pattern?.enabled) && patternKey !== "none";
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const productionElements = input.locks.artwork
    ? []
    : (Array.isArray(plan?.productionElements) ? plan.productionElements : [])
        .map((element) => ({
          kind: ELEMENT_KINDS.includes(element?.kind) ? element.kind : "text",
          content: text(element?.content, 180),
          view: ELEMENT_VIEWS.includes(element?.view) ? element.view : "front",
          x: number(element?.x, 50, 5, 95),
          y: number(element?.y, 35, 5, 95),
          size: number(element?.size, element?.kind === "artwork" ? 20 : 14, 6, 60),
          rotation: number(element?.rotation, 0, -180, 180),
          color: hex(element?.color, nextColors.body === "#FFFFFF" ? "#1B1A16" : "#FFFFFF"),
          layout: TEXT_LAYOUTS.includes(element?.layout) ? element.layout : "single-line",
        }))
        .filter((element) => element.content)
        .filter((element, index, elements) => element.kind !== "artwork" || elements.findIndex((candidate) => candidate.kind === "artwork") === index)
        .slice(0, 6);

  return {
    name: text(plan?.name, 80) || `${input.brandName} AI kit`,
    ...(input.sport === "Basketball" ? { includeSocks: input.includeSocks } : {}),
    summary: text(plan?.summary, 300) || "An editable AI-generated uniform direction.",
    collar: input.locks.collar
      ? current.collar
      : normalizedCollar,
    sleeve: input.locks.sleeve
      ? current.sleeve
      : normalizedSleeve,
    colors: nextColors,
    pattern: input.locks.pattern
      ? { enabled: current.patternKey !== "none", key: current.patternKey, view: "both" }
      : {
          enabled: patternEnabled,
          key: patternEnabled ? patternKey : "none",
          view: PATTERN_VIEWS.includes(plan?.pattern?.view) ? plan.pattern.view : "both",
        },
    crestSuggestion: input.locks.artwork ? "" : text(plan?.crestSuggestion, 300),
    productionElements,
  };
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function responseJson(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TEXT_MODEL || DEFAULT_MODEL;

  if (req.method === "GET") return responseJson(res, 200, { configured: Boolean(apiKey), model });
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "GET, POST");
    return responseJson(res, 405, { error: "Method not allowed" });
  }
  if (!apiKey) return responseJson(res, 503, { error: "AI uniform design is not configured on the server yet." });

  let input;
  try {
    input = normalizeUniformRequest(req.body || {});
  } catch (error) {
    return responseJson(res, 400, { error: error.message });
  }

  const limit = rateLimit(req);
  if (!limit.allowed) {
    res.setHeader?.("Retry-After", String(limit.retryAfter));
    return responseJson(res, 429, { error: "Design limit reached. Please wait a few minutes and try again." });
  }

  const requestedId = text(req.headers?.["x-c767-request-id"], 80);
  const requestId = requestedId || randomUUID();
  const requestedOperation = text(req.body?.aiOperation, 30);
  const operation = ["generation", "refinement", "variation"].includes(requestedOperation)
    ? requestedOperation
    : input.referenceImage ? "refinement" : "generation";
  let reservation;
  try {
    reservation = await reserveAIRequest(req, { requestId, operation, projectId: text(req.body?.projectId, 80) });
  } catch (error) {
    const security = securityErrorResponse(error, requestId);
    return responseJson(res, security.status, security.payload);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Client-Request-Id": requestId,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: "You are a professional sports-uniform designer. Convert the customer's request into supported editable studio controls. Preserve locked settings exactly and prioritize strong contrast, practical production, and readable team identity.",
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: buildUniformPrompt(input) },
              ...(input.referenceImage
                ? [{ type: "input_image", image_url: input.referenceImage, detail: "high" }]
                : []),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "uniform_design_plan",
            strict: true,
            schema: uniformDesignSchema,
          },
        },
        safety_identifier: safetyIdentifier(req),
      }),
      signal: controller.signal,
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const status = upstream.status === 401 ? 502 : upstream.status;
      const message = upstream.status === 401
        ? "The AI service rejected the server credential."
        : data?.error?.message || "The AI service could not create this uniform plan.";
      await settleAIRequest(req, { requestId, successful: false, providerReference: data?.id || "" });
      return responseJson(res, status, { error: message, requestId, remaining: reservation?.remaining ?? null });
    }

    const output = extractOutputText(data);
    if (!output) {
      await settleAIRequest(req, { requestId, successful: false, providerReference: data?.id || "" });
      return responseJson(res, 502, { error: "The AI service returned no design plan.", requestId });
    }
    let plan;
    try {
      plan = JSON.parse(output);
    } catch {
      await settleAIRequest(req, { requestId, successful: false, providerReference: data?.id || "" });
      return responseJson(res, 502, { error: "The AI service returned an unreadable design plan.", requestId });
    }

    // Complete the reserved usage ledger entry after a successful provider
    // response. Leaving it in "reserved" state would release the credit after
    // the reservation timeout and let completed prompts escape daily limits.
    await settleAIRequest(req, { requestId, successful: true, providerReference: data?.id || "" });

    return responseJson(res, 200, {
      plan: normalizeUniformPlan(plan, input),
      model,
      requestId,
      remaining: reservation?.remaining ?? null,
      limit: reservation?.limit ?? null,
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("generate-uniform-design error", { requestId, timedOut, message: error?.message });
    await settleAIRequest(req, { requestId, successful: false });
    return responseJson(res, timedOut ? 504 : 500, {
      error: timedOut ? "AI uniform design timed out. Please try again." : "AI uniform design failed unexpectedly.",
      requestId,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function resetUniformRateLimitsForTests() {
  requestWindows.clear();
}
