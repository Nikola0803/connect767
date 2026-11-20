import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, {
  buildUniformPrompt,
  normalizeUniformPlan,
  normalizeUniformRequest,
  resetUniformRateLimitsForTests,
} from "./generate-uniform-design.js";

function request(method = "POST", body = {}) {
  return { method, body, headers: { "x-forwarded-for": "203.0.113.25" }, socket: {} };
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

const validRequest = {
  sport: "Soccer",
  style: "Modern & Bold",
  brandName: "Island FC",
  brief: "A deep green kit with coral trim and a clean diagonal pattern.",
  collarOptions: ["Crew", "V-Neck", "Polo"],
  sleeveOptions: ["Short", "Long", "Sleeveless", "Mixed"],
  current: {
    collar: "Crew",
    sleeve: "Short",
    colors: {
      body: "#FFFFFF", sleeve: "#FFFFFF", collar: "#FFFFFF", shorts: "#FFFFFF",
      socks: "#FFFFFF", shirtStrip: "#E8E4DA", sleeveStrip: "#E8E4DA", shortsStrip: "#E8E4DA",
    },
    patternKey: "none",
  },
  locks: { collar: false, sleeve: false, colors: false, pattern: false, artwork: true },
};

const upstreamPlan = {
  name: "Island Motion",
  summary: "Emerald kit with coral finishing and a diagonal identity graphic.",
  collar: "V-Neck",
  sleeve: "Short",
  colors: {
    body: "#086B44", sleeve: "#064C35", collar: "#F05A3C", shorts: "#086B44",
    socks: "#064C35", shirtStrip: "#F05A3C", sleeveStrip: "#F05A3C", shortsStrip: "#F05A3C",
  },
  pattern: { enabled: true, key: "diagonal", view: "both" },
  crestSuggestion: "A circular Island FC crest with a wave and football.",
  productionElements: [
    { kind: "artwork", content: "A circular Island FC crest with a wave and football.", view: "front", x: 35, y: 30, size: 18, rotation: 0, color: "#FFFFFF", layout: "single-line" },
    { kind: "text", content: "ISLAND FC", view: "front", x: 50, y: 46, size: 14, rotation: 0, color: "#FFFFFF", layout: "stacked" },
    { kind: "text", content: "10", view: "back", x: 50, y: 44, size: 22, rotation: 0, color: "#FFFFFF", layout: "single-line" },
  ],
};

describe("AI full-uniform design endpoint", () => {
  beforeEach(() => {
    resetUniformRateLimitsForTests();
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.OPENAI_TEXT_MODEL = "gpt-6-luna";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TEXT_MODEL;
  });

  it("validates the brief and constrains editor options", () => {
    const input = normalizeUniformRequest(validRequest);
    expect(input.collarOptions).toEqual(["Crew", "V-Neck", "Polo"]);
    expect(input.current.colors.body).toBe("#FFFFFF");
    expect(() => normalizeUniformRequest({ ...validRequest, brief: "" })).toThrow(/describe/i);
  });

  it("accepts a safe reference image and rejects unsupported image data", () => {
    const png = `data:image/png;base64,${Buffer.from("reference").toString("base64")}`;
    expect(normalizeUniformRequest({ ...validRequest, referenceImage: png }).referenceImage).toBe(png);
    expect(() => normalizeUniformRequest({
      ...validRequest,
      referenceImage: "data:image/svg+xml;base64,PHN2Zy8+",
    })).toThrow(/PNG, JPEG or WebP/i);
  });

  it("instructs the model to use editable zones and restricted socks", () => {
    const prompt = buildUniformPrompt(normalizeUniformRequest(validRequest));
    expect(prompt).toContain("Socks must remain one uninterrupted solid base color from cuff to toe");
    expect(prompt).toContain("exactly three separate horizontal stripes");
    expect(prompt).toContain("All three stripes must use the same single solid stripe color");
    expect(prompt).toContain("visible base-color gaps between stripes");
    expect(prompt).toContain("Never create a contrasting solid-color cuff");
    expect(prompt).toContain("Do not invent side panels");
    expect(prompt).toContain("Allowed collars");
    expect(prompt).toContain("all three editable surfaces: front, side, and back");
    expect(prompt).toContain("Set view to front, side, or back");
    expect(prompt).toContain("The concept image and production map must use the same text layout");
    expect(prompt).toContain("Use x 50 for horizontally centered chest artwork");
    expect(prompt).toContain("It never means one jersey with different left and right sleeves");
  });

  it("normalizes AI polo and mixed-order wording to priced studio options", () => {
    const input = normalizeUniformRequest(validRequest);
    const plan = normalizeUniformPlan({
      ...upstreamPlan,
      collar: "polo-style collar",
      sleeve: "mixed sleeve team order",
    }, input);

    expect(plan.collar).toBe("Polo");
    expect(plan.sleeve).toBe("Mixed");
  });

  it("preserves Side artwork and all-surface patterns in the normalized AI plan", () => {
    const input = normalizeUniformRequest({
      ...validRequest,
      locks: { ...validRequest.locks, artwork: false },
    });
    const plan = normalizeUniformPlan({
      ...upstreamPlan,
      pattern: { enabled: true, key: "diagonal", view: "all" },
      productionElements: [
        { kind: "text", content: "ISLAND", view: "side", x: 50, y: 42, size: 14, rotation: 0, color: "#FFFFFF", layout: "single-line" },
      ],
    }, input);

    expect(plan.pattern.view).toBe("all");
    expect(plan.productionElements).toEqual([
      expect.objectContaining({ kind: "text", content: "ISLAND", view: "side" }),
    ]);
  });

  it("enforces locks after generation instead of trusting the model", () => {
    const input = normalizeUniformRequest({
      ...validRequest,
      locks: { collar: true, sleeve: false, colors: true, pattern: false, artwork: true },
    });
    const plan = normalizeUniformPlan(upstreamPlan, input);
    expect(plan.collar).toBe("Crew");
    expect(plan.sleeve).toBe("Short");
    expect(plan.colors).toEqual(input.current.colors);
    expect(plan.crestSuggestion).toBe("");
    expect(plan.productionElements).toEqual([]);
  });

  it("reports configuration without exposing the key", async () => {
    const res = response();
    await handler(request("GET"), res);
    expect(res.payload).toEqual({ configured: true, model: "gpt-6-luna" });
    expect(JSON.stringify(res.payload)).not.toContain("test-only-key");
  });

  it("calls Responses structured output and returns a normalized plan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ output: [{ content: [{ type: "output_text", text: JSON.stringify(upstreamPlan) }] }] }),
    }));
    const res = response();
    await handler(request("POST", {
      ...validRequest,
      locks: { ...validRequest.locks, artwork: false },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.plan).toMatchObject({ collar: "V-Neck", sleeve: "Short" });
    expect(res.payload.plan.colors.socks).toBe("#064C35");
    expect(res.payload.plan.productionElements).toHaveLength(3);
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "uniform_design_plan", strict: true });
    expect(body.safety_identifier).toMatch(/^[a-f0-9]{64}$/);
    expect(options.headers.Authorization).toBe("Bearer test-only-key");
  });

  it("normalizes editable text and artwork production elements", () => {
    const input = normalizeUniformRequest({
      ...validRequest,
      locks: { ...validRequest.locks, artwork: false },
    });
    const plan = normalizeUniformPlan({
      ...upstreamPlan,
      productionElements: [
        ...upstreamPlan.productionElements,
        { kind: "artwork", content: "A second crest", view: "front", x: 200, y: -10, size: 100, rotation: 400, color: "invalid", layout: "single-line" },
      ],
    }, input);

    expect(plan.productionElements).toHaveLength(3);
    expect(plan.productionElements[0]).toMatchObject({ kind: "artwork", x: 35, y: 30, size: 18 });
    expect(plan.productionElements[1]).toMatchObject({ kind: "text", content: "ISLAND FC" });
    expect(plan.productionElements[1].layout).toBe("stacked");
  });

  it("sends an uploaded inspiration image as multimodal model input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ output: [{ content: [{ type: "output_text", text: JSON.stringify(upstreamPlan) }] }] }),
    }));
    const reference = `data:image/jpeg;base64,${Buffer.from("reference-photo").toString("base64")}`;
    const res = response();
    await handler(request("POST", { ...validRequest, referenceImage: reference }), res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.input[1].content).toContainEqual({
      type: "input_image",
      image_url: reference,
      detail: "high",
    });
    expect(body.input[1].content[0].text).toContain("inspiration image is attached");
  });

  it("does not leak a rejected key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Incorrect key test-only-key" } }),
    }));
    const res = response();
    await handler(request("POST", validRequest), res);
    expect(res.statusCode).toBe(502);
    expect(res.payload.error).toMatch(/rejected/i);
    expect(JSON.stringify(res.payload)).not.toContain("test-only-key");
  });
});
