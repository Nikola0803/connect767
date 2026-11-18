export const STUDIO_MODES = Object.freeze({
  AI_OUTPUT: "ai_output",
  AI_GENERATING: "ai_generating",
  EDITABLE: "editable",
});

export const isAIPreviewMode = (mode) => (
  mode === STUDIO_MODES.AI_OUTPUT || mode === STUDIO_MODES.AI_GENERATING
);

export const canUseManualEditing = (mode) => mode === STUDIO_MODES.EDITABLE;

const requiredColorZones = [
  "body",
  "sleeve",
  "collar",
  "shorts",
  "socks",
  "shirtStrip",
  "sleeveStrip",
  "shortsStrip",
];

/**
 * A generated bitmap is never editable by itself. Conversion is permitted
 * only when the AI response also contains a complete structured garment plan
 * that can be mapped onto the studio's verified template and production
 * layers. This check is deliberately strict so a malformed response cannot
 * unlock manual controls.
 */
export function validateEditableUniformPlan(plan, { hasVerifiedTemplate = false } = {}) {
  if (!hasVerifiedTemplate) return { valid: false, reason: "No verified editable garment template is available." };
  if (!plan?.conceptImage?.src?.startsWith("data:image/")) {
    return { valid: false, reason: "The original AI preview is missing." };
  }
  if (!plan.collar || !plan.sleeve) {
    return { valid: false, reason: "The garment construction data is incomplete." };
  }
  if (!plan.colors || requiredColorZones.some((zone) => !/^#[0-9a-f]{6}$/i.test(plan.colors[zone] || ""))) {
    return { valid: false, reason: "One or more editable garment color zones could not be verified." };
  }
  if (!Array.isArray(plan.productionElements)) {
    return { valid: false, reason: "Editable artwork layers were not supplied." };
  }
  const invalidElement = plan.productionElements.some((element) => (
    !["text", "artwork"].includes(element?.kind)
    || !["front", "side", "back"].includes(element?.view)
    || !Number.isFinite(Number(element?.x))
    || !Number.isFinite(Number(element?.y))
    || Number(element.x) < 0
    || Number(element.x) > 100
    || Number(element.y) < 0
    || Number(element.y) > 100
  ));
  if (invalidElement) return { valid: false, reason: "One or more production layers failed validation." };
  return { valid: true, reason: "Verified garment zones and production layers are available." };
}
