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
      uniformOrder: true,
      refineAI: false,
      openAIPreview: false,
      openEditableStudio: true,
      discardAI: true,
      viewport: true,
      saveProgress: true,
      svgExport: false,
      fullscreen: true,
      download: true,
      settings: true,
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
      aiDesigner: false,
      uniformOrder: true,
      refineAI: true,
      openAIPreview: true,
      openEditableStudio: false,
      discardAI: false,
      viewport: true,
      saveProgress: true,
      svgExport: true,
      fullscreen: false,
      download: true,
      settings: true,
    });
  });

  it("replaces the AI Designer entry with Refine after a production design exists", () => {
    const capabilities = getStudioHeaderCapabilities({
      mode: STUDIO_MODES.EDITABLE,
      workspace: "design",
      hasAIResult: true,
      showingProductionMap: true,
    });
    expect(capabilities.aiDesigner).toBe(false);
    expect(capabilities.refineAI).toBe(true);
    expect(capabilities.uniformOrder).toBe(true);
  });

  it("keeps roster and review headers free of design-only controls", () => {
    for (const workspace of ["roster", "review"]) {
      expect(getStudioHeaderCapabilities({
        mode: STUDIO_MODES.EDITABLE,
        workspace,
        hasAIResult: true,
        canOpenProduction: true,
        hasStorage: true,
        showingProductionMap: true,
      })).toEqual({
        aiDesigner: false,
        uniformOrder: false,
        refineAI: false,
        openAIPreview: false,
        openEditableStudio: false,
        discardAI: false,
        viewport: false,
        saveProgress: true,
        svgExport: false,
        fullscreen: false,
        download: false,
        settings: false,
      });
    }
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
