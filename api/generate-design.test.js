import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { buildPrompt, normalizeBrief, resetRateLimitsForTests } from "./generate-design.js";

function request(method = "POST", body = {}) {
  return { method, body, headers: { "x-forwarded-for": "203.0.113.10" }, socket: {} };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(payload) { this.payload = payload; return this; },
  };
}

const validBrief = {
  productType: "Jersey",
  style: "Modern & Bold",
  brandName: "Island FC",
  tagline: "Play together",
  primaryColor: "#006B3F",
  secondaryColor: "#FCD116",
  generationMode: "artwork",
  sport: "Soccer",
};

describe("AI design generation endpoint", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.6-flare";
    process.env.OPENAI_IMAGE_PREVIEW_QUALITY = "medium";
    process.env.OPENAI_IMAGE_PROOF_QUALITY = "high";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_PREVIEW_QUALITY;
    delete process.env.OPENAI_IMAGE_PROOF_QUALITY;
  });

  it("validates and constrains the customer brief", () => {
    const brief = normalizeBrief({ ...validBrief, notes: "x".repeat(2000) });
    expect(brief.notes).toHaveLength(1200);
    expect(brief.primaryColor).toBe("#006B3F");
    expect(brief.renderTier).toBe("preview");
    expect(() => normalizeBrief({ ...validBrief, productType: "Unknown" })).toThrow("supported product");
  });

  it("builds an isolated transparent-artwork prompt", () => {
    const prompt = buildPrompt(normalizeBrief(validBrief));
    expect(prompt).toContain("transparent background");
    expect(prompt).toContain("Sport: Soccer");
    expect(prompt).toContain("Do not show a garment");
  });

  it("builds a complete Front / Side / Back uniform concept prompt", () => {
    const prompt = buildPrompt(normalizeBrief({ ...validBrief, generationMode: "uniform" }));
    expect(prompt).toContain("complete Soccer uniform design concept");
    expect(prompt).toContain("complete front view, strict 90-degree side view, and complete back view");
    expect(prompt).toContain("shorts or trousers");
    expect(prompt).toContain("socks");
  });

  it("reports connection health without exposing the key", async () => {
    const res = response();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ configured: true, model: "gpt-image-2.6-flare" });
    expect(JSON.stringify(res.payload)).not.toContain("test-only-key");
  });

  it("returns a clear setup error when the server key is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = response();
    await handler(request("POST", validBrief), res);
    expect(res.statusCode).toBe(503);
    expect(res.payload.error).toMatch(/not configured/i);
  });

  it("calls the current Images API contract and returns base64 PNG data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: "cG5n" }], usage: { total_tokens: 42 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();

    await handler(request("POST", validBrief), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ b64: "cG5n", mimeType: "image/png", mode: "artwork" });
    const [url, options] = fetchMock.mock.calls[0];
    const upstreamBody = JSON.parse(options.body);
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(upstreamBody).toMatchObject({
      model: "gpt-image-2.6-flare",
      output_format: "png",
      background: "transparent",
      size: "1024x1024",
      quality: "medium",
    });
    expect(upstreamBody.safety_identifier).toMatch(/^[a-f0-9]{64}$/);
    expect(options.headers.Authorization).toBe("Bearer test-only-key");
  });

  it("renders high-quality uniform proofs on a landscape canvas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: "cHJvb2Y=" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();

    await handler(request("POST", {
      ...validBrief,
      generationMode: "uniform",
      renderTier: "proof",
    }), res);

    const upstreamBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(upstreamBody).toMatchObject({ size: "1536x1024", quality: "high" });
    expect(res.payload).toMatchObject({ size: "1536x1024", quality: "high", renderTier: "proof" });
  });

  it("uses the image edit endpoint when refining an existing uniform concept", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: "cmV2aXNlZA==" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();
    const referenceImage = "data:image/png;base64,cG5n";

    await handler(request("POST", {
      ...validBrief,
      generationMode: "uniform",
      notes: "Keep everything else and make the shorts black.",
      referenceImage,
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.b64).toBe("cmV2aXNlZA==");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("model")).toBe("gpt-image-2.6-flare");
    expect(options.body.get("prompt")).toContain("Edit the provided complete Soccer uniform concept");
    expect(options.body.get("prompt")).toContain("make the shorts black");
    expect(options.body.get("image")).toBeInstanceOf(Blob);
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("does not leak a rejected credential to the browser", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Incorrect API key: test-only-key" } }),
    }));
    const res = response();
    await handler(request("POST", validBrief), res);
    expect(res.statusCode).toBe(502);
    expect(res.payload.error).toMatch(/rejected the server credential/i);
    expect(JSON.stringify(res.payload)).not.toContain("test-only-key");
  });
});
