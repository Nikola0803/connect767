import { createHash, randomUUID } from "node:crypto";

export const config = { maxDuration: 60 };

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
const DEFAULT_MODEL = "gpt-image-2.6-flare";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 6;
const requestWindows = new Map();

const PRODUCTS = new Set(["T-Shirt", "Jersey", "Hoodie", "Polo", "Cap", "Tote Bag"]);
const STYLES = new Set(["Modern & Bold", "Classic & Clean", "Minimal & Elegant", "Retro & Vintage", "Street & Edgy"]);
const MODES = new Set(["garment", "artwork", "uniform"]);
const SPORTS = new Set(["Soccer", "Basketball", "Netball", "Cricket", "Goal Keeper", "Other"]);

function text(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function referenceImage(value) {
  if (typeof value !== "string" || !value) return "";
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=]+)$/i);
  if (!match || match[2].length > 7_000_000) throw new Error("Use a PNG, JPEG, or WebP reference image under 5 MB.");
  return value;
}

function imageFileFromDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/i);
  if (!match) throw new Error("The reference image could not be prepared.");
  const subtype = match[1].toLowerCase();
  const mimeType = subtype === "jpeg" ? "image/jpeg" : `image/${subtype}`;
  const extension = subtype === "jpeg" ? "jpg" : subtype;
  return {
    blob: new Blob([Buffer.from(match[2], "base64")], { type: mimeType }),
    filename: `uniform-reference.${extension}`,
  };
}

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

export function normalizeBrief(body = {}) {
  const productType = text(body.productType, 40);
  const style = text(body.style, 60);
  const brandName = text(body.brandName, 80);
  const tagline = text(body.tagline, 120);
  const notes = text(body.notes, 1200);
  const primaryColor = /^#[0-9a-f]{6}$/i.test(body.primaryColor) ? body.primaryColor.toUpperCase() : "#111111";
  const secondaryColor = /^#[0-9a-f]{6}$/i.test(body.secondaryColor) ? body.secondaryColor.toUpperCase() : "#FFFFFF";
  const generationMode = MODES.has(body.generationMode) ? body.generationMode : "garment";
  const sport = SPORTS.has(body.sport) ? body.sport : "";
  const inputImage = referenceImage(body.referenceImage);

  if (!PRODUCTS.has(productType)) throw new Error("Choose a supported product type.");
  if (!STYLES.has(style)) throw new Error("Choose a supported design style.");
  if (!brandName) throw new Error("Brand or team name is required.");

  return { productType, style, brandName, tagline, notes, primaryColor, secondaryColor, generationMode, sport, referenceImage: inputImage };
}

export function buildPrompt(brief) {
  const identity = [
    `Brand or team name: ${JSON.stringify(brief.brandName)}.`,
    brief.productType === "Jersey" && brief.sport ? `Sport: ${brief.sport}.` : "",
    brief.tagline ? `Tagline: ${JSON.stringify(brief.tagline)}.` : "",
    `Use ${brief.primaryColor} as the primary colour and ${brief.secondaryColor} as the secondary colour.`,
    brief.notes ? `Customer requirements: ${brief.notes}` : "",
  ].filter(Boolean).join(" ");

  if (brief.generationMode === "artwork") {
    return [
      `Create one production-ready apparel graphic for a ${brief.productType}.`,
      `Visual direction: ${brief.style}. ${identity}`,
      "Return only the isolated printable artwork on a transparent background.",
      "Do not show a garment, mannequin, model, room, mockup, frame, watermark, colour swatch, or presentation board.",
      "Keep all important artwork within the centre 80 percent with crisp edges and strong legibility suitable for sublimation, screen printing, or embroidery digitization.",
    ].join(" ");
  }

  if (brief.generationMode === "uniform") {
    return [
      brief.referenceImage
        ? `Edit the provided complete ${brief.sport || "sports"} uniform concept according to the requested revision.`
        : `Create a realistic professional complete ${brief.sport || "sports"} uniform design concept.`,
      `Visual direction: ${brief.style}. ${identity}`,
      brief.referenceImage
        ? "Preserve the same front-side-back presentation, garment type, camera, proportions, background, and every feature the customer did not explicitly ask to change."
        : "",
      "Show three coordinated views side by side: the complete front view, strict 90-degree side view, and complete back view of the same uniform.",
      "Each view must include every applicable garment piece, including the jersey or dress, shorts or trousers, and socks when the sport uses socks.",
      "Keep all three uniforms fully visible, equally scaled, centred, and separated on a clean warm-white studio background.",
      "Use realistic performance fabric, stitching, seams, folds, highlights, and shadows while keeping the colors, trims, pattern, and design identity clearly readable.",
      "Do not show a person, mannequin head, hands, shoes, props, watermark, colour swatches, UI, presentation board, cropped garment, or duplicate angle.",
      "This is a customer-facing full-uniform design proof, not a manufacturing pattern or technical cut file.",
    ].filter(Boolean).join(" ");
  }

  return [
    `Create a realistic professional front-facing ${brief.productType} design concept.`,
    `Visual direction: ${brief.style}. ${identity}`,
    "Show exactly one complete garment, centred and fully visible, on a clean warm-white studio background.",
    "Use realistic performance fabric, stitching, seams, folds, highlights, and shadows while keeping every design feature clearly readable.",
    "No person, mannequin head, hands, feet, props, watermark, colour swatches, UI, presentation board, or duplicate garment.",
    "This is a customer design proof, not a manufacturing pattern or technical cut file.",
  ].join(" ");
}

