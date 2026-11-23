import { templates as bundledTemplates } from "./uniforms";
import { uniformSampleFor } from "../components/uniform-studio/uniformSamples";
import { config, isLiveApi } from "../lib/config";

export const TEMPLATE_MODES = Object.freeze({
  AI_PREVIEW: "ai-preview",
  EDITABLE: "editable",
});

const styleBySport = {
  soccer: ["Modern", "Classic"],
  basketball: ["Classic", "Bold"],
  netball: ["Modern", "Minimal"],
  cricket: ["Classic", "Performance"],
  goalkeeper: ["Bold", "Performance"],
  other: ["Modern", "Performance"],
};

const colorsBySport = {
  soccer: ["Green", "White", "Orange"],
  basketball: ["Black", "White"],
  netball: ["Green", "White"],
  cricket: ["White", "Green"],
  goalkeeper: ["Black", "Green"],
  other: ["Navy", "Orange"],
};

function bundledTemplateModel(template, index) {
  const sample = uniformSampleFor(template.sportSlug);
  return {
    id: `bundled-${template.slug}`,
    slug: template.slug,
    name: template.name,
    sportSlug: template.sportSlug,
    garmentType: template.defaultSleeve === "Sleeveless" ? "Sleeveless kit" : "Team uniform",
    description: template.description,
    frontAsset: sample.preview,
    backAsset: sample.src,
    availableViews: ["front", "back"],
    supportedColors: colorsBySport[template.sportSlug] || [],
    editableZones: [],
    patterns: [],
    logoPlacementZones: [],
    nameNumberPlacement: false,
    variations: [template.defaultCollar, template.defaultSleeve].filter(Boolean),
    styleTags: styleBySport[template.sportSlug] || ["Modern"],
    templateMode: TEMPLATE_MODES.AI_PREVIEW,
    publicationStatus: "published",
    featured: index < 3,
    createdAt: `2026-11-${String(20 - index).padStart(2, "0")}`,
    defaultCollar: template.defaultCollar,
    defaultSleeve: template.defaultSleeve,
  };
}

export const bundledReadyMadeTemplates = bundledTemplates
  .filter((template) => template.slug !== "blank-canvas")
  .map(bundledTemplateModel);

export function hasVerifiedEditableData(template) {
  return Boolean(template?.templateMode === TEMPLATE_MODES.EDITABLE
    && template.availableViews?.includes("front")
    && template.availableViews?.includes("back")
    && template.editableZones?.length > 0
    && template.maskAsset);
}

export function normalizeUniformTemplate(raw) {
  const meta = raw?.acf || raw?.meta || raw || {};
  const mode = meta.template_mode === TEMPLATE_MODES.EDITABLE
    ? TEMPLATE_MODES.EDITABLE
    : TEMPLATE_MODES.AI_PREVIEW;
  const template = {
    id: String(raw?.id || meta.id || raw?.slug || ""),
    slug: raw?.slug || meta.slug || "",
    name: raw?.title?.rendered || meta.name || "Untitled Template",
    description: meta.description || "",
    sportSlug: meta.sport_slug || "soccer",
    garmentType: meta.garment_type || "Team uniform",
    frontAsset: meta.front_asset || raw?._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "",
    backAsset: meta.back_asset || "",
    maskAsset: meta.mask_asset || "",
    availableViews: meta.available_views || [],
    supportedColors: meta.supported_colors || [],
    editableZones: meta.editable_zones || [],
    patterns: meta.patterns || [],
    logoPlacementZones: meta.logo_placement_zones || [],
    nameNumberPlacement: Boolean(meta.name_number_placement),
    variations: meta.garment_variations || [],
    styleTags: meta.style_tags || [],
    templateMode: mode,
    publicationStatus: raw?.status === "publish" || meta.publication_status === "published" ? "published" : "draft",
    featured: Boolean(meta.featured),
    createdAt: raw?.date || meta.created_at || "",
    defaultCollar: meta.default_collar || "Crew",
    defaultSleeve: meta.default_sleeve || "Short",
  };
  if (!hasVerifiedEditableData(template)) template.templateMode = TEMPLATE_MODES.AI_PREVIEW;
  return template;
}

export async function loadReadyMadeTemplates() {
  if (!isLiveApi) return bundledReadyMadeTemplates;
  try {
    const response = await fetch(`${config.wpApiUrl}/uniform_template?status=publish&per_page=100&_embed=wp:featuredmedia`);
    if (!response.ok) throw new Error("Template gallery unavailable");
    const cmsTemplates = (await response.json()).map(normalizeUniformTemplate)
      .filter((template) => template.slug && template.frontAsset && template.publicationStatus === "published");
    return cmsTemplates.length ? cmsTemplates : bundledReadyMadeTemplates;
  } catch {
    return bundledReadyMadeTemplates;
  }
}

export const findReadyMadeTemplate = (slug, templates = bundledReadyMadeTemplates) => (
  templates.find((template) => template.slug === slug) || null
);
