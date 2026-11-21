import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import * as THREE from "three";
import {
  sports,
  templates,
  defaultZoneColors,
  normalizeZoneColors,
  fontOptions,
  fitTypeOptions,
  kitTypeOptions,
  shirtSizeOptions,
  shortSizeOptions,
  kitUnitPrice,
  mixedSleeveSurcharge,
  kitAddOnBreakdown,
  ADD_ON_PRICES,
  minimumFullKitsFor,
  uniformPricingFor,
  fullKitCount as rosterUnitCount,
  normalizeExtraTeamShirts,
  extraTeamShirtCount,
  sportConfigFor,
  sportModelUrl,
} from "../data/uniforms";
import JerseyStage from "../components/uniform-studio/JerseyStage";
import ProductionViewport from "../components/uniform-studio/ProductionViewport";
import useGarmentColors from "../components/uniform-studio/useGarmentColors";
import { detectGarmentCapabilities } from "../components/uniform-studio/garmentCapabilities";
import {
  STUDIO_MODES,
  canUseManualEditing,
  getStudioHeaderCapabilities,
  isAIPreviewMode,
  validateEditableUniformPlan,
} from "../components/uniform-studio/studioModes";
import {
  formatProductionText,
  mapProductionElementToGarment,
  normalizeStoredProductionLayer,
  productionTextLayout,
} from "../components/uniform-studio/productionPlacement";
import FloatingToolbar from "../components/uniform-studio/FloatingToolbar";
import {
  OptionsPanel,
  UniformSetupPanel,
  ZoneEditorPanel,
  TextPanel,
  LogoPanel,
  BackgroundRemovalPanel,
  AIArtworkPanel,
  LayersPanel,
  StudioBackgroundPanel,
  SkinsPanel,
} from "../components/uniform-studio/StudioPanels";
import { cloneZoneModel, SOCCER_ZONE_MODEL } from "../components/uniform-studio/uniformZoneModel";
import {
  DEFAULT_STUDIO_BACKGROUND,
  isDarkStudioBackground,
  normalizeStudioBackground,
} from "../components/uniform-studio/studioBackgrounds";
import {
  AI_PREVIEW_BACKGROUND_FALLBACK,
  sampleImageEdgeColor,
} from "../components/uniform-studio/aiPreviewBackground";
import { skinDataUri } from "../data/skins";
import { embossConnect767ConceptBackground } from "../components/uniform-studio/aiConceptEmboss";
import Button from "../components/ui/Button";
import SelectedItemPanel from "../components/uniform-studio/SelectedItemPanel";
import {
  isRestrictedSoccerSockPlacement,
  removeRestrictedSoccerSockLayers,
} from "../components/uniform-studio/sockRestrictions";
import { Input, RequiredIndicator, Select, Textarea } from "../components/ui/FormField";
import DemoModeNotice from "../components/DemoModeNotice";
import PaypalButton from "../components/PaypalButton";
import { isLiveApi } from "../lib/config";
import { UNIFORM_SHIPPING_COUNTRIES, uniformShippingRate } from "../lib/uniformShipping";
import { uniformAddressRegions, validateUniformShippingAddress } from "../lib/uniformAddress";
import {
  captureUniformPaypalOrder,
  confirmUniformPayment,
  createUniformPaymentIntent,
  createUniformLocalDominicaOrder,
  createUniformPaypalOrder,
  getCheckoutConfig,
  quoteUniformCheckout,
  submitUniformQuote,
} from "../data/repository";

const emptyUniformShipping = {
  firstName: "", lastName: "", company: "", address1: "", address2: "",
  city: "", state: "", postcode: "", country: "DM", email: "", phone: "",
};
const CONNECT767_AI_TEMPLATE_LOGO = "/connect767-ai-logo-transparent.png";

function EmbossedAIWorkspaceBackdrop({ studioBackground = DEFAULT_STUDIO_BACKGROUND }) {
  const backgroundColor = normalizeStudioBackground(studioBackground);
  const darkBackground = isDarkStudioBackground(backgroundColor);
  const logoMask = `url("${CONNECT767_AI_TEMPLATE_LOGO}")`;
  const maskStyle = {
    WebkitMaskImage: logoMask,
    maskImage: logoMask,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ backgroundColor }}>
      <div
        className="absolute inset-[1%] select-none"
        style={{
          ...maskStyle,
          backgroundColor: darkBackground ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.92)",
          opacity: darkBackground ? 0.72 : 0.88,
          transform: "translate(-4px, -4px)",
        }}
      />
      <div
        className="absolute inset-[1%] select-none"
        style={{
          ...maskStyle,
          backgroundColor: darkBackground ? "rgba(0,0,0,.78)" : "rgba(56,48,38,.38)",
          opacity: darkBackground ? 0.86 : 0.76,
          transform: "translate(5px, 5px)",
        }}
      />
      <div
        data-testid="ai-workspace-watermark"
        data-logo-src={CONNECT767_AI_TEMPLATE_LOGO}
        className="absolute inset-[1%] select-none"
        style={{
          ...maskStyle,
          backgroundColor,
          filter: darkBackground
            ? "brightness(.94) drop-shadow(2px 2px 2px rgba(0,0,0,.48))"
            : "brightness(.985) drop-shadow(2px 2px 2px rgba(56,48,38,.22))",
        }}
      />
    </div>
  );
}
let uniformStripePromise = null;
const getUniformStripe = (key) => {
  if (!uniformStripePromise) uniformStripePromise = loadStripe(key);
  return uniformStripePromise;
};

const tools = [
  {
    key: "category",
    label: "Category",
    icon: "ri-apps-2-line",
    hint: "Choose the sport or garment category for this design.",
  },
  {
    key: "design",
    label: "Uniform setup",
    icon: "ri-palette-line",
    hint: "Choose your fit, colors and production extras.",
  },
  {
    key: "zones",
    label: "Zones",
    icon: "ri-node-tree",
    hint: "Verify every traced garment region, edit its appearance, and manually correct Bézier boundaries.",
  },
  {
    key: "text",
    label: "Text",
    icon: "ri-font-size",
    hint: "Add player names, numbers or a club motto. Click Add text, then click the design where you want it.",
  },
  {
    key: "ai",
    label: "AI Designer",
    icon: "ri-sparkling-2-fill",
    hint: "Describe the complete kit and apply an editable AI design plan, or generate transparent artwork for placement.",
  },
  {
    key: "logo",
    label: "Logo",
    icon: "ri-image-add-line",
    hint: "Upload a crest or sponsor mark, then click the design where it goes. Transparent PNG or SVG prints cleanest.",
  },
  {
    key: "remove-bg",
    label: "Remove BG",
    icon: "ri-eraser-line",
    hint: "Remove the background from a regular photo or logo, then place the transparent result on the uniform.",
  },
  {
    key: "skins",
    label: "Patterns",
    icon: "ri-shapes-line",
    hint: "Patterns, flags and shapes — or upload your own. Pick one, then click the design to place it.",
  },
  {
    key: "layers",
    label: "Layers",
    icon: "ri-stack-line",
    hint: "Everything you've added across Front, Side and Back. Reorder, select or delete items here.",
  },
  {
    key: "roster",
    label: "Roster",
    icon: "ri-team-line",
    hint: "One row per player with sizes and numbers. The quote total updates as you add people.",
  },
  {
    key: "review",
    label: "Review",
    icon: "ri-shopping-bag-3-line",
    hint: "Review the complete kit, roster and estimated total before submitting the team order request.",
  },
];

const studioWorkflow = [
  {
    key: "design",
    label: "Design",
    description: "Category, fit and AI design",
    icon: "ri-pencil-ruler-2-line",
    step: 1,
    defaultTool: "ai",
    tools: ["ai"],
  },
  {
    key: "roster",
    label: "Team roster",
    description: "Names, numbers & sizes",
    icon: "ri-team-line",
    step: 2,
    defaultTool: "roster",
    tools: ["roster"],
  },
  {
    key: "review",
    label: "Review & quote",
    description: "Confirm and submit",
    icon: "ri-shopping-bag-3-line",
    step: 3,
    defaultTool: "review",
    tools: ["review"],
  },
];

const Product3DStage = lazy(
  () => import("../components/product-customizer/garment3d/Product3DStage")
);

// Keep the fast flat editor as the initial surface, then load WebGL only when
// the customer asks for a rotating preview. This gives customers a genuine 3D
// proof without making every visit pay the model-loading cost up front.
const ENABLE_3D = false;

const newRosterEntry = () => ({
  name: "",
  number: "",
  shirtSize: "M",
  shortSize: "M",
  sleevePreference: "Short",
  quantity: 1,
  notes: "",
});

const newSupporterJersey = () => ({ size: "M", quantity: 1 });
const supporterJerseyCount = (rows = []) => rows.reduce(
  (total, row) => total + Math.max(0, Math.min(99, Number.parseInt(row.quantity, 10) || 0)),
  0,
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

let layerIdCounter = 0;
const nextLayerId = () => `layer-${Date.now()}-${layerIdCounter++}`;

const productionLayersFromPlan = (plan, { preview = false, sport = "soccer" } = {}) =>
  (Array.isArray(plan?.productionElements) ? plan.productionElements : [])
    .map((element, index) => {
      const placement = mapProductionElementToGarment(element, sport);
      const common = {
        id: preview ? `ai-production-preview-${index}` : nextLayerId(),
        source: "ai-uniform-element",
        placementSpace: "garment-v3",
        name: element.name || `${plan?.name || "AI uniform"} ${element.kind}`,
        view: placement.view,
        x: placement.x,
        y: placement.y,
        size: placement.size,
        rotation: Number(element.rotation) || 0,
      };
      if (element.kind === "artwork") {
        return element.src ? { ...common, type: "logo", src: element.src } : null;
      }
      return {
        ...common,
        type: "text",
        textLayout: productionTextLayout(element),
        text: formatProductionText(element.content || "TEAM", productionTextLayout(element)),
        color: element.color || "#FFFFFF",
        fontFamily: "'Oswald', sans-serif",
      };
    })
    .filter(Boolean);
const patternViewsFromPlan = (patternView) => {
  if (patternView === "all") return ["front", "side", "back"];
  if (patternView === "both") return ["front", "back"];
  return [["front", "side", "back"].includes(patternView) ? patternView : "front"];
};
const AI_TRANSFER_KEY = "connect767-ai-design-transfer";

const categoryDetails = {
  soccer: { title: "Soccer", description: "Complete match kits with shirts, shorts and solid-colour socks." },
  basketball: { title: "Basketball", description: "Modern jerseys and shorts for teams, clubs and leagues." },
  netball: { title: "Netball", description: "Court-ready dresses and coordinated team uniforms." },
  cricket: { title: "Cricket", description: "Match shirts, trousers and complete cricket teamwear." },
  goalkeeper: { title: "Goal Keeper", description: "Dedicated keeper kits with long- and short-sleeve options." },
  other: { title: "Clothing & Other", description: "Polos, training wear, club clothing and any custom garment idea." },
};

const primaryTemplateForSport = (sportSlug) => templates.find(
  (candidate) => candidate.sportSlug === sportSlug && candidate.slug !== "blank-canvas",
) || templates.find((candidate) => candidate.slug === "blank-canvas");

const downloadDataUrl = (dataUrl, filename) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
};

const safeExportName = (value = "uniform") => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "") || "uniform";

