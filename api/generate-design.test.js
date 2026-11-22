import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { buildPrompt, normalizeBrief, resetRateLimitsForTests } from "./generate-design.js";

function request(method = "POST", body = {}) {
  return { method, body, headers: { "x-forwarded-for": "203.0.113.10", authorization: "Bearer signed-in-test" }, socket: {} };
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
  it("omits Basketball socks by default despite sock references in a generated palette", () => {
    const input = normalizeBrief({ ...validBrief, sport: "Basketball", generationMode: "uniform", notes: "Palette includes socks #064C35", userPrompt: "Create a green kit" });
    expect(buildPrompt(input)).toContain("Do not generate socks, shoes or other legwear in any view");
    const requested = normalizeBrief({ ...validBrief, sport: "Basketball", generationMode: "uniform", userPrompt: "Add matching socks" });
    expect(buildPrompt(requested)).toContain("The customer explicitly requested socks");
  });
  it("rejects anonymous and guest-token requests before contacting any service", async () => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    const req = request("POST", validBrief);
    delete req.headers.authorization;
    req.headers["x-c767-guest-token"] = "previously-issued-guest-session";
    const res = response(); await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload.requiresAccount).toBe(true);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("returns an actionable storage error and refunds a failed image save", async () => {
    process.env.C767_AI_SERVICE_SECRET = "shared-test-secret";
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes("/ai/reserve")) return { ok: true, status: 200, json: async () => ({ allowed: true, remaining: 4, limit: 5 }) };
      if (String(url).includes("api.openai.com")) return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: "private-original" }] }) };
      if (String(url).includes("/files/store")) return { ok: false, status: 500, json: async () => ({ code: "c767_file_store", message: "The generated file could not be securely saved. Please retry." }) };
      if (String(url).includes("/ai/settle")) return { ok: true, status: 200, json: async () => ({ status: "failed" }) };
      throw new Error("Unexpected endpoint");
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();
    await handler(request("POST", validBrief), res);
    expect(res.statusCode).toBe(500);
    expect(res.payload.error).toBe("The generated file could not be securely saved. Please retry.");
    expect(JSON.stringify(res.payload)).not.toContain("private-original");
    const settlement = fetchMock.mock.calls.find(([url]) => String(url).includes("/ai/settle"));
    expect(JSON.parse(settlement[1].body).successful).toBe(false);
  });
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
    delete process.env.C767_AI_SERVICE_SECRET;
    delete process.env.C767_AI_SECURITY_REQUIRED;
    delete process.env.C767_WP_BASE_URL;
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
    expect(prompt).toContain("exactly three separate horizontal stripes only at the top near the knee");
    expect(prompt).toContain("All three stripes must use the same single solid stripe colour");
    expect(prompt).toContain("Do not create a contrasting solid-colour cuff");
    expect(prompt).toContain("one perfectly uniform flat solid warm-white background (#F5F0E7)");
    expect(prompt).toContain("Connect767 C-and-AI emblem");
    expect(prompt).toContain("behind and partially obscured by the uniforms");
    expect(prompt).toContain("match the background colour exactly");
    expect(prompt).toContain("no black, white, coloured, metallic, or glossy fill");
    expect(prompt).toContain("Do not recolour the background");
  });

  it.each(["Soccer", "Basketball", "Netball", "Cricket", "Goal Keeper", "Other"])("keeps the same mandatory sock rule in every %s preview and refinement", (sport) => {
    for (const referenceImage of [undefined, "data:image/png;base64,reference"]) {
      const prompt = buildPrompt(normalizeBrief({ ...validBrief, sport, generationMode: "uniform", referenceImage }));
      expect(prompt).toContain("exactly three separate horizontal stripes only at the top near the knee");
      expect(prompt).toContain("same single solid stripe colour, consistent on both socks and in every view");
      expect(prompt).toContain("one uninterrupted solid base colour from cuff to toe");
      expect(prompt).toContain("cuff, heel or toe");
      expect(prompt).toContain("take priority over conflicting styling requests");
    }
  });

  it("reports connection health without exposing the key", async () => {
    const res = response();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      configured: true,
      model: "gpt-image-2.6-flare",
      previewModel: "gpt-image-2.6-flare",
      proofModel: "gpt-image-2.6-sunburst",
    });
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
    expect(upstreamBody).toMatchObject({ model: "gpt-image-2.6-sunburst", size: "1536x1024", quality: "high", complexity: "high", output_format: "png" });
    expect(res.payload).toMatchObject({ model: "gpt-image-2.6-sunburst", size: "1536x1024", quality: "high", renderTier: "proof" });
  });

  it("uses the fast Flare profile and compressed WebP for uniform previews", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: "cHJldmlldw==" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();

    await handler(request("POST", { ...validBrief, generationMode: "uniform", renderTier: "preview" }), res);

    const upstreamBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(upstreamBody).toMatchObject({
      model: "gpt-image-2.6-flare",
      size: "1024x1024",
      quality: "medium",
      complexity: "medium",
      output_format: "webp",
      output_compression: 88,
    });
    expect(res.payload).toMatchObject({ mimeType: "image/webp", renderTier: "preview" });
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
    expect(options.body.get("prompt")).toContain("Replace the existing background with the required single flat background");
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

  it("blocks a direct AI request when the authoritative guest allowance is exhausted", async () => {
    process.env.C767_AI_SERVICE_SECRET = "shared-test-secret";
    process.env.C767_AI_SECURITY_REQUIRED = "1";
    process.env.C767_WP_BASE_URL = "https://cms.example.test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        code: "c767_ai_limit_reached",
        message: "Your free AI design previews have been used. Create a free Connect767 account to continue designing.",
        data: { remaining: 0, limit: 3, requiresAccount: true },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();
    const req = request("POST", { ...validBrief, projectId: "project-1" });
    req.headers["x-c767-request-id"] = "request-1";
    req.headers["x-c767-guest-token"] = "signed-guest-token";

    await handler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.payload).toMatchObject({ remaining: 0, limit: 3, requiresAccount: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/design-security/ai/reserve");
  });

  it("returns only the secured watermarked preview while the original is stored server-side", async () => {
    process.env.C767_AI_SERVICE_SECRET = "shared-test-secret";
    process.env.C767_AI_SECURITY_REQUIRED = "1";
    process.env.C767_WP_BASE_URL = "https://cms.example.test";
    const original = "b3JpZ2luYWw=";
    const watermarked = "d2F0ZXJtYXJrZWQ=";
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes("/ai/reserve")) return { ok: true, status: 200, json: async () => ({ allowed: true, remaining: 2, limit: 3 }) };
      if (url === "https://api.openai.com/v1/images/generations") return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: original }], id: "provider-1" }) };
      if (String(url).includes("/files/store")) return { ok: true, status: 200, json: async () => ({ fileId: 71, b64: watermarked, mimeType: "image/png", previewOnly: true, watermarked: true }) };
      if (String(url).includes("/ai/settle")) return { ok: true, status: 200, json: async () => ({ status: "completed" }) };
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = response();
    const req = request("POST", { ...validBrief, projectId: "project-1" });
    req.headers["x-c767-request-id"] = "request-2";
    req.headers["x-c767-guest-token"] = "signed-guest-token";

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ b64: watermarked, projectFileId: 71, previewOnly: true, watermarked: true });
    expect(res.payload.b64).not.toBe(original);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      expect.stringContaining("/ai/reserve"),
      expect.stringContaining("/files/store"),
      expect.stringContaining("/ai/settle"),
    ]));
  });
});