function responseJson(res, status, payload) {
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;

  if (req.method === "GET") {
    return responseJson(res, 200, { configured: Boolean(apiKey), model });
  }
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "GET, POST");
    return responseJson(res, 405, { error: "Method not allowed" });
  }
  if (!apiKey) {
    return responseJson(res, 503, { error: "AI generation is not configured on the server yet." });
  }

  let brief;
  try {
    brief = normalizeBrief(req.body || {});
  } catch (error) {
    return responseJson(res, 400, { error: error.message });
  }

  const limit = rateLimit(req);
  if (!limit.allowed) {
    res.setHeader?.("Retry-After", String(limit.retryAfter));
    return responseJson(res, 429, { error: "Generation limit reached. Please wait a few minutes and try again." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const requestId = randomUUID();

  try {
    let upstreamUrl = OPENAI_IMAGES_URL;
    let upstreamBody;
    let upstreamHeaders = {
      Authorization: `Bearer ${apiKey}`,
      "X-Client-Request-Id": requestId,
    };

    if (brief.referenceImage) {
      upstreamUrl = OPENAI_IMAGE_EDITS_URL;
      const form = new FormData();
      const image = imageFileFromDataUrl(brief.referenceImage);
      form.append("model", model);
      form.append("prompt", buildPrompt(brief));
      form.append("image", image.blob, image.filename);
      form.append("n", "1");
      form.append("size", "1024x1024");
      form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
      form.append("output_format", "png");
      form.append("background", brief.generationMode === "artwork" ? "transparent" : "opaque");
      form.append("safety_identifier", safetyIdentifier(req));
      upstreamBody = form;
    } else {
      upstreamHeaders = { ...upstreamHeaders, "Content-Type": "application/json" };
      upstreamBody = JSON.stringify({
        model,
        prompt: buildPrompt(brief),
        n: 1,
        size: "1024x1024",
        quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
        output_format: "png",
        background: brief.generationMode === "artwork" ? "transparent" : "opaque",
        safety_identifier: safetyIdentifier(req),
      });
    }

    const generation = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: upstreamBody,
      signal: controller.signal,
    });

    const data = await generation.json().catch(() => ({}));
    if (!generation.ok) {
      const status = generation.status === 401 ? 502 : generation.status;
      const message = generation.status === 401
        ? "The AI service rejected the server credential."
        : data?.error?.message || "The AI image service could not complete this design.";
      return responseJson(res, status, { error: message, requestId });
    }

    const image = data.data?.[0];
    if (!image?.b64_json) {
      return responseJson(res, 502, { error: "The AI service returned no image.", requestId });
    }

    return responseJson(res, 200, {
      b64: image.b64_json,
      mimeType: "image/png",
      mode: brief.generationMode,
      model,
      size: data.size || "1024x1024",
      usage: data.usage || null,
      revisedPrompt: image.revised_prompt || null,
      requestId,
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("generate-design error", { requestId, timedOut, message: error?.message });
    return responseJson(res, timedOut ? 504 : 500, {
      error: timedOut ? "AI generation timed out. Please try again." : "AI generation failed unexpectedly.",
      requestId,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function resetRateLimitsForTests() {
  requestWindows.clear();
}
