import { describe, expect, it } from "vitest";
import {
  STUDIO_MODES,
  canUseManualEditing,
  getStudioHeaderCapabilities,
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

  it("shows only working controls in AI preview mode", () => {
    expect(getStudioHeaderCapabilities({
      mode: STUDIO_MODES.AI_OUTPUT,
      hasAIResult: true,
      canOpenProduction: true,
      hasStorage: true,
      showingAIConcept: true,
    })).toEqual({
      aiDesigner: false,
      openAIPreview: false,
      openEditableStudio: true,
      discardAI: true,
      viewport: true,
      saveProgress: true,
      svgExport: false,
      fullscreen: true,
      download: true,
      settings: false,
    });
  });

  it("enables the editable production toolset only in production mode", () => {
    expect(getStudioHeaderCapabilities({
      mode: STUDIO_MODES.EDITABLE,
      hasAIResult: true,
      canOpenProduction: true,
      hasStorage: true,
      showingProductionMap: true,
    })).toEqual({
      aiDesigner: true,
      openAIPreview: true,
      openEditableStudio: false,
      discardAI: true,
      viewport: true,
      saveProgress: true,
      svgExport: true,
      fullscreen: false,
      download: true,
      settings: true,
    });
  });

  it("hides canvas actions while an AI preview has no render target", () => {
    const capabilities = getStudioHeaderCapabilities({
      mode: STUDIO_MODES.AI_GENERATING,
      hasStorage: true,
    });
    expect(capabilities.viewport).toBe(false);
    expect(capabilities.openAIPreview).toBe(false);
    expect(capabilities.openEditableStudio).toBe(false);
    expect(capabilities.download).toBe(false);
    expect(capabilities.svgExport).toBe(false);
    expect(capabilities.fullscreen).toBe(false);
    expect(capabilities.saveProgress).toBe(true);
  });
});