export default function UniformStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSport = searchParams.get("sport") || "soccer";
  const scratch = searchParams.get("mode") === "scratch";
  const requestedWorkflowStep = searchParams.get("step") || "design";
  const initialWorkflowStep = ["options", "category", "ai"].includes(requestedWorkflowStep) ? "design" : requestedWorkflowStep;

  const [activeSport, setActiveSport] = useState(
    sports.some((s) => s.slug === initialSport) ? initialSport : "soccer"
  );
  const [selectedTemplate, setSelectedTemplate] = useState(scratch ? "blank-canvas" : null);

  // ---------- Design state ----------
  const [fitType, setFitType] = useState("");
  const hasSelectedFit = fitTypeOptions.includes(fitType);
  const [categoryConfirmed, setCategoryConfirmed] = useState(() => searchParams.has("sport"));
  const [collar, setCollar] = useState("Crew");
  const [sleeve, setSleeve] = useState("Short");
  const [colors, setColors] = useState(defaultZoneColors);
  const [studioBackground, setStudioBackground] = useState(DEFAULT_STUDIO_BACKGROUND);
  const [view, setView] = useState("front");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [selectedTool, setActiveTool] = useState(
    studioWorkflow.find((step) => step.key === initialWorkflowStep)?.defaultTool
      || (tools.some((tool) => tool.key === initialWorkflowStep) ? initialWorkflowStep : "ai")
  );
  const [zoom, setZoom] = useState(1);
  const [productionPanMode, setProductionPanMode] = useState(false);
  const productionViewportRef = useRef(null);
  const [aiConceptPan, setAiConceptPan] = useState({ x: 0, y: 0 });
  const aiConceptDragRef = useRef(null);
  const [hoverZone, setHoverZone] = useState(null);
  const [zoneModel, setZoneModel] = useState(() => cloneZoneModel());
  const [zoneStyles, setZoneStyles] = useState({ front: {}, back: {} });
  const [selectedZoneId, setSelectedZoneId] = useState("front-body");
  const [showZoneOutlines, setShowZoneOutlines] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [zoneHistory, setZoneHistory] = useState([]);
  const stageRef = useRef(null);
  // Set by Product3DStage's CaptureBridge while the 3D view is mounted.
  const capture3dRef = useRef(null);

  // ---------- 3D preview — reuses the same Three.js pipeline the generic
  // product customizer already has (GarmentModel/Product3DStage/
  // DesignCapture): a real rotating mesh with the customer's text/logo
  // layers baked on as a live texture, not a flat mockup. ----------
  // Start in the instant flat editor. The 3D mesh is mounted on demand, which
  // keeps the initial page light while retaining a production-friendly proof.
  const [stageMode, setStageMode] = useState(
    ENABLE_3D && searchParams.get("view") === "3d" ? "3d" : "edit"
  ); // '3d' | 'edit'

  // When set, the next click on the garment creates this item AT the click
  // point instead of dropping it on the chest and making the user drag it
  // into place. Cleared as soon as it lands, or if they change tool.
  const [pendingLayer, setPendingLayer] = useState(null);

  // Two-colour kit shortcut. The active sports templates are built from real
  // garment zones, so the second colour maps to the shorts/trousers zone at
  // the physical waist seam instead of drawing an arbitrary shader line.
  const [twoTone, setTwoTone] = useState({
    enabled: false,
    colorB: "#1b1a16",
    splitAt: 0.5,
    softness: 0.005,
  });

  // 3D placements, keyed by layer id: { position, orientation, scale, roll }.
  // Held separately from `layers` rather than merged into it because the 2D
  // editor's x/y percentages and a world-space decal transform describe
  // different things — a layer can legitimately have both, and writing the
  // 3D transform into the layer would invalidate the flat editor's geometry.
  const [placements3d, setPlacements3d] = useState({});
  const [aiUndoSnapshot, setAiUndoSnapshot] = useState(null);
  const [aiUniformPlan, setAiUniformPlan] = useState(null);
  const [aiWorkspaceConcept, setAiWorkspaceConcept] = useState(null);
  const [aiVersions, setAiVersions] = useState([]);
  const [aiComparisonPlan, setAiComparisonPlan] = useState(null);
  const [hasUploadedReference, setHasUploadedReference] = useState(false);
  const [aiDesignApplied, setAiDesignApplied] = useState(false);
  const [aiDesignerMode, setAiDesignerMode] = useState("uniform");
  const [aiCanvasMode, setAiCanvasMode] = useState("concept");
  const [studioMode, setStudioMode] = useState(STUDIO_MODES.AI_OUTPUT);
  const [conversionError, setConversionError] = useState("");
  const aiConceptViewportRef = useRef(null);
  const [aiConceptViewportWidth, setAiConceptViewportWidth] = useState(null);
  const [studioSettingsOpen, setStudioSettingsOpen] = useState(false);
  const [aiConceptBackground, setAiConceptBackground] = useState(AI_PREVIEW_BACKGROUND_FALLBACK);
  const [aiComparisonBackgrounds, setAiComparisonBackgrounds] = useState({
    previous: AI_PREVIEW_BACKGROUND_FALLBACK,
    current: AI_PREVIEW_BACKGROUND_FALLBACK,
  });
  // Shown when leaving the studio with unsaved work — see confirmExit below.
  const [exitPrompt, setExitPrompt] = useState(false);

  // Upgrade saved concepts created before deterministic background embossing.
  // The logo is composited into the image itself, never behind its opaque box.
  useEffect(() => {
    const source = aiWorkspaceConcept?.src;
    if (!source || aiWorkspaceConcept?.backgroundBranding === "connect767-embossed-v1") return undefined;
    let active = true;
    embossConnect767ConceptBackground(source).then((brandedSource) => {
      if (!active || !brandedSource || brandedSource === source) return;
      const conceptImage = {
        ...aiWorkspaceConcept,
        src: brandedSource,
        backgroundBranding: "connect767-embossed-v1",
      };
      setAiWorkspaceConcept(conceptImage);
      setAiUniformPlan((current) => current?.conceptImage?.src === source
        ? { ...current, conceptImage }
        : current);
    });
    return () => { active = false; };
  }, [aiWorkspaceConcept]);

  useEffect(() => {
    if (!studioSettingsOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setStudioSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [studioSettingsOpen]);

  useEffect(() => {
    setAiConceptBackground(AI_PREVIEW_BACKGROUND_FALLBACK);
    setAiComparisonBackgrounds({
      previous: AI_PREVIEW_BACKGROUND_FALLBACK,
      current: AI_PREVIEW_BACKGROUND_FALLBACK,
    });
  }, [aiWorkspaceConcept?.src, aiComparisonPlan?.conceptImage?.src]);
  const placeLayer3d = (layerId, placement) =>
    setPlacements3d((prev) => ({ ...prev, [layerId]: placement }));

  const resetAIConceptView = () => {
    setZoom(1);
    setAiConceptPan({ x: 0, y: 0 });
    aiConceptDragRef.current = null;
  };

  const switchAICanvasMode = (mode) => {
    if (mode === "production" && !canUseManualEditing(studioMode)) return;
    productionViewportRef.current?.reset();
    setProductionPanMode(false);
    if (mode === "production" && aiUniformPlan && !aiDesignApplied) return;
    setAiCanvasMode(mode);
    if (mode === "concept") setStudioMode(STUDIO_MODES.AI_OUTPUT);
    setStageMode("edit");
    // Each surface opens fitted; the production viewport clips its own
    // transforms so the garment cannot cover the fixed workspace controls.
    setZoom(1);
    setAiConceptPan({ x: 0, y: 0 });
    aiConceptDragRef.current = null;
  };

  const setClampedZoom = (nextZoom) => {
    const maximum = stageMode === "edit" ? 4 : 1.4;
    setZoom((current) => {
      const value = typeof nextZoom === "function" ? nextZoom(current) : nextZoom;
      return Math.max(stageMode === "edit" ? 0.5 : 0.7, Math.min(maximum, +value.toFixed(2)));
    });
  };


  // A deleted layer must not leave an orphaned decal behind.
  useEffect(() => {
    setPlacements3d((prev) => {
      const live = new Set(layers.map((l) => l.id));
      const next = {};
      let changed = false;
      for (const [id, p] of Object.entries(prev)) {
        if (live.has(id)) next[id] = p;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [layers]);
  const jerseyPlacements = useMemo(() => [{ key: "front", label: "Front" }, { key: "back", label: "Back" }], []);
  // Was hardcoded to slug "jersey", so every sport — soccer, basketball,
  // netball, cricket — rendered the same GLB. Keyed off the active sport
  // now, so switching the sport tab actually switches the garment.
  const studioProductType = useMemo(
    () => ({
      slug: activeSport,
      modelUrl: sportModelUrl(activeSport),
      uniformKit: true,
      placements: jerseyPlacements,
    }),
    [activeSport, jerseyPlacements]
  );

  // ---------- Priced options (spec §4.4/§4.5) ----------
  const [kitType, setKitType] = useState(kitTypeOptions[0]);
  const [extraTeamShirts, setExtraTeamShirts] = useState([]);
  const [logoApplication, setLogoApplication] = useState("Sublimated");
  const [insideCollarMessage, setInsideCollarMessage] = useState(false);
  const [insideCollarText, setInsideCollarText] = useState("");
  const [insideCollarAttachment, setInsideCollarAttachment] = useState(null);
  const [designValidationAttempted, setDesignValidationAttempted] = useState(false);
  const [rosterValidationAttempted, setRosterValidationAttempted] = useState(false);
  const insideCollarRequirementMet = !insideCollarMessage || Boolean(
    insideCollarText.trim() || insideCollarAttachment?.src,
  );
  const canContinueDesign = categoryConfirmed && hasSelectedFit && insideCollarRequirementMet;
  const designContinueTitle = !categoryConfirmed
    ? "Select a uniform category before continuing"
    : !hasSelectedFit
    ? "Select Men, Women or Youth in Design before continuing"
    : !insideCollarRequirementMet
      ? "Enter an inside-collar message or attach a logo/artwork file before continuing"
      : undefined;
  const [fanJerseyAdded, setFanJerseyAdded] = useState(false);
  const [supporterJerseys, setSupporterJerseys] = useState([newSupporterJersey()]);

  const unitPrice = useMemo(
    () => kitUnitPrice({ sport: activeSport, sleeve, collar, insideCollarMessage, logoApplication }),
    [activeSport, sleeve, collar, insideCollarMessage, logoApplication]
  );

  // ---------- Roster state ----------
  const [rosterEntry, setRosterEntry] = useState(newRosterEntry);
  const [roster, setRoster] = useState([]);
  const [sockQuantityOverride, setSockQuantityOverride] = useState(null);
  // Who to send the quote back to. The submission previously carried none of
  // this — the shop received a design and a roster with no way to reply, and
  // the notification email literally said the order came from "Guest".
  const [contact, setContact] = useState({ name: "", email: "", phone: "", club: "", notes: "" });
  const [shipping, setShipping] = useState(emptyUniformShipping);
  const [submitted, setSubmitted] = useState(false);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [placementError, setPlacementError] = useState("");
  const [manualSaveStatus, setManualSaveStatus] = useState("idle");
  const [designSecurityContext, setDesignSecurityContext] = useState(null);
  const manualSaveResetRef = useRef(null);

  // Local screenshot fixture only; Vite removes this branch from production.
  useEffect(() => {
    if (!import.meta.env.DEV || !["checkout", "roster", "long-sleeve"].includes(searchParams.get("preview"))) return;
    setFitType("Men");
    if (searchParams.get("preview") === "long-sleeve") {
      setSleeve("Long");
      setColors((current) => ({
        ...current,
        body: "#03cfc9",
        sleeve: "#f5f2eb",
        collar: "#03cfc9",
        shorts: "#03cfc9",
        socks: "#f5f2eb",
        shirtStrip: "#03cfc9",
        sleeveStrip: "#dedbd3",
        shortsStrip: "#dedbd3",
      }));
      setActiveTool("design");
      return;
    }
    setRoster([
      { ...newRosterEntry(), id: "preview-1", name: "A. Miller", number: "10", shirtSize: "L", shortSize: "M", quantity: 4 },
      { ...newRosterEntry(), id: "preview-2", name: "J. Carter", number: "7", shirtSize: "M", shortSize: "M", quantity: 4 },
      { ...newRosterEntry(), id: "preview-3", name: "D. Rivera", number: "23", shirtSize: "XL", shortSize: "L", quantity: 4 },
    ]);
    if (searchParams.get("preview") === "roster") {
      setSleeve("Mixed");
      setActiveTool("roster");
      return;
    }
    setContact({ name: "Riverside FC", email: "orders@example.com", phone: "(767) 555-0100", club: "Riverside FC", notes: "" });
    setShipping({ firstName: "Avery", lastName: "Miller", company: "Riverside FC", address1: "10 Stadium Road", address2: "", city: "Roseau", state: "Saint George", postcode: "00109", country: "DM", email: "orders@example.com", phone: "(767) 555-0100" });
    setFanJerseyAdded(true);
    setSupporterJerseys([{ size: "M", quantity: 2 }, { size: "L", quantity: 1 }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const template = templates.find((t) => t.slug === selectedTemplate);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const sportConfig = sportConfigFor(activeSport);
  const minimumKits = minimumFullKitsFor(activeSport);
  const fullKitUnitCount = rosterUnitCount(roster);
  const minimumKitsMet = fullKitUnitCount >= minimumKits;
  const requiredSocksQuantity = sportConfig.hasSocks ? Math.max(minimumKits, fullKitUnitCount) : 0;
  const socksQuantity = sockQuantityOverride ?? requiredSocksQuantity;
  const socksQuantityValid = !sportConfig.hasSocks || socksQuantity === requiredSocksQuantity;
  const rosterReadyForReview = minimumKitsMet && socksQuantityValid;
  const manualEditingAllowed = canUseManualEditing(studioMode);
  const strictAIPreview = isAIPreviewMode(studioMode);
  // Tool availability now follows the actual garment surface instead of a
  // generic step toolbar. A flat AI/reference image is intentionally
  // preview-only; placement tools unlock only on a verified production map.
  const garmentCapabilities = useMemo(() => detectGarmentCapabilities({
    sport: activeSport,
    view,
    canvasMode: aiCanvasMode,
    hasConceptImage: Boolean(aiWorkspaceConcept?.src || hasUploadedReference),
    zoneModel,
    layerCount: layers.length,
  }), [activeSport, view, aiCanvasMode, aiWorkspaceConcept?.src, hasUploadedReference, zoneModel, layers.length]);
  // Gate every entry path, including saved links and artwork selection.
  const selectedWorkflowStep = studioWorkflow.find((step) => step.tools.includes(selectedTool));
  const gatedTool = strictAIPreview && selectedWorkflowStep?.key === "design"
    ? "ai"
    : !canContinueDesign && selectedWorkflowStep?.step > 1 ? "ai" : selectedTool;
  const requestedWorkflowIndex = Math.max(
    0,
    studioWorkflow.findIndex((step) => step.tools.includes(gatedTool))
  );
  const requestedCapabilityWorkflow = studioWorkflow[requestedWorkflowIndex];
  const activeTool = requestedCapabilityWorkflow.tools.includes(gatedTool)
    ? gatedTool
    : requestedCapabilityWorkflow.defaultTool;
  const workflowIndex = Math.max(
    0,
    studioWorkflow.findIndex((step) => step.tools.includes(activeTool))
  );
  const workflowStep = studioWorkflow[workflowIndex];
  const visibleTools = tools.filter((tool) => workflowStep.tools.includes(tool.key));
  const activeToolConfig = tools.find((tool) => tool.key === activeTool) || visibleTools[0];

  useEffect(() => {
    if (activeTool !== gatedTool) setActiveTool(activeTool);
  }, [activeTool, gatedTool]);

  useEffect(() => {
    if (searchParams.get("aiDesign") !== "1") return;
    try {
      const raw = window.sessionStorage.getItem(AI_TRANSFER_KEY);
      const transfer = raw ? JSON.parse(raw) : null;
      if (!transfer?.src?.startsWith("data:image/")) return;
      const id = nextLayerId();
      setLayers((current) => [
        ...current,
        { id, type: "logo", view: "front", x: 50, y: 42, size: 28, rotation: 0, src: transfer.src, name: transfer.name || "AI artwork" },
      ]);
      setSelectedLayerId(id);
      setActiveTool("ai");
      window.sessionStorage.removeItem(AI_TRANSFER_KEY);
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete("aiDesign");
        return next;
      }, { replace: true });
    } catch {
      window.sessionStorage.removeItem(AI_TRANSFER_KEY);
    }
  }, [searchParams, setSearchParams]);

  const openWorkflowStep = (index) => {
    const nextStep = studioWorkflow[Math.max(0, Math.min(studioWorkflow.length - 1, index))];
    if (nextStep.key !== "design" && !canContinueDesign) return;
    if (nextStep.key === "review" && !rosterReadyForReview) return;
    setPendingLayer(null);
    setSelectedLayerId(null);
    setActiveTool(nextStep.defaultTool);
  };

  const openAIDesigner = () => {
    setPendingLayer(null);
    setSelectedLayerId(null);
    setStageMode("edit");
    setActiveTool("ai");
  };

  const continueWorkflow = () => {
    if (workflowIndex === studioWorkflow.length - 1) return;
    if (workflowStep.key === "design" && !canContinueDesign) {
      setDesignValidationAttempted(true);
      const target = document.getElementById(
        !categoryConfirmed
          ? "category-selection-required"
          : hasSelectedFit
            ? "inside-collar-content-warning"
            : "fit-selection-required",
      );
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.querySelector?.("button, input, select")?.focus();
      return;
    }
    if (workflowStep.key === "roster" && !rosterReadyForReview) {
      setRosterValidationAttempted(true);
      const target = document.getElementById(minimumKitsMet ? "socks-quantity-warning" : "roster-entry-form");
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.querySelector?.("input, button, select")?.focus();
      return;
    }
    openWorkflowStep(workflowIndex + 1);
  };

  const backWorkflow = () => {
    if (workflowIndex === 0) {
      handleExit();
      return;
    }
    openWorkflowStep(workflowIndex - 1);
  };

  /**
   * Designs survive leaving the studio.
   *
   * Everything lived in component state, so closing the tab, hitting Back, or
   * switching template threw the whole design away with no warning — an hour
   * of work gone to a misclick. Persisted per sport+template so switching
   * between two kits doesn't have them overwrite each other.
   */
  const storageKey = selectedTemplate ? `c767:studio:${activeSport}:${selectedTemplate}` : null;

  const moveZonePoint = (side, zoneId, commandIndex, pointType, point) => {
    if (!manualEditingAllowed) return;
    setZoneModel((current) => {
      setZoneHistory((history) => [...history.slice(-39), current]);
      const next = cloneZoneModel(current);
      const zone = next[side]?.find((item) => item.id === zoneId);
      const command = zone?.commands?.[commandIndex];
      if (!command) return current;
      if (pointType === "anchor") {
        command.x = point.x;
        command.y = point.y;
      } else if (pointType === "c1" && command.type === "C") {
        command.c1x = point.x;
        command.c1y = point.y;
      } else if (pointType === "c2" && command.type === "C") {
        command.c2x = point.x;
        command.c2y = point.y;
      }
      return next;
    });
  };

  const updateZoneStyle = (side, zoneId, patch) => {
    if (!manualEditingAllowed) return;
    setZoneStyles((current) => ({
      ...current,
      [side]: { ...current[side], [zoneId]: { ...(current[side]?.[zoneId] || {}), ...patch } },
    }));
  };

  const resetZone = (side, zoneId) => {
    if (!manualEditingAllowed) return;
    const original = SOCCER_ZONE_MODEL[side].find((item) => item.id === zoneId);
    if (!original) return;
    setZoneHistory((history) => [...history.slice(-39), zoneModel]);
    setZoneModel((current) => ({
      ...current,
      [side]: current[side].map((item) => item.id === zoneId
        ? { ...original, commands: original.commands.map((command) => ({ ...command })) }
        : item),
    }));
    setZoneStyles((current) => ({ ...current, [side]: { ...current[side], [zoneId]: undefined } }));
  };

  const resetAllZones = () => {
    if (!manualEditingAllowed) return;
    setZoneHistory((history) => [...history.slice(-39), zoneModel]);
    setZoneModel(cloneZoneModel());
    setZoneStyles({ front: {}, back: {} });
  };

  const undoZoneCorrection = () => setZoneHistory((history) => {
    if (!history.length) return history;
    setZoneModel(history[history.length - 1]);
    return history.slice(0, -1);
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          layers,
          placements3d,
          colors,
          studioBackground,
          collar,
          sleeve,
          zoneModel,
          zoneStyles,
          twoTone,
          fitType,
          fitTypeConfirmed: hasSelectedFit,
          categoryConfirmed,
          kitType,
          extraTeamShirts,
          logoApplication,
          insideCollarMessage,
          insideCollarText,
          insideCollarAttachment,
          fanJerseyAdded,
          supporterJerseys,
          roster,
          socksQuantity,
          contact,
          shipping,
           aiUniformPlan: aiUniformPlan ? { ...aiUniformPlan, conceptImage: undefined } : null,
           aiWorkspaceConcept,
           aiDesignApplied,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* private browsing / quota — the design just won't persist, which is
         no worse than before this existed */
    }
  }, [storageKey, layers, placements3d, colors, studioBackground, collar, sleeve, zoneModel, zoneStyles, twoTone,
    fitType, hasSelectedFit, categoryConfirmed, kitType, extraTeamShirts, logoApplication, insideCollarMessage, insideCollarText, insideCollarAttachment, fanJerseyAdded, supporterJerseys, roster, socksQuantity, contact, shipping,
    aiUniformPlan, aiWorkspaceConcept, aiDesignApplied]);

  const saveProgress = () => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          layers,
          placements3d,
          colors,
          studioBackground,
          collar,
          sleeve,
          zoneModel,
          zoneStyles,
          twoTone,
          fitType,
          fitTypeConfirmed: hasSelectedFit,
          categoryConfirmed,
          kitType,
          extraTeamShirts,
          logoApplication,
          insideCollarMessage,
          insideCollarText,
          insideCollarAttachment,
          fanJerseyAdded,
          supporterJerseys,
          roster,
          socksQuantity,
          contact,
          shipping,
           aiUniformPlan: aiUniformPlan ? { ...aiUniformPlan, conceptImage: undefined } : null,
           aiWorkspaceConcept,
           aiDesignApplied,
          savedAt: Date.now(),
        }),
      );
      setManualSaveStatus("saved");
    } catch {
      setManualSaveStatus("error");
    }
    window.clearTimeout(manualSaveResetRef.current);
    manualSaveResetRef.current = window.setTimeout(() => setManualSaveStatus("idle"), 2400);
  };

  useEffect(() => () => window.clearTimeout(manualSaveResetRef.current), []);

  const restoreSaved = (key, savedSport = activeSport) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved?.layers?.length && !Object.keys(saved?.placements3d || {}).length && !saved?.zoneModel) return false;
      const normalizedLayers = (saved.layers || []).map((layer) => normalizeStoredProductionLayer(layer, savedSport));
      setLayers(removeRestrictedSoccerSockLayers(normalizedLayers, savedSport));
      setPlacements3d(saved.placements3d || {});
      if (saved.colors) setColors(normalizeZoneColors(saved.colors));
      if (saved.studioBackground) setStudioBackground(normalizeStudioBackground(saved.studioBackground));
      if (saved.collar) setCollar(saved.collar);
      if (saved.sleeve) setSleeve(saved.sleeve);
      if (saved.zoneModel?.front && saved.zoneModel?.back) setZoneModel(saved.zoneModel);
      if (saved.zoneStyles) setZoneStyles(saved.zoneStyles);
      if (saved.twoTone) setTwoTone(saved.twoTone);
      setFitType(saved.fitTypeConfirmed === true && fitTypeOptions.includes(saved.fitType) ? saved.fitType : "");
      // Projects saved before category confirmation was introduced already
      // belong to a category-specific template, so preserve that selection.
      setCategoryConfirmed(saved.categoryConfirmed !== false);
      // Extra shirts are ordered explicitly in Team roster. Discard the former
      // hidden Step 2 quantity so legacy projects cannot add an invisible charge.
      setKitType("Full");
      setExtraTeamShirts([]);
      if (saved.logoApplication) setLogoApplication(saved.logoApplication);
      if (typeof saved.insideCollarMessage === "boolean") setInsideCollarMessage(saved.insideCollarMessage);
      if (typeof saved.insideCollarText === "string") setInsideCollarText(saved.insideCollarText);
      if (saved.insideCollarAttachment?.src) setInsideCollarAttachment(saved.insideCollarAttachment);
      if (typeof saved.fanJerseyAdded === "boolean") setFanJerseyAdded(saved.fanJerseyAdded);
      if (Array.isArray(saved.supporterJerseys) && saved.supporterJerseys.length) setSupporterJerseys(saved.supporterJerseys);
      if (Array.isArray(saved.roster)) setRoster(saved.roster.map((entry) => ({
        ...entry,
        sleevePreference: entry.sleevePreference === "Long" ? "Long" : "Short",
      })));
      if (Number.isFinite(Number(saved.socksQuantity))) setSockQuantityOverride(Math.max(0, Math.min(999, Number(saved.socksQuantity))));
      if (saved.contact) setContact(saved.contact);
      if (saved.shipping) setShipping(saved.shipping);
      if (saved.aiWorkspaceConcept?.src) {
        setAiWorkspaceConcept(saved.aiWorkspaceConcept);
        setAiCanvasMode("concept");
      }
      if (saved.aiUniformPlan) {
        setAiUniformPlan({
          ...saved.aiUniformPlan,
          conceptImage: saved.aiWorkspaceConcept?.src ? saved.aiWorkspaceConcept : undefined,
        });
        if (saved.aiWorkspaceConcept?.src && !saved.aiDesignApplied) {
          setStudioMode(STUDIO_MODES.AI_OUTPUT);
          setAiCanvasMode("concept");
          setActiveTool("ai");
        }
      }
      if (typeof saved.aiDesignApplied === "boolean") setAiDesignApplied(saved.aiDesignApplied);
      return true;
    } catch {
      return false;
    }
  };

  const discardSaved = () => {
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* nothing to clean up */
      }
    }
    setLayers([]);
    setPlacements3d({});
    setSelectedLayerId(null);
    setSockQuantityOverride(null);
    setAiUniformPlan(null);
    setAiWorkspaceConcept(null);
    setAiVersions([]);
    setAiComparisonPlan(null);
    setAiDesignApplied(false);
    setSockQuantityOverride(null);
    setStudioMode(STUDIO_MODES.AI_OUTPUT);
  };

  useEffect(() => {
    if (!pendingLayer) return;
    setProductionPanMode(false);
    const onKey = (e) => {
      if (e.key === "Escape") setPendingLayer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingLayer]);

  /** Flat-editor size: layers store it as a percentage of the stage. */
  const setLayerSize2d = (id, size) => updateLayer(id, { size });

  const rotateLayer2d = (id, dir) =>
    setLayers((ls) =>
      ls.map((l) => (l.id === id ? { ...l, rotation: ((l.rotation || 0) + dir * 7.5) % 360 } : l)),
    );

  const setLayerScale = (id, scale) =>
    setPlacements3d((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], scale } } : prev));

  /**
   * Rotates within the plane of the fabric. The decal's other two axes stay
   * pinned to the surface normal, so only this roll is the user's to change —
   * rotating about a world axis would tip the artwork off a curved panel.
   */
  const rotateLayer = (id, dir) =>
    setPlacements3d((prev) => {
      const p = prev[id];
      if (!p) return prev;
      const step = (Math.PI / 24) * dir;
      const e = new THREE.Euler().fromArray(p.orientation);
      const q = new THREE.Quaternion().setFromEuler(e);
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, step));
      return {
        ...prev,
        [id]: {
          ...p,
          roll: (p.roll ?? 0) + step,
          orientation: new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3),
        },
      };
    });

  /** Applies a preset colourway: [body, trim, accent]. */
  const applyColourway = ([body, trim, accent]) => {
    if (!manualEditingAllowed) return;
    setColors((c) => ({
      ...c,
      body,
      sleeve: body,
      collar: trim,
      shirtStrip: trim,
      sleeveStrip: trim,
      shortsStrip: trim,
      shorts: accent,
      socks: accent,
    }));
  };

  const hasWork = Boolean(
    layers.length
    || Object.keys(placements3d).length
    || aiUniformPlan
    || aiWorkspaceConcept?.src
    || roster.length
    || hasSelectedFit,
  );

  // Closing the tab or hitting the browser's back button bypasses the in-app
  // prompt entirely, so the native one covers that path. Browsers ignore
  // custom wording here and show their own text — that's fine, the point is
  // that the click is interrupted at all.
  useEffect(() => {
    if (!hasWork) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasWork]);

  /** Back button — only interrupts when there's actually something to lose. */
  const handleExit = () => {
    if (hasWork) setExitPrompt(true);
    else setSelectedTemplate(null);
  };

  const selectTemplate = (t, sportSlug = activeSport, nextTool = "ai") => {
    const nextSportConfig = sportConfigFor(sportSlug);
    setActiveSport(sportSlug);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sport", sportSlug);
      return next;
    });
    setSelectedTemplate(t.slug);
    setFitType("");
    setCategoryConfirmed(false);
    setCollar(t.defaultCollar || nextSportConfig.collarOptions[0]);
    setSleeve(t.defaultSleeve || nextSportConfig.sleeveOptions?.[0] || "Sleeveless");
    // A stock image demonstrates the cut only. New designs always enter on
    // clean white fabric with no artwork carried over from another template.
    setColors({ ...defaultZoneColors });
    setLayers([]);
    setPlacements3d({});
    setSelectedLayerId(null);
    setPendingLayer(null);
    setActiveTool(nextTool);
    setAiDesignerMode("uniform");
    setAiCanvasMode("concept");
    setAiUniformPlan(null);
    setAiWorkspaceConcept(null);
    setAiVersions([]);
    setAiComparisonPlan(null);
    setAiDesignApplied(false);
    setHasUploadedReference(false);
    setStudioMode(STUDIO_MODES.AI_OUTPUT);
    setRosterEntry(newRosterEntry());
    setRoster([]);
    setSockQuantityOverride(null);
    setKitType(kitTypeOptions[0]);
    setExtraTeamShirts([]);
    setFanJerseyAdded(false);
    setSupporterJerseys([newSupporterJersey()]);
    setLogoApplication("Sublimated");
    setInsideCollarMessage(false);
    setInsideCollarText("");
    setInsideCollarAttachment(null);
    setDesignValidationAttempted(false);
    setRosterValidationAttempted(false);
    // Pick up where they left off on this exact kit, if they were here before.
    restoreSaved(`c767:studio:${sportSlug}:${t.slug}`, sportSlug);
  };

  useEffect(() => {
    if (selectedTemplate || !searchParams.has("sport")) return;
    const initialTemplate = primaryTemplateForSport(activeSport);
    if (initialTemplate) selectTemplate(initialTemplate, activeSport, "ai");
  }, []); // Explicit sport links enter the studio; the bare /uniforms route stays on the landing page.

  const changeDesignCategory = (sportSlug) => {
    if (sportSlug === activeSport) {
      setCategoryConfirmed(true);
      return;
    }
    const nextTemplate = primaryTemplateForSport(sportSlug);
    if (!nextTemplate) return;
    if (hasWork && !window.confirm("Changing category loads its matching template. Your current category design is saved and can be restored when you return. Continue?")) return;
    selectTemplate(nextTemplate, sportSlug, "ai");
    setCategoryConfirmed(true);
  };

  const TOOL_FOR_LAYER = { text: "text", skin: "skins", logo: "logo", clipart: "logo" };

  const selectLayer = (id) => {
    if (!manualEditingAllowed) return;
    setSelectedLayerId(id);
    const layer = layers.find((l) => l.id === id);
    // Selecting artwork opens the panel that edits that kind of artwork.
    // Skins previously fell through to "logo", which showed an upload box for
    // something that can't be uploaded.
    if (layer) setActiveTool(TOOL_FOR_LAYER[layer.type] || "logo");
  };

  /**
   * Arms a click-to-place. Nothing is created yet — the layer is built by
   * commitPendingLayer() once the customer clicks the garment, so it lands
   * exactly where they pointed rather than appearing on the chest and needing
   * to be dragged.
   */
  const armTextPlacement = () => {
    if (!manualEditingAllowed) return;
    setPendingLayer({ type: "text" });
    setActiveTool("text");
  };

  const armLogoPlacement = (e) => {
    if (!manualEditingAllowed) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingLayer({ type: "logo", src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const armBackgroundRemovedArtwork = (file) => {
    if (!manualEditingAllowed) return;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingLayer({ type: "logo", src: reader.result });
    reader.readAsDataURL(file);
    setActiveTool("remove-bg");
  };

  /** Customer's own pattern image, placed like any built-in one. */
  const armPatternUpload = (e) => {
    if (!manualEditingAllowed) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingLayer({ type: "skin", src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const armSkinPlacement = (skinKey) => {
    if (!manualEditingAllowed) return;
    setPendingLayer({
      type: "skin",
      skinKey,
      src: skinDataUri(skinKey, colors.body, colors.shirtStrip),
    });
  };

  /**
   * Builds the armed item. Takes either a 3D surface placement or, in the flat
   * editor, an {x, y} percentage of the stage — the layer is identical either
   * way, only where it lands differs.
   */
  const commitPendingLayer = (placement) => {
    if (!manualEditingAllowed || !pendingLayer) return;
    if (isRestrictedSoccerSockPlacement({ sport: activeSport, ...placement })) {
      setPlacementError("Soccer socks support solid colour only. Logos, text and patterns cannot be placed on socks.");
      return;
    }
    setPlacementError("");
    const id = nextLayerId();

    const is2d = placement && placement.x !== undefined;
    const base = {
      id,
      view: placement?.view || view,
      x: is2d ? placement.x : 50,
      y: is2d ? placement.y : 45,
      zone: placement?.zone,
      rotation: 0,
    };
    const layer =
      pendingLayer.type === "text"
        ? {
            ...base,
            type: "text",
            size: 26,
            text: "YOUR TEXT",
            color: "#1b1a16",
            fontFamily: fontOptions[0].family,
            autoEdit: true,
          }
        : pendingLayer.type === "skin"
        ? { ...base, type: "skin", skinKey: pendingLayer.skinKey, size: 30, src: pendingLayer.src }
        : { ...base, type: "logo", size: 16, src: pendingLayer.src };

    setLayers((ls) => [...ls, layer]);
    // Only a 3D drop carries a world-space transform; a flat-editor click
    // stores its position on the layer itself.
    if (!is2d) setPlacements3d((prev) => ({ ...prev, [id]: placement }));
    setSelectedLayerId(id);
    setPendingLayer(null);
  };

  const addTextLayer = () => {
    if (!manualEditingAllowed) return;
    const id = nextLayerId();
    setLayers((ls) => [
      ...ls,
      {
        id,
        type: "text",
        view,
        x: 50,
        y: 45,
        size: 26,
        rotation: 0,
        // Placeholder rather than empty: a zero-width layer is invisible on
        // the garment, so "Add text" would look like it did nothing. Starting
        // with real words gives something to grab, scale and then retype.
        text: "YOUR TEXT",
        // Dark by default: the garment now opens white, and white-on-white
        // text would look like nothing was added at all.
        color: "#1b1a16",
        fontFamily: fontOptions[0].family,
        // Opens the inline input immediately in the flat editor, mirroring
        // what the 3D view's floating text field does.
        autoEdit: true,
      },
    ]);
    setSelectedLayerId(id);
    setActiveTool("text");
  };

  const addLogoLayer = (e) => {
    if (!manualEditingAllowed) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = nextLayerId();
      setLayers((ls) => [
        ...ls,
        { id, type: "logo", view, x: 50, y: 30, size: 16, rotation: 0, src: reader.result },
      ]);
      setSelectedLayerId(id);
      setActiveTool("logo");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const placeAIArtwork = ({ src, name }) => {
    if (!manualEditingAllowed) return;
    const id = nextLayerId();
    setView("front");
    setLayers((current) => [
      ...current,
      { id, type: "logo", view: "front", x: 50, y: 42, size: 28, rotation: 0, src, name },
    ]);
    setSelectedLayerId(id);
  };

  const currentAiPatternKey = useMemo(
    () => layers.find((layer) => layer.source === "ai-uniform-pattern")?.skinKey || "none",
    [layers],
  );

  const handleAIUniformPlanChange = (plan) => {
    setAiUniformPlan(plan || null);
    if (!plan) {
      setAiWorkspaceConcept(null);
      setAiVersions([]);
      setAiComparisonPlan(null);
      setAiDesignApplied(false);
      if (studioMode !== STUDIO_MODES.AI_GENERATING) setStudioMode(STUDIO_MODES.AI_OUTPUT);
      return;
    }
    if (plan) {
      if (plan.conceptImage?.src) setAiWorkspaceConcept(plan.conceptImage);
      if (plan.conceptImage?.src) {
        setAiVersions((current) => {
          if (current.some((version) => version.conceptImage?.src === plan.conceptImage.src)) return current;
          return [...current, { ...plan, versionId: `${Date.now()}-${current.length + 1}` }].slice(-12);
        });
      }
      setStudioMode(STUDIO_MODES.AI_OUTPUT);
      setAiComparisonPlan(null);
      setConversionError("");
      setAiDesignApplied(false);
      setAiCanvasMode("concept");
      setStageMode("edit");
      setView("front");
      setSelectedLayerId(null);
      setPendingLayer(null);
      setActiveTool("ai");
    }
  };

  const handleAIGeneratingChange = (generating) => {
    if (generating) {
      setStudioMode(STUDIO_MODES.AI_GENERATING);
      setActiveTool("ai");
      setSelectedLayerId(null);
      setPendingLayer(null);
      return;
    }
    setStudioMode((current) => (
      current === STUDIO_MODES.AI_GENERATING && (aiWorkspaceConcept?.src || aiUniformPlan?.conceptImage?.src)
        ? STUDIO_MODES.AI_OUTPUT
        : current === STUDIO_MODES.AI_GENERATING ? STUDIO_MODES.AI_OUTPUT : current
    ));
  };

  useEffect(() => {
    if (!aiUniformPlan && !aiWorkspaceConcept && studioMode !== STUDIO_MODES.AI_GENERATING) {
      setStudioMode(STUDIO_MODES.AI_OUTPUT);
      setAiComparisonPlan(null);
    }
  }, [aiUniformPlan, aiWorkspaceConcept, studioMode]);

  const restoreAIVersion = (version) => {
    if (!version?.conceptImage?.src) return;
    setAiUniformPlan(version);
    setAiWorkspaceConcept(version.conceptImage);
    setAiComparisonPlan(null);
    setAiCanvasMode("concept");
    setStudioMode(STUDIO_MODES.AI_OUTPUT);
    setStageMode("edit");
    setSelectedLayerId(null);
    setPendingLayer(null);
    setActiveTool("ai");
  };

  const editablePlanValidation = validateEditableUniformPlan(aiUniformPlan, {
    hasVerifiedTemplate: Boolean(template && zoneModel),
  });

  const convertAIToEditableDesign = () => {
    const validation = validateEditableUniformPlan(aiUniformPlan, {
      hasVerifiedTemplate: Boolean(template && zoneModel),
    });
    if (!validation.valid) {
      setConversionError(`${validation.reason} This preview will remain AI-only.`);
      return;
    }
    applyAIUniformDesign(aiUniformPlan, { canvasMode: "production" });
    setStudioMode(STUDIO_MODES.EDITABLE);
    setAiCanvasMode("production");
    setAiComparisonPlan(null);
    setConversionError("");
    setActiveTool("design");
  };

  const showingAIUniformPreview = Boolean(aiUniformPlan && aiCanvasMode === "production" && !aiDesignApplied);
  const showingAIConcept = Boolean(
    stageMode === "edit"
    && aiWorkspaceConcept?.src
    && aiCanvasMode === "concept"
    && strictAIPreview,
  );
  const showingProductionMap = false;
  const detectedHeaderCapabilities = getStudioHeaderCapabilities({
    mode: studioMode,
    workspace: workflowStep.key,
    aiDesignerActive: activeTool === "ai",
    hasAIResult: Boolean(aiUniformPlan || aiWorkspaceConcept),
    canOpenProduction: false,
    hasStorage: Boolean(storageKey),
    showingAIConcept,
    showingProductionMap,
    stageMode,
  });
  const headerCapabilities = {
    ...detectedHeaderCapabilities,
    aiDesigner: workflowStep.key === "design",
    saveProgress: workflowStep.key !== "design" && detectedHeaderCapabilities.saveProgress,
    openEditableStudio: false,
    svgExport: false,
    settings: workflowStep.key === "design",
    download: false,
  };
  useEffect(() => {
    if (!showingAIConcept) {
      setAiConceptViewportWidth(null);
      return undefined;
    }
    const viewport = aiConceptViewportRef.current;
    if (!viewport) return undefined;
    const syncBannerWidth = () => {
      const nextWidth = Math.round(viewport.getBoundingClientRect().width);
      if (nextWidth > 0) setAiConceptViewportWidth((current) => current === nextWidth ? current : nextWidth);
    };
    syncBannerWidth();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(syncBannerWidth) : null;
    observer?.observe(viewport);
    window.addEventListener("resize", syncBannerWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncBannerWidth);
    };
  }, [showingAIConcept, aiWorkspaceConcept?.src]);
  useEffect(() => {
    setZoom(1);
    setAiConceptPan({ x: 0, y: 0 });
    aiConceptDragRef.current = null;
  }, [aiWorkspaceConcept?.src]);
  useEffect(() => {
    if (showingAIConcept) return;
    setZoom(1);
    setAiConceptPan({ x: 0, y: 0 });
    aiConceptDragRef.current = null;
  }, [showingAIConcept]);
  const [stageColors, updateGarmentColors] = useGarmentColors({
    colors, setColors, previewPlan: showingAIUniformPreview ? aiUniformPlan : null,
    setPreviewPlan: setAiUniformPlan, zoneModel, setZoneStyles,
  });
  const appliedAiPattern = useMemo(() => {
    const patternLayers = layers.filter((layer) => layer.source === "ai-uniform-pattern");
    if (!patternLayers.length) return { enabled: false, key: "none", view: "both" };
    const patternViews = new Set(patternLayers.map((layer) => layer.view));
    return {
      enabled: true,
      key: patternLayers[0].skinKey,
      view: patternViews.has("front") && patternViews.has("side") && patternViews.has("back")
        ? "all"
        : patternViews.has("front") && patternViews.has("back")
          ? "both"
          : patternLayers[0].view,
    };
  }, [layers]);
  const stageCollar = showingAIUniformPreview ? aiUniformPlan.collar : collar;
  const stageSleeve = showingAIUniformPreview ? aiUniformPlan.sleeve : sleeve;
  // "Mixed" is an order-level choice: players can receive either short or
  // long sleeves. A single sample garment must never render mismatched arms.
  const renderedStageSleeve = stageSleeve === "Mixed" ? "Short" : stageSleeve;
  const previewProductionLayers = useMemo(
    () => productionLayersFromPlan(aiUniformPlan, { preview: true, sport: activeSport }),
    [aiUniformPlan, activeSport],
  );
  const stageLayers = showingAIUniformPreview
    ? [
        ...layers.filter((layer) => layer.source !== "ai-uniform-element"),
        ...previewProductionLayers,
      ]
    : layers;
  const stageGarmentPattern = showingAIUniformPreview ? aiUniformPlan.pattern : appliedAiPattern;

  const applyAIUniformDesign = (plan, { canvasMode = "concept" } = {}) => {
    if (!plan?.colors || (strictAIPreview && canvasMode !== "production")) return;
    setAiUndoSnapshot({
      collar,
      sleeve,
      colors: { ...colors },
      twoTone: { ...twoTone },
      layers: layers.map((layer) => ({ ...layer })),
      placements3d: { ...placements3d },
      view,
    });

    const nextColors = normalizeZoneColors(plan.colors);
    const appliedCollar = sportConfig.collarOptions.includes(plan.collar)
      ? plan.collar
      : /polo/i.test(plan.collar || "") && sportConfig.collarOptions.includes("Polo")
        ? "Polo"
        : collar;
    setCollar(appliedCollar);
    setSleeve(plan.sleeve);
    setColors(nextColors);
    setTwoTone((current) => ({
      ...current,
      enabled: nextColors.shorts.toUpperCase() !== nextColors.body.toUpperCase(),
      colorB: nextColors.shorts,
    }));

    const priorAiLayerIds = new Set(
      layers
        .filter((layer) => layer.source === "ai-uniform-pattern" || layer.source === "ai-uniform-element")
        .map((layer) => layer.id),
    );
    setPlacements3d((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => !priorAiLayerIds.has(id)),
    ));
    setLayers((current) => {
      const retained = current.filter(
        (layer) => layer.source !== "ai-uniform-pattern" && layer.source !== "ai-uniform-element",
      );
      const patternAdditions = !plan.pattern?.enabled || plan.pattern.key === "none"
        ? []
        : patternViewsFromPlan(plan.pattern.view).map((patternView) => ({
            id: nextLayerId(),
            type: "skin",
            skinKey: plan.pattern.key,
            source: "ai-uniform-pattern",
            name: `${plan.name || "AI uniform"} pattern`,
            view: patternView,
            x: 50,
            y: 43,
            size: 58,
            rotation: 0,
            src: skinDataUri(plan.pattern.key, nextColors.body, nextColors.shirtStrip),
          }));
      return [...retained, ...patternAdditions, ...productionLayersFromPlan(plan, { sport: activeSport })];
    });
    setSelectedLayerId(null);
    setPendingLayer(null);
    setView("front");
    if (plan.conceptImage?.src) setAiWorkspaceConcept(plan.conceptImage);
    setAiDesignApplied(true);
    setAiCanvasMode(canvasMode);
  };

  const undoAIUniformDesign = () => {
    if (!aiUndoSnapshot) return;
    setCollar(aiUndoSnapshot.collar);
    setSleeve(aiUndoSnapshot.sleeve);
    setColors(aiUndoSnapshot.colors);
    setTwoTone(aiUndoSnapshot.twoTone);
    setLayers(aiUndoSnapshot.layers);
    setPlacements3d(aiUndoSnapshot.placements3d);
    setView(aiUndoSnapshot.view);
    setSelectedLayerId(null);
    setAiUndoSnapshot(null);
    setAiDesignApplied(false);
    setAiCanvasMode(aiWorkspaceConcept?.src ? "concept" : "production");
  };

  const updateLayer = (id, patch) => {
    if (!manualEditingAllowed) return;
    const currentLayer = layers.find((layer) => layer.id === id);
    const updated = currentLayer ? { ...currentLayer, ...patch } : null;
    if (updated && isRestrictedSoccerSockPlacement({ sport: activeSport, ...updated })) {
      setPlacementError("Soccer socks support solid colour only. Artwork remains on its last valid garment position.");
      return;
    }
    setPlacementError("");
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  };

  const updateTextLayout = (id, textLayout) => {
    if (!manualEditingAllowed) return;
    setLayers((current) => current.map((layer) => (
      layer.id === id
        ? { ...layer, textLayout, text: formatProductionText(layer.text || "", textLayout) }
        : layer
    )));
  };

  /**
   * Skins are stored by key, not as a baked image, so they re-render whenever
   * the garment colours change — pick a pattern, then recolour the shirt, and
   * the pattern follows instead of stranding the old palette on the kit.
   */
  const addSkinLayer = (skinKey) => {
    const id = nextLayerId();
    setLayers((ls) => [
      ...ls,
      {
        id,
        type: "skin",
        skinKey,
        view,
        x: 50,
        y: 45,
        size: 30,
        rotation: 0,
        src: skinDataUri(skinKey, colors.body, colors.shirtStrip),
      },
    ]);
    setSelectedLayerId(id);
  };

  // Re-bake every skin's artwork when the palette moves.
  useEffect(() => {
    setLayers((ls) => {
      let changed = false;
      const next = ls.map((l) => {
        if (l.type !== "skin" || !l.skinKey) return l;
        const src = skinDataUri(l.skinKey, colors.body, colors.shirtStrip);
        if (src === l.src) return l;
        changed = true;
        return { ...l, src };
      });
      return changed ? next : ls;
    });
  }, [colors.body, colors.shirtStrip]);

  const duplicateLayer = (id) => {
    if (!manualEditingAllowed) return;
    const source = layers.find((l) => l.id === id);
    if (!source) return;
    const newId = nextLayerId();
    setLayers((ls) => [
      ...ls,
      { ...source, id: newId, x: Math.min(90, source.x + 6), y: Math.min(90, source.y + 6) },
    ]);
    const sourcePlacement = placements3d[id];
    if (sourcePlacement) {
      setPlacements3d((current) => ({
        ...current,
        [newId]: {
          ...sourcePlacement,
          position: sourcePlacement.position ? [...sourcePlacement.position] : sourcePlacement.position,
          orientation: sourcePlacement.orientation ? [...sourcePlacement.orientation] : sourcePlacement.orientation,
        },
      }));
    }
    setSelectedLayerId(newId);
  };

  const removeLayer = (id) => {
    if (!manualEditingAllowed) return;
    setLayers((ls) => ls.filter((l) => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const reorderLayer = (id, direction) => {
    if (!manualEditingAllowed) return;
    setLayers((ls) => {
      const sameView = ls.filter((l) => l.view === view);
      const idx = sameView.findIndex((l) => l.id === id);
      const swapWith = direction === "up" ? idx + 1 : idx - 1;
      if (swapWith < 0 || swapWith >= sameView.length) return ls;
      const a = sameView[idx];
      const b = sameView[swapWith];
      const globalA = ls.findIndex((l) => l.id === a.id);
      const globalB = ls.findIndex((l) => l.id === b.id);
      const next = [...ls];
      [next[globalA], next[globalB]] = [next[globalB], next[globalA]];
      return next;
    });
  };

  const addToRoster = () => {
    if (!rosterEntry.name.trim()) return;
    setRoster((r) => [
      ...r,
      {
        ...rosterEntry,
        quantity: Math.max(1, Number.parseInt(rosterEntry.quantity, 10) || 1),
        id: `${Date.now()}-${r.length}`,
      },
    ]);
    setRosterEntry(newRosterEntry());
  };
  const removeFromRoster = (id) => setRoster((r) => r.filter((entry) => entry.id !== id));

  const importRosterCsv = (text) => {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("The CSV needs a header row and at least one player.");

    const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const headers = rows[0].map(normalise);
    const valueFor = (row, aliases) => {
      const index = headers.findIndex((header) => aliases.includes(header));
      return index >= 0 ? row[index]?.trim() || "" : "";
    };
    const imported = rows
      .slice(1)
      .map((row, index) => {
        const name = valueFor(row, ["name", "player", "playername", "fullname"]);
        if (!name) return null;
        return {
          ...newRosterEntry(),
          id: `${Date.now()}-csv-${index}`,
          name,
          number: valueFor(row, ["number", "shirtnumber", "jerseynumber"]),
          shirtSize: valueFor(row, ["shirtsize", "jerseysize", "topsize"]) || "M",
          shortSize: valueFor(row, ["shortsize", "shortssize", "pantssize", "bottomsize"]) || "M",
          sleevePreference: valueFor(row, ["sleeve", "sleevelength", "sleevepreference"]).toLowerCase() === "long" ? "Long" : "Short",
          quantity: Math.max(1, Number.parseInt(valueFor(row, ["quantity", "qty"]), 10) || 1),
          notes: valueFor(row, ["notes", "note", "comments"]),
        };
      })
      .filter(Boolean);

    if (!imported.length) throw new Error('No players were found. Include a "Name" column.');
    setRoster((current) => [...current, ...imported]);
    return imported.length;
  };

  const handleDownload = async () => {
    if (showingAIConcept && aiWorkspaceConcept?.src) {
      const baseName = safeExportName(aiUniformPlan?.name || "ai-uniform-concept");
      const conceptViews = aiUniformPlan?.conceptViews;
      const separateConceptViews = ["front", "side", "back"]
        .map((viewName) => ({ viewName, src: conceptViews?.[viewName]?.src || conceptViews?.[viewName] }))
        .filter((item) => item.src);
      if (separateConceptViews.length) {
        separateConceptViews.forEach(({ viewName, src }) => downloadDataUrl(src, `${baseName}-${viewName}.png`));
      } else {
        downloadDataUrl(aiWorkspaceConcept.src, `${baseName}-ai-concept.png`);
      }
      return;
    }
    if (!stageRef.current) return;
    setExporting(true);
    try {
      const baseName = safeExportName(template?.name || `${activeSport}-uniform`);
      const surfaces = [...stageRef.current.querySelectorAll("[data-uniform-export-view]")];
      if (!surfaces.length) {
        const dataUrl = await toPng(stageRef.current, { pixelRatio: 2, skipFonts: true });
        downloadDataUrl(dataUrl, `${baseName}-front-side-back.png`);
      } else {
        for (const surface of surfaces) {
          const dataUrl = await toPng(surface, { pixelRatio: 3, skipFonts: true });
          downloadDataUrl(dataUrl, `${baseName}-${surface.dataset.uniformExportView}.png`);
        }
      }
    } catch {
      /* export best-effort — canvas export can fail on some browsers with
         cross-origin images; the design itself is unaffected either way */
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSvg = () => {
    const svgs = stageRef.current?.querySelectorAll("svg[data-uniform-view]");
    if (!svgs?.length) return;
    svgs.forEach((svg) => {
      const copy = svg.cloneNode(true);
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copy.setAttribute("width", "1200");
      copy.setAttribute("height", "1500");
      const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${template?.name || "uniform"}-${svg.dataset.uniformView}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  /**
   * Capture whichever surface the customer actually designed on.
   *
   * The flat editor is a DOM node (html-to-image); the 3D view is a WebGL
   * canvas (toDataURL via CaptureBridge). Previously only the DOM path
   * existed, and JerseyStage isn't mounted while the 3D view is open — so
   * anyone who designed in 3D submitted an order with no image whatsoever.
   */
  const capturePreview = async () => {
    if (stageMode === "3d" && capture3dRef.current) {
      const shot = capture3dRef.current();
      if (shot) return shot;
    }
    if (stageRef.current) {
      try {
        return await toPng(stageRef.current, { pixelRatio: 1.5, skipFonts: true });
      } catch {
        return null;
      }
    }
    if (aiWorkspaceConcept?.src) return aiWorkspaceConcept.src;
    return null;
  };

  const contactValid =
    contact.name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim());

  const buildUniformPayload = (previewImage = null) => {
    const unitCount = rosterUnitCount(roster);
    const supporterCount = fanJerseyAdded ? supporterJerseyCount(supporterJerseys) : 0;
    const categoryPricing = uniformPricingFor(activeSport);
    return {
      template: template?.name || "Blank Canvas",
      sport: activeSport,
      collar,
      sleeve,
      colors,
      fitType,
      kitType: "Full",
      extraTeamShirts: [],
      logoApplication,
      insideCollarMessage,
      insideCollarText,
      insideCollarAttachment: insideCollarMessage ? insideCollarAttachment : null,
      fanJerseyAdded,
      supporterJerseys: fanJerseyAdded ? supporterJerseys : [],
      unitPrice,
      grandTotal: unitPrice * unitCount + mixedSleeveSurcharge(sleeve, roster) + supporterCount * categoryPricing.shirtPrice,
      layers,
      placements3d,
      designMode: stageMode === "3d" ? "3d" : "flat",
      roster,
      socksQuantity,
      contact,
      previewImage,
      projectId: designSecurityContext?.projectId || "",
      aiDesignName: aiUniformPlan?.name || aiWorkspaceConcept?.name || null,
      aiDesignSummary: aiUniformPlan?.summary || null,
    };
  };

  const handleRequestQuote = async () => {
    if (!hasSelectedFit) {
      setQuoteError("Select Men, Women or Youth in Design before continuing.");
      return;
    }
    if (!minimumKitsMet) {
      setQuoteError(`Minimum order: ${minimumKits} full kits. Extra shirts do not count toward this minimum.`);
      return;
    }
    if (!socksQuantityValid) {
      setQuoteError(`Socks quantity must be ${requiredSocksQuantity} to match the full-kit order.`);
      return;
    }
    if (!contactValid) {
      setQuoteError("Add your name and a valid email so we can send the quote back to you.");
      return;
    }

    const preview = await capturePreview();
    setPreviewImg(preview);

    setQuoteError(null);
    setSubmittingQuote(true);
    try {
      await submitUniformQuote(buildUniformPayload(preview));
      setSubmitted(true);
    } catch (err) {
      setQuoteError(err.message || "Couldn't send your quote request. Please try again.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  if (submitted) {
    return (
      <div className="h-[100dvh] flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          {previewImg && (
            <img
              src={previewImg}
              alt="Your jersey design"
              className="w-40 h-auto mx-auto mb-6 rounded-xl border border-background-200/70 shadow-sm"
            />
          )}
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-6">
            <i className="ri-check-line text-3xl" />
          </div>
          <h1 className="font-heading text-3xl font-light text-foreground-950 mb-3">
            Quote request sent
          </h1>
          <p className="text-sm text-foreground-600 font-label mb-8">
            We've got your {rosterUnitCount(roster)}-kit roster for the {template?.name || "Blank Canvas"}{" "}
            design. Our team will follow up with a production proof and pricing within one
            business day.
          </p>
          <Button to="/" icon="ri-arrow-right-line">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  // ---------- AI Design Studio entry ----------
  if (!selectedTemplate) {
    const studioEntryTemplate = { slug: "blank-canvas", defaultCollar: "Crew", defaultSleeve: "Short" };
    const studioCoverTemplates = sports.map((sport) => ({
      sport,
      template: templates.find((candidate) => candidate.sportSlug === sport.slug && candidate.slug !== "blank-canvas"),
    })).filter(({ template }) => Boolean(template));

    return (
      <div className="min-h-[100dvh] bg-[linear-gradient(145deg,#f8f3e9_0%,#fffdf8_48%,#eef8f1_100%)] text-foreground-950">
        <header className="border-b border-background-200/60 bg-background-50/80 backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3 md:px-8">
            <Button to="/" variant="ghost" size="sm" icon="ri-arrow-left-line" iconPosition="left">
              Back to site
            </Button>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
          <section className="mb-4 flex justify-end">
            <ol className="grid grid-cols-3 overflow-hidden rounded-xl border border-background-300/80 bg-background-50/80 shadow-[0_8px_24px_rgba(69,48,30,.05)] backdrop-blur-sm">
              {["Design", "Team roster", "Review & quote"].map((label, index) => (
                <li
                  key={label}
                  className="flex min-w-0 flex-col gap-0.5 border-l border-background-200/80 px-3 py-2.5 first:border-l-0"
                >
                  <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-foreground-400">
                    Step {index + 1}
                  </span>
                  <span className="text-xs font-semibold capitalize text-foreground-700">{label}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-[24px] border border-background-300/70 bg-background-50/90 p-3 shadow-[0_18px_48px_rgba(69,48,30,0.06)] backdrop-blur-sm sm:p-4">
            <div data-testid="studio-entry-brand" className="pb-3 text-center sm:pb-4">
              <p className="font-label text-[9px] font-bold uppercase tracking-[0.2em] text-primary-700">
                Connect767 Design Studio
              </p>
              <span className="font-heading text-base font-semibold">Custom Uniforms &amp; Clothing</span>
            </div>
            <button
              type="button"
              aria-label="Enter Design Studio"
              onClick={() => selectTemplate(studioEntryTemplate, "soccer", "ai")}
              className="group relative block w-full overflow-hidden rounded-[20px] border border-primary-300/80 bg-[#123126] text-left shadow-[0_18px_44px_rgba(0,74,45,.14)] transition duration-300 hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-[0_24px_54px_rgba(0,74,45,.2)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 cursor-pointer"
            >
              <span className="grid h-[320px] grid-cols-3 grid-rows-2 sm:h-[350px]" aria-hidden="true">
                {studioCoverTemplates.map(({ sport, template }, index) => (
                  <span key={sport.slug} className="relative flex items-center justify-center overflow-hidden border border-white/[0.04] bg-[radial-gradient(circle_at_center,rgba(255,255,255,.08),transparent_70%)] p-4">
                    <img
                      data-testid="studio-cover-category"
                      src={template.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full select-none object-contain opacity-45 grayscale contrast-125 mix-blend-luminosity drop-shadow-[-2px_-2px_2px_rgba(255,255,255,.15)] drop-shadow-[4px_5px_5px_rgba(0,0,0,.46)] transition duration-300 group-hover:opacity-60 group-hover:scale-[1.02]"
                    />
                    <span
                      data-testid="studio-cover-category-label"
                      className={`absolute left-3 rounded-full border border-white/10 bg-black/20 px-2 py-1 font-label text-[8px] font-bold uppercase tracking-[0.14em] text-white/65 backdrop-blur-sm sm:left-4 sm:text-[9px] ${index < 3 ? "top-2.5 sm:top-3" : "bottom-2.5 sm:bottom-3"}`}
                    >
                      {categoryDetails[sport.slug]?.title || sport.label}
                    </span>
                  </span>
                ))}
              </span>
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,18,11,.12),rgba(4,18,11,.68))]" aria-hidden="true" />
              <span className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                <img
                  data-testid="studio-entry-ai-logo"
                  src="/connect767-ai-logo-transparent.png"
                  alt="Connect767 AI"
                  className="h-12 w-12 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,.35)] sm:h-14 sm:w-14"
                />
                <strong className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">Enter Design Studio</strong>
                <span className="mt-2 text-xs text-white/70 sm:text-sm">Choose your category and fit inside.</span>
                <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-lg shadow-[0_10px_24px_rgba(0,0,0,.25)] transition group-hover:translate-x-1 group-hover:bg-primary-400"><i className="ri-arrow-right-line" /></span>
              </span>
            </button>
          </section>
        </main>
      </div>
    );
  }

  const uniformSetupPanel = <UniformSetupPanel
    aiOnly
    designProps={{ sport: activeSport, collar, setCollar, sleeve, setSleeve, colors: stageColors, setColors: updateGarmentColors, onHoverZone: setHoverZone, twoTone, setTwoTone }}
    optionsProps={{ sport: activeSport, fitType, setFitType, kitType, setKitType, extraTeamShirts, setExtraTeamShirts, logoApplication, setLogoApplication, insideCollarMessage, setInsideCollarMessage, insideCollarText, setInsideCollarText, insideCollarAttachment, setInsideCollarAttachment, showFitAlert: true, highlightMissing: designValidationAttempted }}
  />;

  const categoryRequiredPanel = (
    <section
      id="category-selection-required"
      aria-labelledby="required-category-title"
      className={`shrink-0 rounded-xl border-2 bg-white p-2 shadow-sm ${!categoryConfirmed && designValidationAttempted ? "border-accent-400 ring-2 ring-accent-300" : "border-primary-500"}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div>
          <h3 id="required-category-title" className="text-xs font-bold text-foreground-900">Uniform Category</h3>
          <p className="text-[8px] text-foreground-500">Choose a category, then its required fit.</p>
        </div>
        <RequiredIndicator />
      </div>
      {!categoryConfirmed && <div role="alert" className="mb-2 flex items-center gap-2 rounded-lg border border-accent-300 bg-accent-50 px-2.5 py-1.5 text-accent-950">
        <i className="ri-error-warning-fill text-sm text-accent-600" aria-hidden="true" />
        <p className="text-[10px] font-semibold">Select a category to continue to Team roster.</p>
      </div>}
      <div className="grid grid-cols-2 gap-1" role="group" aria-label="Uniform category (required)">
        {sports.map((sport) => {
          const selected = categoryConfirmed && sport.slug === activeSport;
          const details = categoryDetails[sport.slug] || { title: sport.label };
          return (
            <button
              key={sport.slug}
              type="button"
              aria-pressed={selected}
              aria-label={`${details.title} category`}
              onClick={() => changeDesignCategory(sport.slug)}
              className={`relative flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition ${selected ? "border-primary-700 bg-primary-700 text-white shadow-sm" : "border-background-300 bg-background-50 text-foreground-900 hover:border-primary-400 hover:bg-primary-50"}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs ${selected ? "bg-white/15" : "bg-primary-50 text-primary-700"}`}><i className={sport.icon || "ri-shirt-line"} /></span>
              <strong className="min-w-0 truncate text-[10px] leading-tight">{details.title}</strong>
              {selected && <i className="ri-check-line absolute right-1.5 top-1.5 text-xs" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t border-background-200 pt-2">
        <OptionsPanel
          sport={activeSport}
          fitType={fitType}
          setFitType={setFitType}
          kitType={kitType}
          setKitType={setKitType}
          logoApplication={logoApplication}
          setLogoApplication={setLogoApplication}
          insideCollarMessage={insideCollarMessage}
          setInsideCollarMessage={setInsideCollarMessage}
          insideCollarText={insideCollarText}
          setInsideCollarText={setInsideCollarText}
          insideCollarAttachment={insideCollarAttachment}
          setInsideCollarAttachment={setInsideCollarAttachment}
          section="fitOnly"
          showFitAlert={false}
          highlightMissing={designValidationAttempted}
        />
      </div>
    </section>
  );

  const categorySelectionPanel = (
    <aside
      aria-label="Sport category selection"
      className="flex max-h-[48dvh] min-h-0 w-full min-w-0 max-w-none flex-shrink-0 flex-col border-b border-background-300 bg-[#f8f7f2] text-foreground-950 shadow-[0_18px_44px_rgba(0,0,0,.2)] md:max-h-none md:w-[360px] md:min-w-[340px] md:max-w-[380px] md:border-b-0 md:border-r md:shadow-[18px_0_44px_rgba(0,0,0,.2)] xl:w-[380px]"
    >
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-background-200 bg-white px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-lg text-white"><i className="ri-apps-2-line" /></span>
        <span className="min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary-700">Step 1</span>
          <h2 className="font-heading text-lg font-semibold leading-tight">Choose a Category</h2>
          <p className="text-[10px] text-foreground-500">Loads the correct AI uniform foundation</p>
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="grid grid-cols-2 gap-2" role="list" aria-label="Available sport categories">
          {sports.map((sport) => {
            const selected = sport.slug === activeSport;
            const categoryTemplate = primaryTemplateForSport(sport.slug);
            const details = categoryDetails[sport.slug] || { title: sport.label, description: "Custom teamwear" };
            return (
              <button
                key={sport.slug}
                type="button"
                aria-pressed={selected}
                aria-label={`${details.title} category`}
                onClick={() => changeDesignCategory(sport.slug)}
                className={`group relative flex min-h-[112px] cursor-pointer flex-col items-start justify-between overflow-hidden rounded-2xl border p-3 text-left transition ${
                  selected
                    ? "border-primary-600 bg-primary-700 text-white shadow-[0_10px_24px_rgba(0,116,73,.2)]"
                    : "border-background-300 bg-white text-foreground-900 hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-md"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${selected ? "bg-white/15" : "bg-primary-50 text-primary-700"}`}>
                  <i className={sport.icon || "ri-shirt-line"} aria-hidden="true" />
                </span>
                <span className="mt-3 block min-w-0">
                  <strong className="block text-xs leading-tight">{details.title}</strong>
                  <span className={`mt-1 block truncate text-[9px] ${selected ? "text-white/65" : "text-foreground-500"}`}>{categoryTemplate?.name || "AI foundation"}</span>
                </span>
                {selected && <i className="ri-check-line absolute right-3 top-3 text-base" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-2xl border border-primary-200 bg-primary-50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-primary-700 shadow-sm">
              <i className={sports.find((sport) => sport.slug === activeSport)?.icon || "ri-shirt-line"} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-xs text-primary-950">{categoryDetails[activeSport]?.title}</strong>
              <span className="mt-0.5 block text-[9px] leading-relaxed text-foreground-600">{categoryDetails[activeSport]?.description}</span>
            </span>
          </div>
        </div>
      </div>
      <footer className="flex-shrink-0 border-t border-background-200 bg-white p-3 shadow-[0_-10px_28px_rgba(31,43,35,.08)]">
        <button
          type="button"
          onClick={continueWorkflow}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,116,73,.22)] transition hover:bg-primary-500"
        >
          Continue to AI Design <i className="ri-arrow-right-line text-base" aria-hidden="true" />
        </button>
      </footer>
    </aside>
  );

  const headerTileClass = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition";
  const headerIconTileClass = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition";
  const renderCanvasControls = () => {
    if (!headerCapabilities.openAIPreview && !headerCapabilities.discardAI && !headerCapabilities.viewport) return null;
    return (
      <div className="flex max-w-full shrink-0 flex-nowrap items-center justify-end gap-2">
        {headerCapabilities.openAIPreview && <button
          type="button"
          onClick={() => switchAICanvasMode("concept")}
          className={`${headerTileClass} min-w-[104px] cursor-pointer border-accent-400/55 bg-accent-500 text-white hover:bg-accent-600`}
        >
          AI 3D Preview
        </button>}
        {headerCapabilities.discardAI && (
          <button
            type="button"
            aria-label="Discard AI design"
            title="Discard design"
            onClick={() => {
              setAiUniformPlan(null);
              setAiWorkspaceConcept(null);
              setAiVersions([]);
              setAiComparisonPlan(null);
              setAiDesignApplied(false);
              setAiCanvasMode("concept");
              setStudioMode(STUDIO_MODES.AI_OUTPUT);
            }}
            className={`${headerIconTileClass} cursor-pointer border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/10 hover:text-white`}
          >
            <i className="ri-delete-bin-line" />
          </button>
        )}
        {headerCapabilities.viewport && (
          <div className="inline-flex h-9 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.035] px-0.5">
            {showingProductionMap && <button type="button" aria-label="Pan production map" aria-pressed={productionPanMode} title="Pan mode: drag anywhere. Turn off to edit artwork. Alt-drag also pans." disabled={Boolean(pendingLayer)} onClick={() => setProductionPanMode((current) => !current)} className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md disabled:opacity-40 ${productionPanMode ? "bg-primary-600 text-white" : "text-background-50/60 hover:bg-white/10 hover:text-background-50"}`}><i className="ri-hand-line text-xs" /></button>}
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setClampedZoom((value) => value - 0.1)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-background-50/60 hover:bg-white/10 hover:text-background-50"><i className="ri-subtract-line text-xs" /></button>
            <span className="w-11 text-center font-label text-[10px] tabular-nums text-background-50/70">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setClampedZoom((value) => value + 0.1)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-background-50/60 hover:bg-white/10 hover:text-background-50"><i className="ri-add-line text-xs" /></button>
            {showingAIConcept && <button type="button" aria-label="Reset design view" title="Reset view" onClick={resetAIConceptView} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-background-50/60 hover:bg-white/10 hover:text-background-50"><i className="ri-focus-3-line text-xs" /></button>}
            {showingProductionMap && <button type="button" aria-label="Fit production map" title="Reset zoom and pan" onClick={() => productionViewportRef.current?.reset()} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-background-50/60 hover:bg-white/10 hover:text-background-50"><i className="ri-focus-3-line text-xs" /></button>}
          </div>
        )}
      </div>
    );
  };

  // ---------- The studio itself: one full viewport, nothing else ----------
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#10110f] text-background-50">
      <header className="relative z-40 flex min-h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0c0d0b]/95 px-3 py-2.5 pt-[max(.625rem,env(safe-area-inset-top))] sm:px-4 md:px-5">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-background-50/60 transition hover:bg-white/[0.06] hover:text-background-50"
        >
          <i className="ri-arrow-left-line" />
          Back
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="truncate text-sm font-semibold text-background-50/85">
            {aiUniformPlan?.name || (template?.slug === "blank-canvas" ? "AI Uniform" : template?.name) || "AI Uniform"}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary-500/20 bg-primary-950/35 px-2.5 py-1 text-[10px] font-semibold text-primary-200/90 xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Auto-saved
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
          {headerCapabilities.aiDesigner && (
            <button
              type="button"
              onClick={openAIDesigner}
              className={`${headerTileClass} cursor-pointer font-bold disabled:cursor-not-allowed disabled:opacity-45 ${
                activeTool === "ai"
                  ? "border-accent-400 bg-accent-500 text-white shadow-[0_8px_20px_rgba(239,84,53,0.22)]"
                  : "border-accent-400/40 bg-accent-950/30 text-accent-200 hover:border-accent-300 hover:bg-accent-950/55"
              }`}
            >
              <span className="relative block h-5 w-5 shrink-0" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}connect767-ai-logo-transparent.png?v=20261117`} alt="" className="h-full w-full object-contain brightness-0 invert" />
                <i className="ri-sparkling-2-fill absolute -right-0.5 -top-0.5 text-[8px] leading-none text-white" />
              </span>
              <span className="hidden sm:inline">AI Designer</span>
              <span className="sm:hidden">AI</span>
            </button>
          )}
          {headerCapabilities.refineAI && (
            <button
              type="button"
              onClick={openAIDesigner}
              className={`${headerTileClass} cursor-pointer border-primary-400/45 bg-primary-700 text-white hover:border-primary-300 hover:bg-primary-600`}
              aria-label="Refine uniform with AI"
            >
              <i className="ri-magic-line" />
              <span className="hidden lg:inline">Refine with AI</span>
              <span className="lg:hidden">Refine</span>
            </button>
          )}
          {renderCanvasControls()}
          {headerCapabilities.saveProgress && <button
            type="button"
            onClick={saveProgress}
            className={`${headerTileClass} cursor-pointer ${
              manualSaveStatus === "saved"
                ? "border-primary-400/55 bg-primary-700 text-white"
                : manualSaveStatus === "error"
                  ? "border-red-400/55 bg-red-950/50 text-red-200"
                  : "border-white/[0.1] bg-white/[0.045] text-background-50/75 hover:border-primary-500/45 hover:bg-primary-950/45 hover:text-primary-100"
            }`}
            aria-live="polite"
          >
            <i className={manualSaveStatus === "saved" ? "ri-check-line" : "ri-save-3-line"} />
            <span className="hidden sm:inline">
              {manualSaveStatus === "saved" ? "Progress saved" : manualSaveStatus === "error" ? "Save failed" : "Save progress"}
            </span>
          </button>}
          {ENABLE_3D && manualEditingAllowed && (
            <button
              type="button"
              aria-pressed={stageMode === "3d"}
              onClick={() => setStageMode((mode) => (mode === "3d" ? "edit" : "3d"))}
              className={`${headerTileClass} cursor-pointer ${
                stageMode === "3d"
                  ? "border-primary-500 bg-primary-600 text-white shadow-[0_8px_18px_rgba(0,116,73,0.28)]"
                  : "border-primary-500/45 bg-primary-950/55 text-primary-100 hover:border-primary-400 hover:bg-primary-900"
              }`}
            >
              <i className={stageMode === "3d" ? "ri-edit-2-line" : "ri-3d-cube-sphere-line"} />
              {stageMode === "3d" ? "Return to 2D" : "View in 3D"}
            </button>
          )}
          {headerCapabilities.svgExport && (
            <button
              type="button"
              onClick={handleDownloadSvg}
              className={`${headerTileClass} hidden cursor-pointer border-white/10 bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50 sm:inline-flex`}
            >
              <i className="ri-file-code-line" /> SVG
            </button>
          )}
          {headerCapabilities.fullscreen && (
            <button
              type="button"
              onClick={() => aiConceptViewportRef.current?.requestFullscreen?.()}
              className={`${headerTileClass} cursor-pointer border-white/10 bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50`}
            >
              <i className="ri-fullscreen-line" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          )}
          {headerCapabilities.download && <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            className={`${headerTileClass} cursor-pointer border-white/10 bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <i className="ri-download-2-line" />
            <span className="hidden sm:inline">{exporting ? "Exporting…" : "Download"}</span>
          </button>}
          {headerCapabilities.settings && <button
            type="button"
            onClick={() => setStudioSettingsOpen(true)}
            aria-label="Studio settings"
            title="AI Studio Settings"
            aria-haspopup="dialog"
            aria-expanded={studioSettingsOpen}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-background-50/75 transition hover:border-primary-500/45 hover:bg-primary-950/45 hover:text-primary-100"
          >
              <i className="ri-settings-3-line text-base" aria-hidden="true" />
          </button>}
        </div>
      </header>

      <nav
        aria-label="Uniform order progress"
        className="relative z-30 flex-shrink-0 border-b border-white/[0.06] bg-[#12130f] px-3 py-1.5 sm:px-5"
      >
        <div className="mx-auto flex max-w-[1040px] items-center justify-start gap-2 overflow-x-auto lg:justify-center">
          {studioWorkflow.map((step, index) => {
            const active = index === workflowIndex;
            const complete = index < workflowIndex;
            const locked = (step.key !== "design" && !canContinueDesign) || (step.key === "review" && !rosterReadyForReview);
            const stepDescription = step.key === "design" && categoryConfirmed
              ? `${categoryDetails[activeSport]?.title || "Category"} · ${hasSelectedFit ? fitType : "Fit required"}`
              : step.description;
            return (
              <div key={step.key} className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  disabled={locked}
                  onClick={() => openWorkflowStep(index)}
                  className={`group flex min-h-[68px] w-[240px] shrink-0 items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition sm:w-[270px] lg:w-[300px] ${
                    active
                      ? "cursor-pointer border-primary-400/45 bg-primary-700 text-white shadow-[0_8px_22px_rgba(0,116,73,0.2)]"
                      : complete
                        ? "cursor-pointer border-primary-700/35 bg-primary-950/35 text-primary-100 hover:bg-primary-950/55"
                        : locked
                          ? "cursor-not-allowed border-white/[0.04] bg-white/[0.02] text-background-50/25"
                          : "cursor-pointer border-white/[0.07] bg-white/[0.025] text-background-50/55 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-background-50/80"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                    active
                      ? "border-white/20 bg-white/15"
                      : complete
                        ? "border-primary-500/35 bg-primary-700 text-white"
                        : "border-white/[0.08] bg-white/[0.05]"
                  }`}>
                    {complete ? <i className="ri-check-line" /> : locked ? <i className="ri-lock-line" /> : step.step}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 whitespace-nowrap text-sm font-bold capitalize">
                      <i className={`${step.icon} text-base opacity-70`} />
                      {step.label}
                    </span>
                    <span className={`mt-0.5 hidden whitespace-nowrap text-[10px] sm:block ${active ? "text-white/70" : "text-current opacity-55"}`}>
                      {stepDescription}
                    </span>
                  </span>
                </button>
                {index < studioWorkflow.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm transition ${
                      complete
                        ? "border-primary-500/35 bg-primary-950/50 text-primary-300"
                        : "border-white/[0.07] bg-white/[0.025] text-background-50/30"
                    }`}
                  >
                    <i className="ri-arrow-right-line" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {studioSettingsOpen && (
        <div
          className="fixed inset-0 z-[75] flex justify-end bg-foreground-950/55 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setStudioSettingsOpen(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-settings-title"
            aria-label="AI Studio settings"
            className="flex h-full w-full max-w-[390px] flex-col border-l border-background-300 bg-[#f8f7f2] text-foreground-950 shadow-[-24px_0_70px_rgba(0,0,0,.38)]"
          >
            <header className="flex items-center justify-between gap-4 border-b border-background-200 bg-white px-5 py-4">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-white"><i className="ri-settings-3-line" /></span>
                <span><h2 id="studio-settings-title" className="font-heading text-lg font-semibold">AI Studio Settings</h2><p className="text-[10px] text-foreground-500">AI workspace and canvas appearance</p></span>
              </span>
              <button type="button" onClick={() => setStudioSettingsOpen(false)} aria-label="Close studio settings" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"><i className="ri-close-line text-lg" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {headerCapabilities.openEditableStudio && (
                <div className="mb-5 border-b border-background-200 pb-5">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground-500">Workspace mode</p>
                  <button
                    type="button"
                    onClick={() => { setStudioSettingsOpen(false); convertAIToEditableDesign(); }}
                    disabled={!editablePlanValidation.valid || studioMode === STUDIO_MODES.AI_GENERATING}
                    title={editablePlanValidation.reason}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-primary-300 bg-primary-700 px-3 py-3 text-left text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:border-background-300 disabled:bg-background-200 disabled:text-foreground-400"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"><i className="ri-layout-grid-line" /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-xs">Open Production Mode</strong><span className="block text-[9px] text-white/70">Convert this preview to an editable production design</span></span>
                    <i className="ri-arrow-right-line" />
                  </button>
                </div>
              )}
              <StudioBackgroundPanel studioBackground={studioBackground} setStudioBackground={setStudioBackground} />
            </div>
          </aside>
        </div>
      )}

      {exitPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground-950/70 backdrop-blur-sm px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            className="w-full max-w-sm rounded-2xl bg-background-50 shadow-2xl p-6"
          >
            <h2 id="exit-title" className="font-heading text-xl font-medium text-foreground-950 mb-2">
              Keep this design?
            </h2>
            <p className="text-sm text-foreground-600 font-label mb-6">
              Your design is saved on this device, so you can come back to this kit and carry on
              where you left off.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setExitPrompt(false);
                  setSelectedTemplate(null);
                }}
              >
                Save &amp; leave
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  discardSaved();
                  setExitPrompt(false);
                  setSelectedTemplate(null);
                }}
              >
                Discard the design
              </Button>
              <button
                type="button"
                onClick={() => setExitPrompt(false)}
                className="w-full py-2 text-sm font-semibold text-foreground-500 hover:text-foreground-800 cursor-pointer"
              >
                Cancel — keep designing
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_48%_42%,rgba(36,45,36,0.32),transparent_38%),linear-gradient(135deg,#10110f_0%,#151610_52%,#10110f_100%)] md:flex-row">
                  {workflowStep.key === "design" && (
                    <aside aria-labelledby="uniform-order-setup-title" className="flex max-h-[45dvh] min-h-0 w-full min-w-0 max-w-none flex-shrink-0 flex-col border-b border-background-300 bg-[#f8f7f2] text-foreground-950 shadow-[0_18px_44px_rgba(0,0,0,.2)] md:max-h-none md:w-[360px] md:min-w-[340px] md:max-w-[380px] md:border-b-0 md:border-r md:shadow-[18px_0_44px_rgba(0,0,0,.2)] xl:w-[380px]">
                      <header className="flex flex-shrink-0 items-center gap-2.5 border-b border-background-200 bg-white px-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-700 text-sm text-white"><i className="ri-shirt-line" /></span>
                        <span className="min-w-0"><h2 id="uniform-order-setup-title" aria-label="Uniform &amp; order setup" className="font-heading text-[15px] font-semibold leading-tight">Uniform &amp; Order Setup</h2><p className="truncate text-[8px] text-foreground-500">Required category and fit, followed by production options</p></span>
                      </header>
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2">{categoryRequiredPanel}{uniformSetupPanel}</div>
                      <footer className="flex-shrink-0 border-t border-background-200 bg-white p-2 shadow-[0_-10px_28px_rgba(31,43,35,.08)]">
                        <button
                          type="button"
                          onClick={continueWorkflow}
                          title={designContinueTitle}
                          aria-label="Continue to Team roster"
                          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,116,73,.22)] transition hover:bg-primary-500"
                        >
                          Continue to Team Roster <i className="ri-arrow-right-line text-base" aria-hidden="true" />
                        </button>
                      </footer>
                    </aside>
                  )}
                  {/* Canvas */}
                  <div className={`flex min-w-0 flex-1 flex-col items-center overflow-hidden ${(activeTool === "ai" || workflowStep.key === "category") ? "gap-0 px-0 py-0" : "gap-3 px-4 py-3 md:px-6 xl:px-10"}`}>
                    {strictAIPreview && conversionError && (
                      <p role="alert" className="relative z-20 w-full max-w-[1536px] flex-shrink-0 self-center rounded-lg border border-red-300/25 bg-red-950/30 px-3 py-1.5 text-[8px] leading-relaxed text-red-100">
                        {conversionError}
                      </p>
                    )}
                    {/* Floating contextual toolbar */}
                    {manualEditingAllowed && stageMode === "edit" && selectedLayer && (
                      <div className="flex items-center flex-shrink-0">
                        <FloatingToolbar
                          layer={selectedLayer}
                          onUpdate={updateLayer}
                          onDuplicate={duplicateLayer}
                          onDelete={removeLayer}
                          onReorder={reorderLayer}
                        />
                      </div>
                    )}

                    {showingAIConcept ? (
                      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
                        <div
                          ref={aiConceptViewportRef}
                          className="relative inline-flex max-h-full max-w-full cursor-grab overflow-hidden rounded-2xl border border-white/10 bg-[#f5f0e7] shadow-[0_26px_70px_rgba(0,0,0,.34)] outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary-400"
                          role="group"
                          tabIndex={0}
                          aria-label="Interactive AI uniform concept. Drag to pan, use the mouse wheel or toolbar to zoom, and use arrow keys to move the design."
                          onWheel={(event) => {
                            event.preventDefault();
                            setClampedZoom((value) => value + (event.deltaY < 0 ? 0.15 : -0.15));
                          }}
                          onKeyDown={(event) => {
                            const step = event.shiftKey ? 40 : 16;
                            const movement = {
                              ArrowLeft: { x: -step, y: 0 },
                              ArrowRight: { x: step, y: 0 },
                              ArrowUp: { x: 0, y: -step },
                              ArrowDown: { x: 0, y: step },
                            }[event.key];
                            if (!movement) return;
                            event.preventDefault();
                            setAiConceptPan((current) => ({ x: current.x + movement.x, y: current.y + movement.y }));
                          }}
                          onDoubleClick={resetAIConceptView}
                          onContextMenu={(event) => event.preventDefault()}
                          onPointerDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            aiConceptDragRef.current = {
                              pointerId: event.pointerId,
                              startX: event.clientX,
                              startY: event.clientY,
                              panX: aiConceptPan.x,
                              panY: aiConceptPan.y,
                            };
                          }}
                          onPointerMove={(event) => {
                            const drag = aiConceptDragRef.current;
                            if (!drag || drag.pointerId !== event.pointerId) return;
                            setAiConceptPan({
                              x: drag.panX + event.clientX - drag.startX,
                              y: drag.panY + event.clientY - drag.startY,
                            });
                          }}
                          onPointerUp={(event) => {
                            if (aiConceptDragRef.current?.pointerId !== event.pointerId) return;
                            aiConceptDragRef.current = null;
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            }
                          }}
                          onPointerCancel={() => { aiConceptDragRef.current = null; }}
                          style={{ touchAction: "none", backgroundColor: aiConceptBackground }}
                        >
                          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/20 bg-foreground-950/75 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/90 backdrop-blur">
                            AI-Generated Preview — Edit with AI Only
                          </div>
                          {aiComparisonPlan?.conceptImage?.src ? (
                            <div className="relative z-10 grid max-h-full max-w-full grid-cols-2 gap-px bg-foreground-900 p-px">
                              <figure className="relative min-w-0 bg-[#f5f0e7]" style={{ backgroundColor: aiComparisonBackgrounds.previous }}>
                                <img src={aiComparisonPlan.conceptImage.src} alt="Previous AI-generated uniform version" draggable="false" className="block max-h-full w-full select-none object-contain" onLoad={(event) => setAiComparisonBackgrounds((current) => ({ ...current, previous: sampleImageEdgeColor(event.currentTarget) }))} />
                                <figcaption className="absolute left-3 top-3 rounded-full bg-foreground-950/75 px-3 py-1 text-[9px] font-bold text-white">Previous</figcaption>
                              </figure>
                              <figure className="relative min-w-0 bg-[#f5f0e7]" style={{ backgroundColor: aiComparisonBackgrounds.current }}>
                                <img src={aiWorkspaceConcept.src} alt="Current AI-generated uniform version" draggable="false" className="block max-h-full w-full select-none object-contain" onLoad={(event) => setAiComparisonBackgrounds((current) => ({ ...current, current: sampleImageEdgeColor(event.currentTarget) }))} />
                                <figcaption className="absolute left-3 top-3 rounded-full bg-primary-800/85 px-3 py-1 text-[9px] font-bold text-white">Current</figcaption>
                              </figure>
                            </div>
                          ) : (
                            <img
                              src={aiWorkspaceConcept.src}
                              alt={`${aiUniformPlan?.name || aiWorkspaceConcept?.name || "AI generated"} complete front, side and back uniform concept`}
                              draggable="false"
                              className="relative z-10 block max-h-full max-w-full select-none object-contain will-change-transform"
                              onLoad={(event) => setAiConceptBackground(sampleImageEdgeColor(event.currentTarget))}
                              style={{
                                transform: `translate3d(${aiConceptPan.x}px, ${aiConceptPan.y}px, 0) scale(${zoom})`,
                                transformOrigin: "center",
                              }}
                            />
                          )}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-foreground-950/75 px-4 py-2 text-center text-[10px] text-white/80 backdrop-blur">
                            {aiComparisonPlan ? "Comparing previous and current AI previews" : "Drag to pan · scroll to zoom · double-click to fit"}
                          </div>
                        </div>
                      </div>
                    ) : stageMode === "edit" && !aiWorkspaceConcept?.src ? (
                      <div className="flex min-h-0 w-full flex-1 items-stretch justify-center">
                        <div className="relative flex h-full w-full max-w-none flex-col items-center justify-center overflow-hidden bg-[#11140f] px-6 py-6 text-center sm:px-10 lg:px-14">
                          <EmbossedAIWorkspaceBackdrop studioBackground={studioBackground} />
                          <div
                            className={`relative z-10 flex max-w-[min(90%,34rem)] items-center gap-4 rounded-2xl border px-5 py-4 text-left shadow-[0_18px_55px_rgba(21,24,20,.14)] backdrop-blur-md sm:px-6 sm:py-5 ${isDarkStudioBackground(studioBackground) ? "border-white/15 bg-black/30" : "border-white/75 bg-white/58"}`}
                          >
                            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl border text-xl shadow-sm ${isDarkStudioBackground(studioBackground) ? "border-white/15 bg-white/10 text-white/90" : "border-primary-200/70 bg-primary-50/85 text-primary-800"}`} aria-hidden="true">
                              <i className="ri-sparkling-2-line" />
                            </span>
                            <h2 className={`font-heading text-xl font-medium leading-tight sm:text-2xl ${isDarkStudioBackground(studioBackground) ? "text-white/95" : "text-foreground-950"}`}>Your Design Will Appear Here</h2>
                          </div>
                        </div>
                      </div>
                    ) : stageMode === "edit" ? (
                      <div className="relative z-0 flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-hidden pt-1">
                        <ProductionViewport
                          ref={productionViewportRef}
                          zoom={zoom}
                          onZoomChange={setClampedZoom}
                          panMode={productionPanMode}
                          placingArtwork={Boolean(pendingLayer)}
                          contentClassName={activeTool === "ai" ? "max-w-[min(100%,1280px)]" : "max-w-[800px]"}
                        >
                          <JerseyStage
                            ref={stageRef}
                            sport={activeSport}
                            view={view}
                            onViewChange={setView}
                            collar={stageCollar}
                            sleeve={renderedStageSleeve}
                            colors={stageColors}
                            garmentPattern={stageGarmentPattern}
                            studioBackground={studioBackground}
                            highlightZone={hoverZone}
                            zoneModel={activeSport === "soccer" ? zoneModel : undefined}
                            zoneStyles={zoneStyles}
                            selectedZoneId={activeTool === "zones" ? selectedZoneId : null}
                            showZoneOutlines={activeTool === "zones" && showZoneOutlines}
                            correctionMode={activeTool === "zones" && correctionMode}
                            onSelectZone={(zoneId, side) => {
                              setSelectedZoneId(zoneId);
                              setView(side);
                            }}
                            onMoveZonePoint={moveZonePoint}
                            layers={stageLayers.filter((layer) => layer.source !== "ai-uniform-pattern")}
                            selectedId={selectedLayerId}
                            onSelect={selectLayer}
                            onLayerChange={(id, patch) => updateLayer(id, patch)}
                            onBackgroundClick={() => setSelectedLayerId(null)}
                            pendingLayer={pendingLayer}
                            onCommitPending={commitPendingLayer}
                          />
                        </ProductionViewport>
                        <p className="text-[11px] text-background-50/30 font-label text-center flex-shrink-0">
                          {pendingLayer
                            ? "Click the design where you want it · Esc to cancel"
                            : productionPanMode ? "Drag anywhere to pan · scroll to zoom · use Fit to reset"
                              : "Drag empty space or Alt-drag to pan · scroll to zoom · drag artwork to edit"}
                        </p>
                        {placementError && (
                          <p role="alert" className="flex-shrink-0 rounded-lg border border-amber-300/25 bg-amber-950/35 px-3 py-1.5 text-center text-[10px] font-semibold text-amber-100">
                            {placementError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0 w-full flex flex-col">
                        <Suspense
                          fallback={(
                            <div className="flex-1 flex flex-col items-center justify-center text-background-50/70">
                              <i className="ri-loader-4-line text-2xl animate-spin mb-2" />
                              <span className="text-xs font-label">Loading 3D preview…</span>
                            </div>
                          )}
                        >
                          <Product3DStage
                            productType={studioProductType}
                            color={stageColors.body}
                            colorB={showingAIUniformPreview ? stageColors.shorts : (twoTone.enabled ? twoTone.colorB : undefined)}
                            splitAt={twoTone.splitAt}
                            softness={twoTone.softness}
                            zoneColors={stageColors}
                            collar={stageCollar}
                            sleeve={renderedStageSleeve}
                            garmentPattern={stageGarmentPattern}
                            fullscreen
                            layers={stageLayers.filter((layer) => layer.source !== "ai-uniform-pattern")}
                            selectedLayerId={selectedLayerId}
                            onSelectLayer={selectLayer}
                            onPlaceLayer={placeLayer3d}
                            onRemoveLayer={removeLayer}
                            onUpdateLayer={(id, text) => updateLayer(id, { text })}
                            onRecolorLayer={(id, color) => updateLayer(id, { color })}
                            placements3d={placements3d}
                            pendingLayer={pendingLayer}
                            onCommitPending={commitPendingLayer}
                            onCaptureReady={(fn) => {
                              capture3dRef.current = fn;
                            }}
                            studioBackground={studioBackground}
                          />
                        </Suspense>
                        <p className="text-[11px] text-background-50/40 font-label text-center mt-2 flex-shrink-0">
                          {!layers.length
                            ? "Add text or a logo — it lands on the chest ready to move."
                            : "Drag the artwork to move it · scroll to resize · drag the garment to turn it"}
                        </p>
                      </div>
                    )}

                  </div>

              {/* Docked fields panel */}
              <aside className={`hidden w-full flex-shrink-0 flex-col overflow-hidden border-l border-black/10 bg-[#f7f5ef] md:flex ${(activeTool === "ai" || workflowStep.key === "category") ? "md:w-[340px] md:max-w-[340px] lg:w-[380px] lg:max-w-[380px] 2xl:w-[410px] 2xl:max-w-[410px]" : "max-w-[420px]"}`} aria-label={(activeTool === "ai" || workflowStep.key === "category") ? "AI prompt chat" : undefined}>
                {activeTool !== "ai" && workflowStep.key !== "category" && <div className={`flex-shrink-0 border-b border-black/[0.07] bg-[#f7f5ef]/95 backdrop-blur-xl ${activeTool === "design" ? "px-4 py-3" : "px-5 py-4"}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary-700">Step {workflowStep.step} · {workflowStep.label}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-medium text-foreground-950">{activeToolConfig?.label || workflowStep.label}</h2>
                  </div>
                  <p className="mt-1 text-xs text-foreground-500">{activeToolConfig?.hint || workflowStep.description}</p>
                </div>}
                <div className={`min-h-0 flex-1 ${(activeTool === "ai" || workflowStep.key === "category") ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"} ${(activeTool === "ai" || workflowStep.key === "category") ? "" : activeTool === "design" ? "p-3 pb-20" : "p-5 pb-24"}`}>
                {manualEditingAllowed && selectedLayer && <SelectedItemPanel
                  layer={selectedLayer}
                  placement={stageMode === "3d" && selectedLayerId ? placements3d[selectedLayerId] : null}
                  onTextChange={(id, text) => updateLayer(id, { text })}
                  onLayoutChange={updateTextLayout}
                  onColorChange={(id, color) => updateLayer(id, { color })}
                  onFontChange={(id, fontFamily) => updateLayer(id, { fontFamily })}
                  onStyleChange={updateLayer}
                  onGradientChange={(id, patch) => updateLayer(id, patch)}
                  onScaleChange={stageMode === "3d" ? setLayerScale : setLayerSize2d}
                  onRotateChange={stageMode === "3d" ? rotateLayer : rotateLayer2d}
                  onDuplicate={duplicateLayer}
                  onDelete={removeLayer}
                />}

                {activeTool === "zones" && (
                  <ZoneEditorPanel
                    view={view}
                    onViewChange={setView}
                    zoneModel={zoneModel}
                    selectedZoneId={selectedZoneId}
                    onSelectZone={(zoneId, side) => { setSelectedZoneId(zoneId); setView(side); }}
                    zoneStyles={zoneStyles}
                    onUpdateZoneStyle={updateZoneStyle}
                    showOutlines={showZoneOutlines}
                    onToggleOutlines={() => setShowZoneOutlines((value) => !value)}
                    correctionMode={correctionMode}
                    onToggleCorrection={() => { setCorrectionMode((value) => !value); setShowZoneOutlines(true); }}
                    onUndo={undoZoneCorrection}
                    canUndo={zoneHistory.length > 0}
                    onResetZone={resetZone}
                    onResetAll={resetAllZones}
                    sockColor={stageColors.socks}
                    onSockColorChange={(color) => updateGarmentColors((current) => ({ ...current, socks: color }))}
                  />
                )}
                {activeTool === "text" && <TextPanel onAdd={armTextPlacement} armed={pendingLayer?.type === "text"} />}
                {(activeTool === "ai" || workflowStep.key === "category") && (
                  <AIArtworkPanel
                    sport={sports.find((item) => item.slug === activeSport)?.label || "Team sport"}
                    templateName={template?.name}
                    templateDescription={template?.description}
                    templateImage={template?.image}
                    colors={colors}
                    collar={collar}
                    sleeve={sleeve}
                    collarOptions={sportConfig.collarOptions}
                    sleeveOptions={sportConfig.sleeveOptions}
                    currentPatternKey={currentAiPatternKey}
                    uniformPlan={aiUniformPlan}
                    onUniformPlanChange={handleAIUniformPlanChange}
                    onReferenceChange={(reference) => setHasUploadedReference(Boolean(reference))}
                    onModeChange={setAiDesignerMode}
                    onPlace={placeAIArtwork}
                    onApplyUniform={applyAIUniformDesign}
                    onUndoUniform={undoAIUniformDesign}
                    canUndoUniform={Boolean(aiUndoSnapshot)}
                    onGeneratingChange={handleAIGeneratingChange}
                    aiVersions={aiVersions}
                    onRestoreAIVersion={restoreAIVersion}
                    onCompareVersions={setAiComparisonPlan}
                    comparisonActive={Boolean(aiComparisonPlan)}
                    onSaveDesign={saveProgress}
                    onDownloadDesign={handleDownload}
                    onOpenBackgroundRemoval={() => setActiveTool("remove-bg")}
                    onSecurityContextChange={setDesignSecurityContext}
                    onCompleteOrder={() => openWorkflowStep(1)}
                    hasExistingArtwork={layers.some(
                      (layer) => ["text", "logo", "clipart"].includes(layer.type) && !layer.source?.startsWith("ai-uniform"),
                    )}
                  />
                )}
                {activeTool === "logo" && <LogoPanel onUpload={armLogoPlacement} armed={pendingLayer?.type === "logo"} />}
                {activeTool === "remove-bg" && <BackgroundRemovalPanel onPlace={manualEditingAllowed ? armBackgroundRemovedArtwork : undefined} />}
                {activeTool === "skins" && (
                  <SkinsPanel
                    colorA={colors.body}
                    colorB={colors.shirtStrip}
                    onAdd={armSkinPlacement}
                    onUpload={armPatternUpload}
                  />
                )}
                {activeTool === "layers" && (
                  <LayersPanel
                    layers={layers}
                    view={view}
                    selectedId={selectedLayerId}
                    onSelect={selectLayer}
                    onRemove={removeLayer}
                    onReorder={reorderLayer}
                    onApplyColourway={applyColourway}
                  />
                )}
                {activeTool === "roster" && (
                  <RosterTool
                    activeSport={activeSport}
                    minimumKits={minimumKits}
                    fitType={fitType}
                    mixedSleeves={sleeve === "Mixed"}
                    setRoster={setRoster}
                    bottomLabel={sportConfig.bottomLabel}
                    hasSocks={sportConfig.hasSocks}
                    sleeveOptions={sportConfig.sleeveOptions}
                    rosterEntry={rosterEntry}
                    setRosterEntry={setRosterEntry}
                    roster={roster}
                    addToRoster={addToRoster}
                    importRosterCsv={importRosterCsv}
                    removeFromRoster={removeFromRoster}
                    socksQuantity={socksQuantity}
                    setSocksQuantity={setSockQuantityOverride}
                    requiredSocksQuantity={requiredSocksQuantity}
                    socksQuantityValid={socksQuantityValid}
                    validationAttempted={rosterValidationAttempted}
                    fanJerseyAdded={fanJerseyAdded}
                    setFanJerseyAdded={setFanJerseyAdded}
                    supporterJerseys={supporterJerseys}
                    setSupporterJerseys={setSupporterJerseys}
                  />
                )}
                {activeTool === "review" && (
                  <ReviewOrderTool
                    template={template}
                    activeSport={activeSport}
                    collar={collar}
                    sleeve={sleeve}
                    kitType={kitType}
                    logoApplication={logoApplication}
                    layers={layers}
                    roster={roster}
                    contact={contact}
                    setContact={setContact}
                    shipping={shipping}
                    setShipping={setShipping}
                    orderPayload={buildUniformPayload(null)}
                    capturePreview={capturePreview}
                    unitPrice={unitPrice}
                    fanJerseyAdded={fanJerseyAdded}
                    supporterJerseys={supporterJerseys}
                    onRequestQuote={handleRequestQuote}
                    submitting={submittingQuote}
                    error={quoteError}
                    onEditStep={(tool) => setActiveTool(tool)}
                    onView3d={ENABLE_3D ? () => setStageMode("3d") : undefined}
                  />
                )}
                </div>
              </aside>
      </div>

      {/* Mobile: the fields panel docks to the bottom instead of the side */}
      <div className={`md:hidden flex-shrink-0 overflow-y-auto overscroll-contain border-t border-background-200/60 bg-background-50 ${(activeTool === "ai" || workflowStep.key === "category") ? "max-h-[72dvh] p-0" : "max-h-[42dvh] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"}`} aria-label={(activeTool === "ai" || workflowStep.key === "category") ? "AI prompt chat" : undefined}>
        {manualEditingAllowed && <SelectedItemPanel
          layer={selectedLayer}
          placement={stageMode === "3d" && selectedLayerId ? placements3d[selectedLayerId] : null}
          onTextChange={(id, text) => updateLayer(id, { text })}
          onLayoutChange={updateTextLayout}
          onColorChange={(id, color) => updateLayer(id, { color })}
          onFontChange={(id, fontFamily) => updateLayer(id, { fontFamily })}
          onStyleChange={updateLayer}
          onGradientChange={(id, patch) => updateLayer(id, patch)}
          onScaleChange={stageMode === "3d" ? setLayerScale : setLayerSize2d}
          onRotateChange={stageMode === "3d" ? rotateLayer : rotateLayer2d}
          onDuplicate={duplicateLayer}
          onDelete={removeLayer}
        />}

        {activeTool === "zones" && (
          <ZoneEditorPanel
            view={view}
            onViewChange={setView}
            zoneModel={zoneModel}
            selectedZoneId={selectedZoneId}
            onSelectZone={(zoneId, side) => { setSelectedZoneId(zoneId); setView(side); }}
            zoneStyles={zoneStyles}
            onUpdateZoneStyle={updateZoneStyle}
            showOutlines={showZoneOutlines}
            onToggleOutlines={() => setShowZoneOutlines((value) => !value)}
            correctionMode={correctionMode}
            onToggleCorrection={() => { setCorrectionMode((value) => !value); setShowZoneOutlines(true); }}
            onUndo={undoZoneCorrection}
            canUndo={zoneHistory.length > 0}
            onResetZone={resetZone}
            onResetAll={resetAllZones}
            sockColor={stageColors.socks}
            onSockColorChange={(color) => updateGarmentColors((current) => ({ ...current, socks: color }))}
          />
        )}
        {activeTool === "text" && <TextPanel onAdd={armTextPlacement} armed={pendingLayer?.type === "text"} />}
        {(activeTool === "ai" || workflowStep.key === "category") && (
          <AIArtworkPanel
            sport={sports.find((item) => item.slug === activeSport)?.label || "Team sport"}
            templateName={template?.name}
            templateDescription={template?.description}
            templateImage={template?.image}
            colors={colors}
            collar={collar}
            sleeve={sleeve}
            collarOptions={sportConfig.collarOptions}
            sleeveOptions={sportConfig.sleeveOptions}
            currentPatternKey={currentAiPatternKey}
            uniformPlan={aiUniformPlan}
            onUniformPlanChange={handleAIUniformPlanChange}
            onReferenceChange={(reference) => setHasUploadedReference(Boolean(reference))}
            onModeChange={setAiDesignerMode}
            onPlace={placeAIArtwork}
            onApplyUniform={applyAIUniformDesign}
            onUndoUniform={undoAIUniformDesign}
            canUndoUniform={Boolean(aiUndoSnapshot)}
            onGeneratingChange={handleAIGeneratingChange}
            aiVersions={aiVersions}
            onRestoreAIVersion={restoreAIVersion}
            onCompareVersions={setAiComparisonPlan}
            comparisonActive={Boolean(aiComparisonPlan)}
            onSaveDesign={saveProgress}
            onDownloadDesign={handleDownload}
            onOpenBackgroundRemoval={() => setActiveTool("remove-bg")}
            onSecurityContextChange={setDesignSecurityContext}
            onCompleteOrder={() => openWorkflowStep(1)}
            hasExistingArtwork={layers.some(
              (layer) => ["text", "logo", "clipart"].includes(layer.type) && !layer.source?.startsWith("ai-uniform"),
            )}
          />
        )}
        {activeTool === "logo" && <LogoPanel onUpload={armLogoPlacement} armed={pendingLayer?.type === "logo"} />}
        {activeTool === "remove-bg" && <BackgroundRemovalPanel onPlace={manualEditingAllowed ? armBackgroundRemovedArtwork : undefined} />}
        {activeTool === "skins" && (
          <SkinsPanel
            colorA={colors.body}
            colorB={colors.shirtStrip}
            onAdd={armSkinPlacement}
            onUpload={armPatternUpload}
          />
        )}
        {activeTool === "layers" && (
          <LayersPanel
            layers={layers}
            view={view}
            selectedId={selectedLayerId}
            onSelect={selectLayer}
            onRemove={removeLayer}
            onReorder={reorderLayer}
            onApplyColourway={applyColourway}
          />
        )}
        {activeTool === "roster" && (
          <RosterTool
            activeSport={activeSport}
            minimumKits={minimumKits}
            fitType={fitType}
            mixedSleeves={sleeve === "Mixed"}
            setRoster={setRoster}
            bottomLabel={sportConfig.bottomLabel}
            hasSocks={sportConfig.hasSocks}
            sleeveOptions={sportConfig.sleeveOptions}
            rosterEntry={rosterEntry}
            setRosterEntry={setRosterEntry}
            roster={roster}
            addToRoster={addToRoster}
            importRosterCsv={importRosterCsv}
            removeFromRoster={removeFromRoster}
            socksQuantity={socksQuantity}
            setSocksQuantity={setSockQuantityOverride}
            requiredSocksQuantity={requiredSocksQuantity}
            socksQuantityValid={socksQuantityValid}
            validationAttempted={rosterValidationAttempted}
            fanJerseyAdded={fanJerseyAdded}
            setFanJerseyAdded={setFanJerseyAdded}
            supporterJerseys={supporterJerseys}
            setSupporterJerseys={setSupporterJerseys}
          />
        )}
        {activeTool === "review" && (
          <ReviewOrderTool
            template={template}
            activeSport={activeSport}
            collar={collar}
            sleeve={sleeve}
            kitType={kitType}
            logoApplication={logoApplication}
            layers={layers}
            roster={roster}
            contact={contact}
            setContact={setContact}
            shipping={shipping}
            setShipping={setShipping}
            orderPayload={buildUniformPayload(null)}
            capturePreview={capturePreview}
            unitPrice={unitPrice}
            fanJerseyAdded={fanJerseyAdded}
            supporterJerseys={supporterJerseys}
            onRequestQuote={handleRequestQuote}
            submitting={submittingQuote}
            error={quoteError}
            onEditStep={(tool) => setActiveTool(tool)}
            onView3d={ENABLE_3D ? () => setStageMode("3d") : undefined}
          />
        )}
      </div>

      <div className={`flex flex-shrink-0 items-center gap-3 border-t border-white/[0.07] bg-[#0c0d0b]/95 px-4 py-2.5 pb-[max(.625rem,env(safe-area-inset-bottom))] sm:px-6 ${workflowStep.key === "design" ? "justify-center" : "justify-between"}`}>
        {workflowStep.key !== "design" && <button
          type="button"
          onClick={backWorkflow}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-background-50/65 transition hover:bg-white/[0.06] hover:text-background-50 cursor-pointer"
        >
          <i className="ri-arrow-left-line" />
          {studioWorkflow[workflowIndex - 1].label}
        </button>}
        <div className="hidden text-center md:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-background-50/35">
            Step {workflowStep.step} of {studioWorkflow.length}
          </p>
          <p className="text-xs font-semibold text-background-50/65">{workflowStep.label}</p>
        </div>
        {workflowStep.key === "design" ? null : workflowIndex < studioWorkflow.length - 1 ? (
          <button
            type="button"
            onClick={continueWorkflow}
            title={studioWorkflow[workflowIndex + 1].step > 1 ? designContinueTitle : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,116,73,0.22)] transition hover:bg-primary-500 cursor-pointer"
          >
            Continue to {studioWorkflow[workflowIndex + 1].label}
            <i className="ri-arrow-right-line" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-background-50/60">
            <i className="ri-shield-check-line text-primary-400" /> Secure order request
          </span>
        )}
      </div>
    </div>
  );
}

function SupporterJerseySelector({
  activeSport,
  fanJerseyAdded,
  setFanJerseyAdded,
  supporterJerseys,
  setSupporterJerseys,
}) {
  const categoryPricing = uniformPricingFor(activeSport);
  const supporterCount = fanJerseyAdded ? supporterJerseyCount(supporterJerseys) : 0;
  const supporterTotal = supporterCount * categoryPricing.shirtPrice;

  return (
    <section className="mb-4 rounded-xl border border-background-300 bg-background-100/55 p-3.5" aria-labelledby="supporter-jerseys-heading">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 rounded border-background-300"
          checked={fanJerseyAdded}
          onChange={(event) => setFanJerseyAdded(event.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span id="supporter-jerseys-heading" className="text-sm font-semibold text-foreground-900">Add Fan/Supporter Jerseys</span>
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-800">
              {categoryPricing.shirtLabel} · ${categoryPricing.shirtPrice.toFixed(2)} each
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] font-label text-foreground-500">
            Same team design without player numbers. Price shown in Step 2.
          </span>
        </span>
      </label>

      {fanJerseyAdded && (
        <div className="mt-3 border-t border-background-300/80 pt-3">
          <div className="space-y-2">
            {supporterJerseys.map((jersey, index) => (
              <div key={`${jersey.size}-${index}`} className="grid grid-cols-[1fr_88px_32px] items-center gap-2">
                <Select
                  aria-label={`Supporter jersey size ${index + 1}`}
                  value={jersey.size}
                  onChange={(event) => setSupporterJerseys((current) => current.map((row, rowIndex) => (
                    rowIndex === index ? { ...row, size: event.target.value } : row
                  )))}
                >
                  {shirtSizeOptions.map((size) => (
                    <option
                      key={size}
                      value={size}
                      disabled={supporterJerseys.some((row, rowIndex) => rowIndex !== index && row.size === size)}
                    >
                      Size {size}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  aria-label={`Supporter jersey quantity ${index + 1}`}
                  value={jersey.quantity}
                  onChange={(event) => setSupporterJerseys((current) => current.map((row, rowIndex) => (
                    rowIndex === index ? { ...row, quantity: event.target.value } : row
                  )))}
                />
                <button
                  type="button"
                  aria-label={`Remove supporter jersey size ${jersey.size}`}
                  disabled={supporterJerseys.length === 1}
                  onClick={() => setSupporterJerseys((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-foreground-400 transition hover:bg-accent-50 hover:text-accent-600 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            ))}
          </div>
          {supporterJerseys.length < shirtSizeOptions.length && (
            <button
              type="button"
              onClick={() => {
                const nextSize = shirtSizeOptions.find((size) => !supporterJerseys.some((row) => row.size === size));
                setSupporterJerseys((current) => [...current, { size: nextSize || "M", quantity: 1 }]);
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 hover:text-primary-900"
            >
              <i className="ri-add-line" /> Add another size
            </button>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-background-300/80 pt-3 text-xs font-semibold text-foreground-800">
            <span>{supporterCount} supporter jersey{supporterCount === 1 ? "" : "s"}</span>
            <span>${supporterTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function RosterTool({
  activeSport = "soccer",
  minimumKits = 1,
  fitType = "",
  mixedSleeves = false,
  setRoster,
  bottomLabel = "Shorts",
  hasSocks = false,
  sleeveOptions = [],
  rosterEntry,
  setRosterEntry,
  roster,
  addToRoster,
  importRosterCsv,
  removeFromRoster,
  socksQuantity = 0,
  setSocksQuantity,
  requiredSocksQuantity = 0,
  socksQuantityValid = true,
  validationAttempted = false,
  fanJerseyAdded,
  setFanJerseyAdded,
  supporterJerseys,
  setSupporterJerseys,
}) {
  const unitCount = rosterUnitCount(roster);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [rosterError, setRosterError] = useState("");
  const rosterFileRef = useRef(null);

  const handleAddPlayer = () => {
    if (!rosterEntry.name.trim()) {
      setRosterError("Enter the player's name before adding this roster row.");
      return;
    }
    addToRoster();
    setRosterError("");
  };

  const handleRosterFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const count = importRosterCsv(await file.text());
      setImportMessage(`${count} player${count === 1 ? "" : "s"} imported.`);
    } catch (err) {
      setImportMessage(err.message || "That roster could not be imported.");
    } finally {
      event.target.value = "";
    }
  };

  const downloadRosterTemplate = () => {
    const headers = [
      "Name",
      "Jersey Number",
      "Shirt Size",
      `${bottomLabel} Size`,
      "Sleeve Preference",
      "Quantity",
      "Notes",
    ];
    const example = ["Alex James", "10", "M", "M", "Short", "1", "Captain"];
    const blob = new Blob([[headers, example].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "connect767-team-roster-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2 text-[11px] font-label text-primary-800">
        <span className="font-semibold capitalize">Fit type: {fitType}</span>
        <span>Sizes follow the Step 2 fit selection</span>
      </div>

      <div id="roster-minimum-status" role="status" className={`mb-4 rounded-xl border px-3 py-2.5 ${unitCount >= minimumKits ? "border-primary-200 bg-primary-50" : validationAttempted ? "border-accent-400 bg-accent-50 ring-2 ring-accent-200" : "border-background-300 bg-background-100/60"}`}>
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${unitCount >= minimumKits ? "bg-primary-600 text-white" : "bg-background-200 text-foreground-400"}`}>
            <i className={unitCount >= minimumKits ? "ri-check-line" : "ri-team-line"} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground-900">
              {minimumKits} full-kit minimum · {unitCount} added
            </p>
            <p className="text-[10px] font-label text-foreground-500">
              {unitCount >= minimumKits ? "Minimum met. Continue to Review & Quote to confirm your order." : `Add ${minimumKits - unitCount} more full kit${minimumKits - unitCount === 1 ? "" : "s"}. Extra shirts do not count.`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">
          Team Roster <RequiredIndicator />
        </h3>
        <button
          type="button"
          onClick={() => setShowSizeGuide((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
        >
          <i className="ri-ruler-2-line" />
          Size guide
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <input
          ref={rosterFileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleRosterFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon="ri-file-upload-line"
          iconPosition="left"
          onClick={() => rosterFileRef.current?.click()}
          className="w-full min-w-0"
        >
          Import CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon="ri-download-line"
          iconPosition="left"
          onClick={downloadRosterTemplate}
          className="w-full min-w-0 border-accent-400 bg-accent-50 font-bold text-accent-700 hover:border-accent-500 hover:bg-accent-100"
        >
          Download CSV Template
        </Button>
      </div>
      {importMessage && (
        <p className="text-[11px] font-label text-primary-700 mb-4" role="status">
          {importMessage}
        </p>
      )}

      {showSizeGuide && (
        <div className="mb-4 overflow-x-auto rounded-xl border border-background-200/70">
          <table className="w-full min-w-[30rem] text-xs font-label">
            <thead>
              <tr className="bg-background-100/70 text-foreground-500">
                <th className="text-left px-3 py-2 font-semibold">Size</th>
                <th className="text-left px-3 py-2 font-semibold">Chest (in)</th>
                <th className="text-left px-3 py-2 font-semibold">Waist (in)</th>
                <th className="text-left px-3 py-2 font-semibold">Height (in)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["XS", "32–34", "26–28", "62–65"],
                ["S", "35–37", "29–31", "65–68"],
                ["M", "38–40", "32–34", "68–70"],
                ["L", "41–43", "35–37", "70–72"],
                ["XL", "44–46", "38–40", "72–74"],
                ["2XL", "47–50", "41–44", "74–76"],
                ["3XL", "51–54", "45–48", "76–78"],
              ].map((row, i) => (
                <tr key={row[0]} className={i % 2 ? "bg-background-50" : "bg-background-100/30"}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 text-foreground-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div id="roster-entry-form" data-validation-highlight={validationAttempted && unitCount < minimumKits ? "true" : undefined} className={`mb-4 space-y-3 rounded-xl border transition ${validationAttempted && unitCount < minimumKits ? "border-accent-400 bg-accent-50/60 p-3 ring-2 ring-accent-200" : "border-transparent p-0"}`}>
        {validationAttempted && unitCount < minimumKits && (
          <p role="alert" className="text-[11px] font-semibold text-accent-800">
            {rosterEntry.name.trim()
              ? "Click Add player to include this row in the team total."
              : `Add player details until the ${minimumKits}-kit minimum is reached.`}
          </p>
        )}
        <Input
          placeholder="Name"
          aria-label="Name"
          error={Boolean(rosterError) || (validationAttempted && unitCount < minimumKits && !rosterEntry.name.trim())}
          aria-invalid={Boolean(rosterError) || (validationAttempted && unitCount < minimumKits && !rosterEntry.name.trim())}
          aria-describedby={rosterError ? "roster-name-error" : undefined}
          required
          value={rosterEntry.name}
          onChange={(e) => {
            setRosterEntry((r) => ({ ...r, name: e.target.value }));
            if (e.target.value.trim()) setRosterError("");
          }}
        />
        {rosterError && (
          <p id="roster-name-error" role="alert" className="-mt-1 text-[11px] font-label text-accent-700">
            {rosterError}
          </p>
        )}
        <Input
          placeholder="Jersey #"
          aria-label="Jersey number"
          value={rosterEntry.number}
          onChange={(e) => setRosterEntry((r) => ({ ...r, number: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">Shirt Size</span>
            <Select
              aria-label="Shirt Size"
              value={rosterEntry.shirtSize}
              onChange={(e) => setRosterEntry((r) => ({ ...r, shirtSize: e.target.value }))}
            >
              {shirtSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">
              {bottomLabel === "Shorts" ? "Short Size" : `${bottomLabel} Size`}
            </span>
            <Select
              aria-label={bottomLabel === "Shorts" ? "Short Size" : `${bottomLabel} Size`}
              value={rosterEntry.shortSize}
              onChange={(e) => setRosterEntry((r) => ({ ...r, shortSize: e.target.value }))}
            >
              {shortSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <span className="text-[11px] font-label text-foreground-500 block mb-1">Quantity</span>
          <Input
            type="number"
            aria-label="Player quantity"
            min="1"
            max="99"
            value={rosterEntry.quantity}
            onChange={(e) => setRosterEntry((r) => ({ ...r, quantity: e.target.value }))}
          />
        </div>
        {mixedSleeves && sleeveOptions?.length > 0 && (
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">
              Player sleeve length
            </span>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Sleeve length"
                value={rosterEntry.sleevePreference}
                onChange={(e) => setRosterEntry((r) => ({ ...r, sleevePreference: e.target.value }))}
              >
                <option value="Short">Short — included</option>
                <option value="Long">Long</option>
              </Select>
              {rosterEntry.sleevePreference === "Long" && (
                <span className="shrink-0 rounded-full bg-accent-50 px-2.5 py-1 text-[10px] font-bold text-accent-700">
                  +${ADD_ON_PRICES.sleeveLong.toFixed(2)} per kit
                </span>
              )}
            </div>
          </div>
        )}
        <Textarea
          rows={2}
          placeholder="Player notes (optional)"
          aria-label="Player notes"
          value={rosterEntry.notes}
          onChange={(e) => setRosterEntry((r) => ({ ...r, notes: e.target.value }))}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={handleAddPlayer}
        icon="ri-add-line"
        iconPosition="left"
        className="w-full mb-4"
      >
        Add player
      </Button>

      {roster.length > 0 && (
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {roster.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-xs bg-background-100/60 rounded-lg px-3 py-2 border border-background-200/70"
            >
              <span className="text-foreground-800">
                <span className="font-semibold">{entry.name}</span>{" "}
                {entry.number && <span className="text-foreground-500">#{entry.number}</span>}{" "}
                <span className="text-foreground-400 font-label">
                  · shirt {entry.shirtSize} / {bottomLabel.toLowerCase()} {entry.shortSize}
                </span>
                {entry.quantity > 1 && (
                  <span className="text-primary-700 font-semibold"> · qty {entry.quantity}</span>
                )}
                {mixedSleeves && entry.sleevePreference && (
                  <span className="block text-foreground-400 font-label mt-0.5">
                    {entry.sleevePreference} sleeve
                  </span>
                )}
              </span>
              {mixedSleeves && <div className="mx-2 flex min-w-0 items-center gap-1.5">
                <select aria-label={`Sleeve length for ${entry.name}`} value={entry.sleevePreference === "Long" ? "Long" : "Short"} onChange={(event) => setRoster((current) => current.map((row) => row.id === entry.id ? { ...row, sleevePreference: event.target.value } : row))} className="min-w-0 rounded border border-background-300 bg-background-50 p-2 text-xs text-foreground-900">
                  <option value="Short">Short — included</option>
                  <option value="Long">Long</option>
                </select>
                {entry.sleevePreference === "Long" && <span className="shrink-0 rounded-full bg-accent-50 px-2 py-1 text-[9px] font-bold text-accent-700">+${ADD_ON_PRICES.sleeveLong.toFixed(2)}/kit</span>}
              </div>}
              <button
                type="button"
                onClick={() => removeFromRoster(entry.id)}
                aria-label={`Remove ${entry.name}`}
                className="text-foreground-400 hover:text-accent-500 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasSocks && (
        <div className={`mb-4 rounded-xl border px-4 py-3 ${socksQuantityValid ? "border-background-200/70 bg-background-100/50" : "border-accent-300 bg-accent-50"}`}>
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground-900">Socks <RequiredIndicator /></span>
              <span className="block text-[10px] font-label text-foreground-500">One per full kit · required quantity {requiredSocksQuantity}</span>
            </span>
            <label className="flex items-center gap-2 text-xs font-label text-foreground-500">
              Qnty
              <Input
                type="number"
                min={requiredSocksQuantity}
                max={requiredSocksQuantity}
                required
                aria-label="Socks quantity"
                aria-invalid={!socksQuantityValid}
                aria-describedby={!socksQuantityValid ? "socks-quantity-warning" : undefined}
                value={socksQuantity}
                onChange={(event) => setSocksQuantity?.(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
                className="w-24"
              />
            </label>
          </div>
          {!socksQuantityValid && (
            <p id="socks-quantity-warning" role="alert" className="mt-2 text-[11px] font-semibold text-accent-800">
              Socks quantity must be {requiredSocksQuantity} to match the full-kit order.
            </p>
          )}
        </div>
      )}

      <SupporterJerseySelector
        activeSport={activeSport}
        fanJerseyAdded={fanJerseyAdded}
        setFanJerseyAdded={setFanJerseyAdded}
        supporterJerseys={supporterJerseys}
        setSupporterJerseys={setSupporterJerseys}
      />

    </div>
  );
}

function ReviewOrderTool({
  template,
  activeSport,
  collar,
  sleeve,
  kitType,
  logoApplication,
  layers,
  roster,
  contact,
  setContact,
  shipping,
  setShipping,
  orderPayload,
  capturePreview,
  unitPrice,
  fanJerseyAdded,
  supporterJerseys,
  onRequestQuote,
  submitting,
  error,
  onEditStep,
  onView3d,
}) {
  const categoryPricing = uniformPricingFor(activeSport);
  const unitCount = rosterUnitCount(roster);
  const sleeveSurcharge = mixedSleeveSurcharge(sleeve, roster);
  const minimumKits = minimumFullKitsFor(activeSport);
  const minimumKitsMet = unitCount >= minimumKits;
  const kitAddOns = kitAddOnBreakdown({
    sleeve,
    collar,
    insideCollarMessage: orderPayload.insideCollarMessage,
    logoApplication,
    unitCount,
    roster,
  });
  const kitAddOnsTotal = kitAddOns.reduce((total, item) => total + item.total, 0);
  const baseKitsTotal = categoryPricing.fullPrice * unitCount;
  const kitsTotal = baseKitsTotal + kitAddOnsTotal;
  const supporterCount = fanJerseyAdded ? supporterJerseyCount(supporterJerseys) : 0;
  const supporterTotal = supporterCount * categoryPricing.shirtPrice;
  const extraShirtCount = extraTeamShirtCount(orderPayload.extraTeamShirts || []);
  const extraShirtTotal = extraShirtCount * categoryPricing.shirtPrice;
  const extraShirtsKey = JSON.stringify(orderPayload.extraTeamShirts || []);
  const grandTotal = kitsTotal + supporterTotal + extraShirtTotal;
  const shippingUnitCount = unitCount + extraShirtCount + supporterCount;
  const selectedShippingRate = uniformShippingRate(shipping.country, shippingUnitCount);
  const sportLabel = sports.find((sport) => sport.slug === activeSport)?.label || activeSport;
  const [config, setConfig] = useState(null);
  const [totals, setTotals] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [addressValidationAttempted, setAddressValidationAttempted] = useState(false);
  const [useDifferentOrderContact, setUseDifferentOrderContact] = useState(false);
  const [quoteContactRequested, setQuoteContactRequested] = useState(false);
  const [cardSession, setCardSession] = useState(null);
  const [startingCard, setStartingCard] = useState(false);
  const [placingLocalOrder, setPlacingLocalOrder] = useState(false);
  const shippingContact = {
    name: `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim(),
    email: shipping.email || "",
    phone: shipping.phone || "",
    club: shipping.company || "",
    notes: "",
  };
  const showOrderContact = useDifferentOrderContact || quoteContactRequested;
  const checkoutContact = showOrderContact ? contact : shippingContact;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(checkoutContact.email.trim());
  const contactNameValid = checkoutContact.name.trim().length > 1;
  const addressValidation = validateUniformShippingAddress(shipping);
  const addressRegions = uniformAddressRegions(shipping.country);
  const shippingComplete = Boolean(selectedShippingRate && addressValidation.valid);
  const canCheckout = minimumKitsMet && contactNameValid && emailValid && shippingComplete && (!fanJerseyAdded || supporterCount > 0);
  const canCalculate = minimumKitsMet && (!fanJerseyAdded || supporterCount > 0);

  useEffect(() => {
    getCheckoutConfig()
      .then(setConfig)
      .catch(() => setConfig({ stripeEnabled: false, paypalEnabled: false }));
  }, []);

  useEffect(() => {
    setTotals(null);
    setCardSession(null);
  }, [fanJerseyAdded, supporterJerseys, unitCount, unitPrice, sleeveSurcharge, roster, extraShirtsKey]);

  useEffect(() => {
    if (!import.meta.env.DEV || !window.location.search.includes("preview=checkout") || !canCheckout || totals) return;
    setCalculating(true);
    quoteUniformCheckout({ ...orderPayload, contact: checkoutContact, fanJerseyAdded, supporterJerseys, grandTotal }, checkoutContact.email, shipping)
      .then(setTotals)
      .catch((err) => setCheckoutError(err.message || "Couldn't calculate the preview total."))
      .finally(() => setCalculating(false));
  }, [canCheckout, totals]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateShipping = (field) => (event) => {
    const value = event.target.value;
    setShipping((current) => field === "country"
      ? { ...current, country: value, state: "", postcode: "" }
      : { ...current, [field]: value });
    setTotals(null);
    setCardSession(null);
  };

  const completeOrderPayload = async () => ({
    ...orderPayload,
    fanJerseyAdded,
    supporterJerseys: fanJerseyAdded ? supporterJerseys : [],
    contact: checkoutContact,
    grandTotal,
    previewImage: await capturePreview(),
  });

  const calculateTotal = async () => {
    setAddressValidationAttempted(true);
    if (!minimumKitsMet || !contactNameValid || !emailValid || (fanJerseyAdded && supporterCount < 1) || !shippingComplete) {
      setCheckoutError(!minimumKitsMet
        ? `Minimum order: ${minimumKits} full kits.`
        : !contactNameValid
          ? "Enter the order contact name."
          : !emailValid
            ? "Enter a valid contact email address."
          : fanJerseyAdded && supporterCount < 1
            ? "Add at least one supporter jersey or remove that option."
            : addressValidation.message || "Complete the shipping address first.");
      return;
    }
    setCalculating(true);
    setCheckoutError(null);
    try {
      setTotals(await quoteUniformCheckout({ ...orderPayload, contact: checkoutContact, fanJerseyAdded, supporterJerseys, grandTotal }, checkoutContact.email, shipping));
    } catch (err) {
      setCheckoutError(err.message || "Couldn't calculate tax and shipping.");
    } finally {
      setCalculating(false);
    }
  };

  const startCardPayment = async () => {
    if (!totals || !canCheckout) return;
    setStartingCard(true);
    setCheckoutError(null);
    try {
      setCardSession(await createUniformPaymentIntent(await completeOrderPayload(), checkoutContact.email, shipping));
    } catch (err) {
      setCheckoutError(err.message || "Couldn't start card payment.");
    } finally {
      setStartingCard(false);
    }
  };

  const placeLocalDominicaOrder = async () => {
    if (!totals || !canCheckout || shipping.country !== "DM") return;
    setPlacingLocalOrder(true);
    setCheckoutError(null);
    try {
      const result = await createUniformLocalDominicaOrder(
        await completeOrderPayload(),
        checkoutContact.email,
        shipping,
      );
      window.location.assign(`/checkout/thank-you?order=${result.orderId}&payment=local-dominica`);
    } catch (err) {
      setCheckoutError(err.message || "Couldn't reserve this order for local payment.");
      setPlacingLocalOrder(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">
          Final step
        </p>
        <h2 className="mt-1 font-heading text-2xl font-semibold text-foreground-950">
          Review your team order
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-foreground-500">
          Confirm the design and roster, calculate delivery and tax, then pay securely to place the order.
        </p>
        <p role="status" className="mt-2 text-xs font-semibold text-primary-700">
          {sportLabel}: minimum {minimumKits} full kits. {minimumKitsMet ? "Minimum met." : `Add ${minimumKits - unitCount} more to continue.`} Extra shirts do not count.
        </p>
        {onView3d && (
          <button
            type="button"
            onClick={onView3d}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary-300 bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-800 transition hover:-translate-y-0.5 hover:border-primary-500 hover:bg-primary-100 cursor-pointer"
          >
            <i className="ri-3d-cube-sphere-line text-sm" />
            View uniform design in 3D
          </button>
        )}
        {collar === "Polo" && (
          <div role="note" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950">
            <i className="ri-information-line mt-0.5 text-sm" aria-hidden="true" />
            <span>This design uses a polo-style collar. The ${ADD_ON_PRICES.collarPolo.toFixed(2)} per-kit collar charge is included automatically.</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <ReviewRow
          icon="ri-palette-line"
          title="Design"
          value={`${sportLabel} · ${template?.name || "Blank Canvas"}`}
          meta={`${collar} collar · ${sleeve} sleeve · ${layers.length} artwork layer${layers.length === 1 ? "" : "s"}`}
          onEdit={() => onEditStep("design")}
        />
        <ReviewRow
          icon="ri-settings-4-line"
          title="Fit & production"
          value={`${categoryPricing.fullLabel}${extraShirtCount ? ` + ${extraShirtCount} extra top${extraShirtCount === 1 ? "" : "s"}` : ""} · ${logoApplication}`}
          meta={`Base price $${categoryPricing.fullPrice.toFixed(2)}${kitAddOns.length ? " · Add-ons itemized below" : ""}`}
          onEdit={() => onEditStep("design")}
        />
        <ReviewRow
          icon="ri-team-line"
          title="Roster"
          value={`${unitCount} kit${unitCount === 1 ? "" : "s"} · ${roster.length} player row${roster.length === 1 ? "" : "s"}`}
          meta={`${roster.length ? roster.slice(0, 3).map((entry) => entry.name).join(", ") + (roster.length > 3 ? "…" : "") : "No players added"}${sportConfigFor(activeSport).hasSocks ? ` · ${orderPayload.socksQuantity ?? 0} socks` : ""}`}
          onEdit={() => onEditStep("roster")}
        />
      </div>

      <div className="mb-5 rounded-2xl bg-primary-950 p-4 text-background-50 shadow-[0_14px_30px_rgba(0,48,30,0.2)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-background-50/55">
              Full order total
            </p>
            <p className="mt-1 font-heading text-3xl font-semibold">
              {totals ? `${totals.currency} $${totals.total.toFixed(2)}` : "Calculate below"}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-background-50/75">
            {totals ? "Ready to pay" : "Tax + shipping pending"}
          </span>
        </div>
        <div className="mt-3 space-y-1 border-t border-white/15 pt-3 text-xs text-background-50/70">
          <div className="flex justify-between"><span>{unitCount} {categoryPricing.checkoutLabel} × ${categoryPricing.fullPrice.toFixed(2)}</span><span>${baseKitsTotal.toFixed(2)}</span></div>
          {kitAddOns.map((item) => (
            <div key={item.key} className="flex justify-between gap-3">
              <span>{item.label} · {item.count} × ${item.unitPrice.toFixed(2)}</span>
              <span>${item.total.toFixed(2)}</span>
            </div>
          ))}
          {extraShirtCount > 0 && <div className="flex justify-between"><span>{extraShirtCount} extra top{extraShirtCount === 1 ? "" : "s"} × ${categoryPricing.shirtPrice.toFixed(2)}</span><span>${extraShirtTotal.toFixed(2)}</span></div>}
          {fanJerseyAdded && <div className="flex justify-between"><span>{supporterCount} supporter jersey{supporterCount === 1 ? "" : "s"} × ${categoryPricing.shirtPrice.toFixed(2)}</span><span>${supporterTotal.toFixed(2)}</span></div>}
          <div className="flex justify-between"><span>Subtotal</span><span>${(totals?.subtotal ?? grandTotal).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{totals ? `$${totals.tax.toFixed(2)}` : "—"}</span></div>
          <div className="flex justify-between"><span>{totals?.shippingLabel || "Shipping"}</span><span>{totals ? `$${totals.shipping.toFixed(2)}` : "—"}</span></div>
          {totals?.designerFee > 0 && (
            <div className="flex justify-between gap-3 text-background-50/90">
              <span>
                <span className="block font-semibold">{totals.designerFeeLabel || "Connect767 Design Fee"}</span>
                <span className="block text-[10px] font-normal text-background-50/55">Applies when subtotal + shipping is under $1,500.</span>
              </span>
              <span>${totals.designerFee.toFixed(2)}</span>
            </div>
          )}
          {totals && <div className="mt-2 flex justify-between border-t border-white/15 pt-2 text-sm font-bold"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>}
        </div>
        <p className="mt-3 flex items-center gap-2 border-t border-white/15 pt-3 text-[11px] font-semibold text-background-50/80">
          <i className="ri-information-line text-sm" aria-hidden="true" />
          Custom design uniforms are non-refundable.
        </p>
      </div>

      <div className="border-t border-background-200 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground-900">Shipping Address <RequiredIndicator /></h3>
        <p className="mb-3 mt-1 text-[11px] font-label text-foreground-500">Custom-uniform shipping is calculated from this address and {shippingUnitCount} total order unit{shippingUnitCount === 1 ? "" : "s"}.</p>
        <div className="grid grid-cols-2 gap-2">
          <Input error={addressValidationAttempted && addressValidation.errors.firstName} aria-invalid={addressValidationAttempted && Boolean(addressValidation.errors.firstName)} placeholder="First name *" aria-label="Shipping first name" autoComplete="given-name" value={shipping.firstName} onChange={updateShipping("firstName")} />
          <Input error={addressValidationAttempted && addressValidation.errors.lastName} aria-invalid={addressValidationAttempted && Boolean(addressValidation.errors.lastName)} placeholder="Last name *" aria-label="Shipping last name" autoComplete="family-name" value={shipping.lastName} onChange={updateShipping("lastName")} />
          <Input className="col-span-2" type="email" error={addressValidationAttempted && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(shipping.email || "").trim())} aria-invalid={addressValidationAttempted && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(shipping.email || "").trim())} placeholder="Email address *" aria-label="Shipping email address" autoComplete="email" value={shipping.email || ""} onChange={updateShipping("email")} />
          <Input className="col-span-2" placeholder="Phone number" aria-label="Shipping phone number" autoComplete="tel" value={shipping.phone || ""} onChange={updateShipping("phone")} />
          <Input className="col-span-2" placeholder="Company (optional)" aria-label="Shipping company" autoComplete="organization" value={shipping.company} onChange={updateShipping("company")} />
          <Input error={addressValidationAttempted && addressValidation.errors.address1} aria-invalid={addressValidationAttempted && Boolean(addressValidation.errors.address1)} className="col-span-2" placeholder="Street address *" aria-label="Shipping street address" autoComplete="address-line1" value={shipping.address1} onChange={updateShipping("address1")} />
          <Input className="col-span-2" placeholder="Apartment, suite or unit" aria-label="Shipping address line two" autoComplete="address-line2" value={shipping.address2} onChange={updateShipping("address2")} />
          <Input error={addressValidationAttempted && addressValidation.errors.city} aria-invalid={addressValidationAttempted && Boolean(addressValidation.errors.city)} placeholder="City *" aria-label="Shipping city" autoComplete="address-level2" value={shipping.city} onChange={updateShipping("city")} />
          {addressRegions.length ? (
            <Select error={addressValidationAttempted && addressValidation.errors.state} aria-invalid={addressValidationAttempted && Boolean(addressValidation.errors.state)} aria-label="Shipping region" autoComplete="address-level1" value={shipping.state} onChange={updateShipping("state")}>
              <option value="">{shipping.country === "CA" ? "Province / territory *" : "State *"}</option>
              {addressRegions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </Select>
          ) : (
            <Input placeholder="Region / parish" aria-label="Shipping region" autoComplete="address-level1" value={shipping.state} onChange={updateShipping("state")} />
          )}
          <Input error={addressValidationAttempted && addressValidation.errors.postcode} aria-invalid={addressValidationAttempted && Boolean(addressValidation.errors.postcode)} placeholder={shipping.country === "US" ? "ZIP code *" : shipping.country === "CA" ? "Postal code *" : shipping.country === "MX" ? "Postal code *" : "Postal code (optional)"} aria-label="Shipping postal code" autoComplete="postal-code" value={shipping.postcode} onChange={updateShipping("postcode")} />
          <Select aria-label="Shipping country" value={shipping.country} onChange={updateShipping("country")}>
            {UNIFORM_SHIPPING_COUNTRIES.map((zone) => (
              <optgroup key={zone.label} label={zone.label}>
                {zone.countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        {addressValidationAttempted && !addressValidation.valid && (
          <p role="alert" className="mt-2 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-[11px] font-semibold text-accent-900">
            {addressValidation.message}
          </p>
        )}
        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-xs font-semibold text-foreground-800">
          <input
            type="checkbox"
            checked={useDifferentOrderContact}
            onChange={(event) => setUseDifferentOrderContact(event.target.checked)}
            className="h-4 w-4 rounded border-background-300 text-primary-600 focus:ring-primary-500"
          />
          Order Contact if different from above
        </label>
        {showOrderContact && (
          <div className="mt-3 rounded-2xl border border-background-200 bg-background-50 p-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground-900">Order contact <RequiredIndicator /></h3>
            <p className="mb-3 mt-1 text-[11px] font-label text-foreground-500">
              We send the receipt, production proof and order updates here.
            </p>
            <div className="space-y-2">
              <Input
                error={addressValidationAttempted && !contactNameValid}
                aria-invalid={addressValidationAttempted && !contactNameValid}
                placeholder="Contact name *"
                aria-label="Order contact name"
                value={contact.name}
                onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                type="email"
                error={addressValidationAttempted && !emailValid}
                aria-invalid={addressValidationAttempted && !emailValid}
                placeholder="Email address *"
                aria-label="Order contact email address"
                value={contact.email}
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Phone"
                  aria-label="Order contact phone number"
                  value={contact.phone}
                  onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
                />
                <Input
                  placeholder="Club / team"
                  aria-label="Club or team name"
                  value={contact.club}
                  onChange={(event) => setContact((current) => ({ ...current, club: event.target.value }))}
                />
              </div>
              <Textarea
                rows={2}
                placeholder="Deadline, delivery destination or production notes…"
                aria-label="Additional order notes"
                value={contact.notes}
                onChange={(event) => setContact((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>
        )}
        {selectedShippingRate && (
          <div role="note" className="mt-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-[11px] leading-relaxed text-primary-900">
            <span className="font-semibold">{selectedShippingRate.zoneLabel} zone:</span>{" "}
            ${selectedShippingRate.amount.toFixed(2)} shipping for {selectedShippingRate.rangeLabel || (shippingUnitCount < 50 ? "orders under 50 units" : "orders of 50 units or more")}.
          </div>
        )}
        <Button type="button" variant="secondary" className="mt-3 w-full" onClick={calculateTotal} disabled={!canCalculate || calculating} icon="ri-calculator-line">
          {calculating ? "Calculating…" : totals ? "Recalculate total" : "Calculate tax, shipping & total"}
        </Button>
      </div>

      <div className="pt-4">
        {!isLiveApi && <DemoModeNotice className="mb-3" />}
        {error && (
          <p className="mb-3 flex items-start gap-1.5 text-xs font-label text-accent-600">
            <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
            {error}
          </p>
        )}
        {checkoutError && <p className="mb-3 text-xs font-label text-accent-600">{checkoutError}</p>}

        {!totals && (
          <div className="mb-4 rounded-2xl border border-background-200 bg-background-50 p-3.5">
            <h3 className="text-sm font-semibold text-foreground-900">Payment Options</h3>
            <p className="mb-3 mt-1 text-[10px] leading-relaxed text-foreground-500">
              Complete the required contact and delivery fields, then calculate the final total to continue with payment.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-center">
                <i className="ri-bank-card-line text-xl text-primary-700" />
                <p className="mt-1 text-xs font-semibold text-foreground-900">Credit or debit card</p>
                <p className="text-[10px] text-foreground-500">Secure Stripe checkout</p>
              </div>
              <div className="rounded-xl border border-background-200 bg-background-100/60 p-3 text-center">
                <i className="ri-paypal-line text-xl text-[#0070ba]" />
                <p className="mt-1 text-xs font-semibold text-foreground-900">PayPal</p>
                <p className="text-[10px] text-foreground-500">Pay with your PayPal account</p>
              </div>
              {shipping.country === "DM" && (
                <div className="col-span-2 rounded-xl border border-[#159447] bg-[#effcf4] p-3 text-left">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#08743f] text-lg text-white">
                      <i className="ri-shake-hands-line" />
                    </span>
                    <span>
                      <span className="block text-xs font-bold text-[#064b2b]">Pay Locally in Dominica</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-foreground-600">Arrange payment in person after checkout.</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {totals && (
          <div className="mb-4 rounded-2xl border border-background-200 bg-background-50 p-3.5">
            <h3 className="mb-3 text-sm font-semibold text-foreground-900">Choose Payment Method</h3>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-center">
                <i className="ri-bank-card-line text-xl text-primary-700" />
                <p className="mt-1 text-xs font-semibold text-foreground-900">Credit or debit card</p>
                <p className="text-[10px] text-foreground-500">Secure Stripe checkout</p>
              </div>
              <div className="rounded-xl border border-background-200 bg-background-100/60 p-3 text-center">
                <i className="ri-paypal-line text-xl text-[#0070ba]" />
                <p className="mt-1 text-xs font-semibold text-foreground-900">PayPal</p>
                <p className="text-[10px] text-foreground-500">Pay with your PayPal account</p>
              </div>
              {shipping.country === "DM" && (
                <div className="relative col-span-2 overflow-hidden rounded-xl border border-[#159447] bg-gradient-to-r from-[#effcf4] via-white to-[#f4fff7] p-3.5 text-left shadow-[0_8px_22px_rgba(0,92,48,0.08)]">
                  <span className="absolute inset-y-0 right-0 w-20 bg-[linear-gradient(135deg,transparent_18%,#0a6136_18%,#0a6136_40%,#f4cf18_40%,#f4cf18_50%,#111_50%,#111_60%,#fff_60%,#fff_70%,#0a6136_70%)] opacity-90" />
                  <div className="relative flex items-center gap-3 pr-16">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#08743f] text-xl text-white shadow-sm">
                      <i className="ri-shake-hands-line" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#064b2b]">Pay Locally in Dominica</span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-foreground-600">Complete your order now and arrange payment in person on the island.</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            {config?.stripeEnabled && !cardSession && (
              <Button type="button" variant="primary" className="w-full" disabled={!isLiveApi || startingCard} onClick={startCardPayment} icon="ri-bank-card-line">
                {startingCard ? "Opening secure payment…" : `Pay $${totals.total.toFixed(2)} by card`}
              </Button>
            )}
            {cardSession && config?.stripePublishableKey && (
              <Elements stripe={getUniformStripe(config.stripePublishableKey)} options={{ clientSecret: cardSession.clientSecret }}>
                <UniformCardPaymentForm session={cardSession} onError={setCheckoutError} />
              </Elements>
            )}
            {config?.stripeEnabled && config?.paypalEnabled && <div className="my-3 flex items-center gap-2 text-[10px] text-foreground-400"><span className="h-px flex-1 bg-background-200" />or<span className="h-px flex-1 bg-background-200" /></div>}
            {config?.paypalEnabled && (
              <PaypalButton
                clientId={config.paypalClientId}
                disabled={!isLiveApi || !canCheckout}
                createOrder={async () => {
                  const result = await createUniformPaypalOrder(await completeOrderPayload(), checkoutContact.email, shipping);
                  return { orderId: result.orderId, paypalOrderId: result.paypalOrderId, accessToken: result.accessToken };
                }}
                captureOrder={captureUniformPaypalOrder}
                onSuccess={(id) => window.location.assign(`/checkout/thank-you?order=${id}`)}
                onError={setCheckoutError}
              />
            )}
            {!config?.stripeEnabled && !config?.paypalEnabled && <p className="text-xs font-label text-foreground-500">Online payment is not configured yet. You can still request a quote below.</p>}
            {shipping.country === "DM" && (
              <>
                <div className="my-3 flex items-center gap-2 text-[10px] text-foreground-400"><span className="h-px flex-1 bg-background-200" />or pay on island<span className="h-px flex-1 bg-background-200" /></div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full border-primary-500 bg-primary-50 text-primary-800 hover:bg-primary-100"
                  disabled={placingLocalOrder || !canCheckout}
                  onClick={placeLocalDominicaOrder}
                  icon="ri-map-pin-2-line"
                >
                  {placingLocalOrder ? "Reserving order…" : "Place order — pay locally in Dominica"}
                </Button>
                <p className="mt-2 text-center text-[10px] leading-relaxed text-foreground-500">Payment instructions will be emailed after checkout. Production begins after local payment is confirmed.</p>
              </>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          disabled={!minimumKitsMet || submitting}
          onClick={() => (showOrderContact ? onRequestQuote() : setQuoteContactRequested(true))}
          icon="ri-file-list-3-line"
          className="w-full"
        >
          {submitting ? "Submitting…" : quoteContactRequested ? "Send quote request" : "Request a quote instead"}
        </Button>
        <p className="mt-2 text-center text-[10px] font-label leading-relaxed text-foreground-400">Payments are processed securely by Stripe or PayPal. The production team confirms artwork before manufacturing.</p>
      </div>
    </div>
  );
}

function UniformCardPaymentForm({ session, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    onError(null);
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (result.error) {
      onError(result.error.message || "Card payment could not be completed.");
      setPaying(false);
      return;
    }
    try {
      const confirmed = await confirmUniformPayment(session.orderId, session.accessToken);
      if (confirmed.status === "paid") window.location.assign(`/checkout/thank-you?order=${session.orderId}`);
      else onError("Payment is processing. Check your email for confirmation shortly.");
    } catch (err) {
      onError(err.message || "Payment was submitted, but confirmation is still pending.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      <Button type="submit" variant="primary" className="w-full" disabled={!stripe || paying} icon="ri-lock-line">
        {paying ? "Processing…" : `Pay $${session.total.toFixed(2)} securely`}
      </Button>
    </form>
  );
}

function ReviewRow({ icon, title, value, meta, onEdit }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-background-200 bg-background-50 p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
        <i className={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">{title}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground-900">{value}</p>
        <p className="mt-0.5 text-[11px] font-label text-foreground-500">{meta}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 cursor-pointer"
      >
        Edit
      </button>
    </div>
  );
}

