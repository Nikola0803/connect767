import { describe, expect, it } from "vitest";
import { TEMPLATE_MODES, bundledReadyMadeTemplates, hasVerifiedEditableData, normalizeUniformTemplate } from "./uniformTemplates";

describe("uniform template model", () => {
  it("publishes only real bundled categories and excludes the blank canvas", () => {
    expect(bundledReadyMadeTemplates).toHaveLength(6);
    expect(bundledReadyMadeTemplates.some((template) => template.slug === "blank-canvas")).toBe(false);
    expect(new Set(bundledReadyMadeTemplates.map((template) => template.sportSlug))).toEqual(new Set(["soccer", "basketball", "netball", "cricket", "goalkeeper", "other"]));
  });

  it("downgrades an editable claim when verified masks or structured zones are missing", () => {
    const template = normalizeUniformTemplate({ id: 7, slug: "unsafe", status: "publish", title: { rendered: "Unsafe" }, acf: { template_mode: "editable", available_views: ["front", "back"], editable_zones: [], mask_asset: "" } });
    expect(template.templateMode).toBe(TEMPLATE_MODES.AI_PREVIEW);
    expect(hasVerifiedEditableData(template)).toBe(false);
  });

  it("accepts editable mode only with both views, a mask and editable zones", () => {
    const template = normalizeUniformTemplate({ id: 8, slug: "verified", status: "publish", title: { rendered: "Verified" }, acf: { template_mode: "editable", available_views: ["front", "back"], editable_zones: [{ key: "front" }], mask_asset: "https://example.test/mask.png" } });
    expect(template.templateMode).toBe(TEMPLATE_MODES.EDITABLE);
    expect(hasVerifiedEditableData(template)).toBe(true);
  });
});
