import { describe, expect, it } from "vitest";
import {
  STUDIO_MODES,
  canUseManualEditing,
  isAIPreviewMode,
  validateEditableUniformPlan,
} from "./studioModes";

const validPlan = {
  conceptImage: { src: "data:image/png;base64,preview" },
  collar: "Crew",
  sleeve: "Short",
  colors: {
    body: "#112233",
    sleeve: "#112233",
    collar: "#ffffff",
    shorts: "#112233",
    socks: "#ffffff",
    shirtStrip: "#ff6633",
    sleeveStrip: "#ff6633",
    shortsStrip: "#ff6633",
  },
  productionElements: [{ kind: "text", view: "front", x: 50, y: 35, content: "TEAM" }],
};

describe("uniform studio modes", () => {
  it("allows manual editing only in verified editable mode", () => {
    expect(canUseManualEditing(STUDIO_MODES.EDITABLE)).toBe(true);
    expect(canUseManualEditing(STUDIO_MODES.AI_OUTPUT)).toBe(false);
    expect(canUseManualEditing(STUDIO_MODES.AI_GENERATING)).toBe(false);
    expect(isAIPreviewMode(STUDIO_MODES.AI_OUTPUT)).toBe(true);
    expect(isAIPreviewMode(STUDIO_MODES.AI_GENERATING)).toBe(true);
  });

  it("does not treat a flat AI image as editable", () => {
    expect(validateEditableUniformPlan({ conceptImage: validPlan.conceptImage }, { hasVerifiedTemplate: true }).valid).toBe(false);
  });

  it("requires both a verified template and a valid structured plan", () => {
    expect(validateEditableUniformPlan(validPlan).valid).toBe(false);
    expect(validateEditableUniformPlan(validPlan, { hasVerifiedTemplate: true }).valid).toBe(true);
  });
});
