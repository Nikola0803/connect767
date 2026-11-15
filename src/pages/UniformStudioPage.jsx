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
  sockSizeOptions,
  bottomLengthOptions,
  playerRoleOptions,
  kitUnitPrice,
  FAN_JERSEY_PRICE,
  sportConfigFor,
  sportModelUrl,
} from "../data/uniforms";
import JerseyStage from "../components/uniform-studio/JerseyStage";
import FloatingToolbar from "../components/uniform-studio/FloatingToolbar";
import {
  DesignPanel,
  ZoneEditorPanel,
  TextPanel,
  LogoPanel,
  LayersPanel,
  OptionsPanel,
  SkinsPanel,
} from "../components/uniform-studio/StudioPanels";
import { cloneZoneModel, SOCCER_ZONE_MODEL } from "../components/uniform-studio/uniformZoneModel";
import { skinDataUri } from "../data/skins";
import Button from "../components/ui/Button";
import Tooltip from "../components/ui/Tooltip";
import SelectedItemPanel from "../components/uniform-studio/SelectedItemPanel";
import { Input, Select, Textarea } from "../components/ui/FormField";
import DemoModeNotice from "../components/DemoModeNotice";
import PaypalButton from "../components/PaypalButton";
import { isLiveApi } from "../lib/config";
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
  city: "", state: "", postcode: "", country: "DM", phone: "",
};
let uniformStripePromise = null;
const getUniformStripe = (key) => {
  if (!uniformStripePromise) uniformStripePromise = loadStripe(key);
  return uniformStripePromise;
};

const tools = [
  {
    key: "design",
    label: "Design",
    icon: "ri-palette-line",
    hint: "Collar, sleeve length and the color of each garment part. Hover a color to highlight exactly what it changes.",
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
    key: "logo",
    label: "Logo",
    icon: "ri-image-add-line",
    hint: "Upload a crest or sponsor mark, then click the design where it goes. Transparent PNG or SVG prints cleanest.",
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
    hint: "Everything you've added, front and back. Reorder, select or delete items here.",
  },
  {
    key: "options",
    label: "Options",
    icon: "ri-settings-4-line",
    hint: "Fit, kit type and priced extras like embroidery or an inside-collar message.",
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
    key: "uniform",
    label: "Uniform",
    description: "Style, colors & zones",
    icon: "ri-shirt-line",
    step: 1,
    defaultTool: "design",
    tools: ["design", "zones"],
  },
  {
    key: "artwork",
    label: "Artwork",
    description: "Text, logos & patterns",
    icon: "ri-image-edit-line",
    step: 2,
    defaultTool: "text",
    tools: ["text", "logo", "skins", "layers"],
  },
  {
    key: "options",
    label: "Kit options",
    description: "Fit & production choices",
    icon: "ri-settings-4-line",
    step: 3,
    defaultTool: "options",
    tools: ["options"],
  },
  {
    key: "roster",
    label: "Team roster",
    description: "Names, numbers & sizes",
    icon: "ri-team-line",
    step: 4,
    defaultTool: "roster",
    tools: ["roster"],
  },
  {
    key: "review",
    label: "Review & quote",
    description: "Confirm and submit",
    icon: "ri-shopping-bag-3-line",
    step: 5,
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
const ENABLE_3D = true;

const newRosterEntry = () => ({
  name: "",
  number: "",
  shortsNumber: "",
  shirtSize: "AM",
  shortSize: "AM",
  sockSize: "Medium",
  bottomLength: "Regular",
  sleevePreference: "Team selection",
  role: "Player",
  quantity: 1,
  notes: "",
});

const rosterUnitCount = (roster) =>
  roster.reduce((total, entry) => total + Math.max(1, Number.parseInt(entry.quantity, 10) || 1), 0);

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

export default function UniformStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSport = searchParams.get("sport") || "soccer";
  const scratch = searchParams.get("mode") === "scratch";
  const initialWorkflowStep = searchParams.get("step") || "design";

  const [activeSport, setActiveSport] = useState(
    sports.some((s) => s.slug === initialSport) ? initialSport : "soccer"
  );
  const [selectedTemplate, setSelectedTemplate] = useState(scratch ? "blank-canvas" : null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // ---------- Design state ----------
  const [collar, setCollar] = useState("Crew");
  const [sleeve, setSleeve] = useState("Short");
  const [colors, setColors] = useState(defaultZoneColors);
  const [view, setView] = useState("front");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [activeTool, setActiveTool] = useState(
    tools.some((tool) => tool.key === initialWorkflowStep)
      ? initialWorkflowStep
      : studioWorkflow.find((step) => step.key === initialWorkflowStep)?.defaultTool || "design"
  );
  const [zoom, setZoom] = useState(1);
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
    searchParams.get("view") === "3d" ? "3d" : "edit"
  ); // '3d' | 'edit'

  // When set, the next click on the garment creates this item AT the click
  // point instead of dropping it on the chest and making the user drag it
  // into place. Cleared as soon as it lands, or if they change tool.
  const [pendingLayer, setPendingLayer] = useState(null);

  // Two-tone garment. `enabled` off = one flat colour (the old behaviour).
  // `softness` 0 gives a hard shirt/shorts seam, higher values a gradient —
  // one control covering both things the client asked for.
  const [twoTone, setTwoTone] = useState({
    enabled: false,
    colorB: "#1b1a16",
    splitAt: 0.5,
    softness: 0.04,
  });

  // 3D placements, keyed by layer id: { position, orientation, scale, roll }.
  // Held separately from `layers` rather than merged into it because the 2D
  // editor's x/y percentages and a world-space decal transform describe
  // different things — a layer can legitimately have both, and writing the
  // 3D transform into the layer would invalidate the flat editor's geometry.
  const [placements3d, setPlacements3d] = useState({});
  // Shown when leaving the studio with unsaved work — see confirmExit below.
  const [exitPrompt, setExitPrompt] = useState(false);
  const placeLayer3d = (layerId, placement) =>
    setPlacements3d((prev) => ({ ...prev, [layerId]: placement }));


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
  const [fitType, setFitType] = useState(fitTypeOptions[0]);
  const [kitType, setKitType] = useState(kitTypeOptions[0]);
  const [logoApplication, setLogoApplication] = useState("Sublimated");
  const [insideCollarMessage, setInsideCollarMessage] = useState(false);
  const [insideCollarText, setInsideCollarText] = useState("");
  const [fanJerseyAdded, setFanJerseyAdded] = useState(false);

  const unitPrice = useMemo(
    () => kitUnitPrice({ sleeve, collar, insideCollarMessage, logoApplication }),
    [sleeve, collar, insideCollarMessage, logoApplication]
  );

  // ---------- Roster state ----------
  const [rosterEntry, setRosterEntry] = useState(newRosterEntry);
  const [roster, setRoster] = useState([]);
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
  const [manualSaveStatus, setManualSaveStatus] = useState("idle");
  const manualSaveResetRef = useRef(null);

  // Local screenshot fixture only; Vite removes this branch from production.
  useEffect(() => {
    if (!import.meta.env.DEV || searchParams.get("preview") !== "checkout") return;
    setRoster([
      { ...newRosterEntry(), name: "A. Miller", number: "10", shirtSize: "AL", quantity: 4 },
      { ...newRosterEntry(), name: "J. Carter", number: "7", shirtSize: "AM", quantity: 4 },
      { ...newRosterEntry(), name: "D. Rivera", number: "23", shirtSize: "AXL", quantity: 4 },
    ]);
    setContact({ name: "Riverside FC", email: "orders@example.com", phone: "(767) 555-0100", club: "Riverside FC", notes: "" });
    setShipping({ firstName: "Avery", lastName: "Miller", company: "Riverside FC", address1: "10 Stadium Road", address2: "", city: "Roseau", state: "Saint George", postcode: "00109", country: "DM", phone: "(767) 555-0100" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const template = templates.find((t) => t.slug === selectedTemplate);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const sportConfig = sportConfigFor(activeSport);
  const workflowIndex = Math.max(
    0,
    studioWorkflow.findIndex((step) => step.tools.includes(activeTool))
  );
  const workflowStep = studioWorkflow[workflowIndex];
  const visibleTools = tools.filter((tool) => workflowStep.tools.includes(tool.key));
  const activeToolConfig = tools.find((tool) => tool.key === activeTool) || visibleTools[0];

  const openWorkflowStep = (index) => {
    const nextStep = studioWorkflow[Math.max(0, Math.min(studioWorkflow.length - 1, index))];
    setPendingLayer(null);
    setSelectedLayerId(null);
    setActiveTool(nextStep.defaultTool);
  };

  const continueWorkflow = () => {
    if (workflowIndex === studioWorkflow.length - 1) return;
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

  const updateZoneStyle = (side, zoneId, patch) => setZoneStyles((current) => ({
    ...current,
    [side]: { ...current[side], [zoneId]: { ...(current[side]?.[zoneId] || {}), ...patch } },
  }));

  const resetZone = (side, zoneId) => {
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
          collar,
          sleeve,
          zoneModel,
          zoneStyles,
          twoTone,
          fitType,
          kitType,
          logoApplication,
          insideCollarMessage,
          insideCollarText,
          fanJerseyAdded,
          roster,
          contact,
          shipping,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* private browsing / quota — the design just won't persist, which is
         no worse than before this existed */
    }
  }, [storageKey, layers, placements3d, colors, collar, sleeve, zoneModel, zoneStyles, twoTone,
    fitType, kitType, logoApplication, insideCollarMessage, insideCollarText, fanJerseyAdded, roster, contact, shipping]);

  const saveProgress = () => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          layers,
          placements3d,
          colors,
          collar,
          sleeve,
          zoneModel,
          zoneStyles,
          twoTone,
          fitType,
          kitType,
          logoApplication,
          insideCollarMessage,
          insideCollarText,
          fanJerseyAdded,
          roster,
          contact,
          shipping,
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

  const restoreSaved = (key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved?.layers?.length && !Object.keys(saved?.placements3d || {}).length && !saved?.zoneModel) return false;
      setLayers(saved.layers || []);
      setPlacements3d(saved.placements3d || {});
      if (saved.colors) setColors(normalizeZoneColors(saved.colors));
      if (saved.collar) setCollar(saved.collar);
      if (saved.sleeve) setSleeve(saved.sleeve);
      if (saved.zoneModel?.front && saved.zoneModel?.back) setZoneModel(saved.zoneModel);
      if (saved.zoneStyles) setZoneStyles(saved.zoneStyles);
      if (saved.twoTone) setTwoTone(saved.twoTone);
      if (saved.fitType) setFitType(saved.fitType);
      if (saved.kitType) setKitType(saved.kitType);
      if (saved.logoApplication) setLogoApplication(saved.logoApplication);
      if (typeof saved.insideCollarMessage === "boolean") setInsideCollarMessage(saved.insideCollarMessage);
      if (typeof saved.insideCollarText === "string") setInsideCollarText(saved.insideCollarText);
      if (typeof saved.fanJerseyAdded === "boolean") setFanJerseyAdded(saved.fanJerseyAdded);
      if (Array.isArray(saved.roster)) setRoster(saved.roster);
      if (saved.contact) setContact(saved.contact);
      if (saved.shipping) setShipping(saved.shipping);
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
  };

  useEffect(() => {
    if (!pendingLayer) return;
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
  const applyColourway = ([body, trim, accent]) =>
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

  const hasWork = layers.length > 0 || Object.keys(placements3d).length > 0;

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

  const selectTemplate = (t, sportSlug = activeSport) => {
    const nextSportConfig = sportConfigFor(sportSlug);
    setActiveSport(sportSlug);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sport", sportSlug);
      return next;
    });
    setSelectedTemplate(t.slug);
    setCollar(t.defaultCollar || nextSportConfig.collarOptions[0]);
    setSleeve(t.defaultSleeve || nextSportConfig.sleeveOptions?.[0] || "Sleeveless");
    // A stock image demonstrates the cut only. New designs always enter on
    // clean white fabric with no artwork carried over from another template.
    setColors({ ...defaultZoneColors });
    setLayers([]);
    setPlacements3d({});
    setSelectedLayerId(null);
    setPendingLayer(null);
    // Pick up where they left off on this exact kit, if they were here before.
    restoreSaved(`c767:studio:${sportSlug}:${t.slug}`);
  };

  const TOOL_FOR_LAYER = { text: "text", skin: "skins", logo: "logo", clipart: "logo" };

  const selectLayer = (id) => {
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
    setPendingLayer({ type: "text" });
    setActiveTool("text");
  };

  const armLogoPlacement = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingLayer({ type: "logo", src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /** Customer's own pattern image, placed like any built-in one. */
  const armPatternUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingLayer({ type: "skin", src: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const armSkinPlacement = (skinKey) => {
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
    if (!pendingLayer) return;
    const id = nextLayerId();

    const is2d = placement && placement.x !== undefined;
    const base = {
      id,
      view: placement?.view || view,
      x: is2d ? placement.x : 50,
      y: is2d ? placement.y : 45,
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

  const updateLayer = (id, patch) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

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
    const source = layers.find((l) => l.id === id);
    if (!source) return;
    const newId = nextLayerId();
    setLayers((ls) => [
      ...ls,
      { ...source, id: newId, x: Math.min(90, source.x + 6), y: Math.min(90, source.y + 6) },
    ]);
    setSelectedLayerId(newId);
  };

  const removeLayer = (id) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const reorderLayer = (id, direction) => {
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
          shortsNumber: valueFor(row, ["shortsnumber", "pantsnumber", "bottomnumber"]),
          shirtSize: valueFor(row, ["shirtsize", "jerseysize", "topsize"]) || "AM",
          shortSize: valueFor(row, ["shortsize", "shortssize", "pantssize", "bottomsize"]) || "AM",
          sockSize: valueFor(row, ["socksize", "sockssize"]) || "Medium",
          bottomLength: valueFor(row, ["bottomlength", "pantlength", "shortlength"]) || "Regular",
          sleevePreference: valueFor(row, ["sleeve", "sleevelength", "sleevepreference"]) || "Team selection",
          role: valueFor(row, ["role", "playerrole", "position"]) || "Player",
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
    if (!stageRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(stageRef.current, { pixelRatio: 2, skipFonts: true });
      const link = document.createElement("a");
      link.download = `${template?.name || "jersey"}-front-back.png`;
      link.href = dataUrl;
      link.click();
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
    return null;
  };

  const contactValid =
    contact.name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim());

  const buildUniformPayload = (previewImage = null) => {
    const unitCount = rosterUnitCount(roster);
    return {
      template: template?.name || "Blank Canvas",
      sport: activeSport,
      collar,
      sleeve,
      colors,
      fitType,
      kitType,
      logoApplication,
      insideCollarMessage,
      insideCollarText,
      fanJerseyAdded,
      unitPrice,
      grandTotal: unitPrice * unitCount + (fanJerseyAdded ? FAN_JERSEY_PRICE : 0),
      layers,
      placements3d,
      designMode: stageMode === "3d" ? "3d" : "flat",
      roster,
      contact,
      previewImage,
    };
  };

  const handleRequestQuote = async () => {
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

  // ---------- Entry screen: pick a sport, then a template ----------
  // Deliberately the only thing between landing and designing. The marketing
  // hero, pricing table, FAQ and closing CTA that used to wrap the studio
  // were removed — /uniforms is a tool, and everything that isn't the tool
  // was competing with it for the screen.
  if (!selectedTemplate) {
    const categorySport = selectedCategory
      ? sports.find((sport) => sport.slug === selectedCategory)
      : null;
    const categoryTemplate = categorySport
      ? templates.find(
          (candidate) => candidate.sportSlug === categorySport.slug && candidate.slug !== "blank-canvas"
        )
      : null;
    const categoryBlankTemplate = categoryTemplate
      ? {
          slug: "blank-canvas",
          defaultCollar: categoryTemplate.defaultCollar,
          defaultSleeve: categoryTemplate.defaultSleeve,
        }
      : null;

    return (
      <div className="min-h-[100dvh] bg-[linear-gradient(145deg,#f8f3e9_0%,#fffdf8_48%,#eef8f1_100%)] text-foreground-950">
        <header className="border-b border-background-200/70 bg-background-50/85 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
            <Button to="/" variant="ghost" size="sm" icon="ri-arrow-left-line" iconPosition="left">
              Back to site
            </Button>
            <div className="text-center">
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-primary-700">
                Custom uniforms
              </p>
              <span className="font-heading text-lg font-semibold">Uniform Studio</span>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 sm:inline-flex">
              <i className="ri-save-3-line" /> Designs save automatically
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
          <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/70 px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-primary-800">
                <i className="ri-magic-line" /> Build a complete team kit
              </span>
              <h1 className="font-heading text-4xl font-medium leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                Design your uniform.
                <span className="block italic text-primary-700">Outfit the whole roster.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground-600 md:text-lg">
                Choose a sport and starting point, customize every panel, then add player names,
                sizes and uniform options before requesting production pricing.
              </p>
            </div>
            <ol className="grid grid-cols-3 overflow-hidden rounded-2xl border border-background-300 bg-background-50 shadow-sm sm:grid-cols-6">
              {["Sport & style", "Design", "Artwork", "Options", "Roster", "Review"].map((label, index) => (
                <li
                  key={label}
                  className={`flex min-w-0 flex-col gap-1 px-3 py-3 ${
                    index === 0 ? "bg-primary-600 text-white" : "border-l border-background-200 text-foreground-500"
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${index === 0 ? "text-white/70" : "text-foreground-400"}`}>
                    Step {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{label}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-[30px] border border-background-300/80 bg-background-50/95 p-5 shadow-[0_22px_60px_rgba(69,48,30,0.08)] sm:p-7 lg:p-9">
            <div className="flex flex-col gap-3 border-b border-background-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">
                  Step 1
                </p>
                <h2 className="mt-1 font-heading text-3xl font-semibold sm:text-4xl">
                  {categorySport ? categorySport.label : "Choose your sport"}
                </h2>
              </div>
              {categorySport ? (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="group inline-flex min-h-12 items-center gap-3 self-start rounded-full border border-primary-700 bg-primary-600 px-5 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(0,116,73,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-[0_14px_30px_rgba(0,116,73,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 sm:self-auto cursor-pointer"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-white/15 transition group-hover:bg-white/20">
                    <i className="ri-arrow-left-line text-base" aria-hidden="true" />
                  </span>
                  <span>All Sports</span>
                </button>
              ) : (
                <p className="max-w-lg text-sm leading-relaxed text-foreground-500">
                  Select any category to see its shirt style and blank-canvas options.
                </p>
              )}
            </div>

            {categorySport && categoryTemplate && categoryBlankTemplate ? (
              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => selectTemplate(categoryTemplate, categorySport.slug)}
                  className="group overflow-hidden rounded-[24px] border border-background-300 bg-background-50 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary-400 hover:shadow-[0_20px_42px_rgba(0,116,73,0.11)] cursor-pointer"
                >
                  <div className="relative flex h-72 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#ffffff_0%,#f4eee3_72%)] p-6">
                    <span className="absolute left-5 top-5 rounded-full border border-primary-200 bg-background-50/95 px-3 py-1.5 text-xs font-bold text-primary-800 shadow-sm">
                      Included template
                    </span>
                    <img
                      src={categoryTemplate.image}
                      alt={`${categoryTemplate.name} ${categorySport.label} uniform template`}
                      className="h-full w-full object-contain drop-shadow-[0_18px_20px_rgba(25,40,32,0.16)] transition-transform duration-300 group-hover:scale-[1.035]"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700">
                          Shirt style
                        </p>
                        <h3 className="mt-1 font-heading text-3xl font-semibold">{categoryTemplate.name}</h3>
                      </div>
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white">
                        <i className="ri-arrow-right-line text-lg" />
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-foreground-500">{categoryTemplate.description}</p>
                    <div className="mt-4 flex gap-2 text-xs font-semibold text-foreground-600">
                      <span className="rounded-full bg-background-100 px-3 py-1.5">{categoryTemplate.defaultCollar} neck</span>
                      <span className="rounded-full bg-background-100 px-3 py-1.5">{categoryTemplate.defaultSleeve} sleeve</span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selectTemplate(categoryBlankTemplate, categorySport.slug)}
                  className="group flex min-h-[470px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-primary-300 bg-primary-50/60 p-8 text-center transition duration-200 hover:-translate-y-1 hover:border-primary-500 hover:bg-primary-100/70 hover:shadow-[0_20px_42px_rgba(0,116,73,0.1)] cursor-pointer"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-600 text-4xl text-white shadow-[0_14px_30px_rgba(0,116,73,0.22)] transition-transform group-hover:rotate-3 group-hover:scale-105">
                    <i className="ri-add-line" />
                  </span>
                  <h3 className="mt-6 font-heading text-3xl font-semibold">Design from scratch</h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-foreground-500">
                    Open a clean {categorySport.label.toLowerCase()} kit and choose its neck, sleeves, colors and artwork inside the studio.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary-800">
                    Open blank canvas <i className="ri-arrow-right-line" />
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sports.map((sport) => {
                  const uniformTemplate = templates.find(
                    (candidate) => candidate.sportSlug === sport.slug && candidate.slug !== "blank-canvas"
                  );
                  if (!uniformTemplate) return null;

                  return (
                    <button
                      key={sport.slug}
                      type="button"
                      onClick={() => {
                        setActiveSport(sport.slug);
                        setSelectedCategory(sport.slug);
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("sport", sport.slug);
                          return next;
                        });
                      }}
                      className="group overflow-hidden rounded-[24px] border border-background-300 bg-background-50 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary-400 hover:shadow-[0_20px_42px_rgba(0,116,73,0.11)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 cursor-pointer"
                    >
                      <div className="relative flex h-60 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#ffffff_0%,#f4eee3_72%)] p-5">
                        <img
                          src={uniformTemplate.image}
                          alt={`${uniformTemplate.name} ${sport.label} uniform template`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain drop-shadow-[0_18px_20px_rgba(25,40,32,0.16)] transition-transform duration-300 group-hover:scale-[1.045]"
                        />
                      </div>
                      <div className="flex min-h-40 flex-col p-5">
                        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700">
                          Sport category
                        </p>
                        <div className="mt-1 flex items-start justify-between gap-4">
                          <h3 className="font-heading text-2xl font-semibold">{sport.label}</h3>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800 transition group-hover:bg-primary-600 group-hover:text-white">
                            <i className="ri-arrow-right-line" />
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-foreground-500">
                          Open this category to choose a shirt style or begin with a blank canvas.
                        </p>
                        <span className="mt-auto pt-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-800">
                          Open category
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ---------- The studio itself: one full viewport, nothing else ----------
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#10110f] text-background-50">
      <div className="flex min-h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0c0d0b]/95 px-3 py-2.5 pt-[max(.625rem,env(safe-area-inset-top))] sm:px-4 md:px-5">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-background-50/60 transition hover:bg-white/[0.06] hover:text-background-50"
        >
          <i className="ri-arrow-left-line" />
          Back
        </button>
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="truncate text-sm font-semibold text-background-50/85">
            {template?.name || "Blank Canvas"}
          </span>
          <span className="text-background-50/20">/</span>
          <span className="truncate text-xs font-medium text-background-50/45">
            {sports.find((s) => s.slug === activeSport)?.label}
          </span>
          <span className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary-500/20 bg-primary-950/35 px-2.5 py-1 text-[10px] font-semibold text-primary-200/90">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Auto-saved
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveProgress}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
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
          </button>
          <button
            type="button"
            aria-pressed={stageMode === "3d"}
            onClick={() => setStageMode((mode) => (mode === "3d" ? "edit" : "3d"))}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              stageMode === "3d"
                ? "border-primary-500 bg-primary-600 text-white shadow-[0_8px_18px_rgba(0,116,73,0.28)]"
                : "border-primary-500/45 bg-primary-950/55 text-primary-100 hover:border-primary-400 hover:bg-primary-900"
            }`}
          >
            <i className={stageMode === "3d" ? "ri-edit-2-line" : "ri-3d-cube-sphere-line"} />
            {stageMode === "3d" ? "Return to 2D" : "View in 3D"}
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            disabled={stageMode !== "edit"}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50 disabled:opacity-40"
          >
            <i className="ri-file-code-line" /> SVG
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting || stageMode !== "edit"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line" />
            <span className="hidden sm:inline">{exporting ? "Exporting…" : "Download"}</span>
          </button>
        </div>
      </div>

      <nav
        aria-label="Uniform order progress"
        className="flex-shrink-0 border-b border-white/[0.06] bg-[#12130f] px-3 py-2.5 sm:px-5"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto py-0.5">
          {studioWorkflow.map((step, index) => {
            const active = index === workflowIndex;
            const complete = index < workflowIndex;
            const locked = step.key === "review" && roster.length === 0;
            return (
              <div key={step.key} className="flex min-w-0 flex-1 items-center gap-1.5">
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  disabled={locked}
                  onClick={() => openWorkflowStep(index)}
                  className={`group flex min-w-[156px] flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "cursor-pointer border-primary-400/45 bg-primary-700 text-white shadow-[0_8px_22px_rgba(0,116,73,0.2)]"
                      : complete
                        ? "cursor-pointer border-primary-700/35 bg-primary-950/35 text-primary-100 hover:bg-primary-950/55"
                        : locked
                          ? "cursor-not-allowed border-white/[0.04] bg-white/[0.02] text-background-50/25"
                          : "cursor-pointer border-white/[0.07] bg-white/[0.025] text-background-50/55 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-background-50/80"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    active
                      ? "border-white/20 bg-white/15"
                      : complete
                        ? "border-primary-500/35 bg-primary-700 text-white"
                        : "border-white/[0.08] bg-white/[0.05]"
                  }`}>
                    {complete ? <i className="ri-check-line" /> : locked ? <i className="ri-lock-line" /> : step.step}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold">
                      <i className={`${step.icon} text-xs opacity-70`} />
                      {step.label}
                    </span>
                    <span className={`mt-0.5 hidden whitespace-nowrap text-[9px] xl:block ${active ? "text-white/65" : "text-current opacity-55"}`}>
                      {step.description}
                    </span>
                  </span>
                </button>
                {index < studioWorkflow.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${
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

      <div className="flex min-h-0 flex-1 bg-[radial-gradient(circle_at_48%_42%,rgba(36,45,36,0.32),transparent_38%),linear-gradient(135deg,#10110f_0%,#151610_52%,#10110f_100%)]">
                  {/* Icon rail — desktop only; mobile gets the pill row below the canvas */}
                  <div className="hidden w-[76px] flex-shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-white/[0.055] bg-black/10 px-2 py-4 lg:flex">
                    {visibleTools.map((t) => (
                      <Tooltip key={t.key} label={t.label} description={t.hint} placement="right">
                        <button
                          type="button"
                          aria-label={t.label}
                          onClick={() => setActiveTool(t.key)}
                          className={`flex w-14 flex-shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl border py-2.5 transition-all ${
                            activeTool === t.key
                              ? "border-accent-400/50 bg-accent-500 text-background-50 shadow-[0_8px_22px_rgba(239,84,53,0.2)]"
                              : "border-transparent text-background-50/40 hover:border-white/[0.06] hover:bg-white/[0.045] hover:text-background-50/85"
                          }`}
                        >
                          <i className={`${t.icon} text-lg`} />
                          <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">
                            {t.label}
                          </span>
                        </button>
                      </Tooltip>
                    ))}
                  </div>

                  {/* Canvas */}
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-3 overflow-hidden px-4 py-3 md:px-6 xl:px-10">
                    {/* Top bar: view thumbnails + zoom/export, inline instead of a separate row above the card */}
                    <div className="flex w-full max-w-6xl flex-shrink-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                        <div className="hidden min-w-0 md:block">
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-background-50/30">Workspace</p>
                          <p className="truncate text-xs font-semibold text-background-50/65">{activeToolConfig?.label || workflowStep.label}</p>
                        </div>
                        {ENABLE_3D && (
                          <div
                            className="ml-2 inline-flex shrink-0 items-center rounded-xl border border-white/[0.08] bg-black/15 p-1"
                            aria-label="Uniform preview mode"
                          >
                            <button
                              type="button"
                              aria-pressed={stageMode === "edit"}
                              onClick={() => setStageMode("edit")}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                stageMode === "edit"
                                  ? "bg-background-50 text-foreground-950 shadow-sm"
                                  : "text-background-50/55 hover:bg-white/[0.06] hover:text-background-50"
                              }`}
                            >
                              <i className="ri-edit-2-line" />
                              2D editor
                            </button>
                            <button
                              type="button"
                              aria-pressed={stageMode === "3d"}
                              onClick={() => setStageMode("3d")}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                stageMode === "3d"
                                  ? "bg-primary-600 text-white shadow-[0_6px_16px_rgba(0,116,73,0.28)]"
                                  : "text-background-50/55 hover:bg-white/[0.06] hover:text-background-50"
                              }`}
                            >
                              <i className="ri-3d-cube-sphere-line" />
                              3D preview
                            </button>
                          </div>
                        )}

                      </div>
                      {stageMode === "edit" && (
                        <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-black/15 px-1 py-1">
                          <button
                            type="button"
                            aria-label="Zoom out"
                            onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
                            className="w-7 h-7 flex items-center justify-center rounded text-background-50/60 hover:bg-white/10 hover:text-background-50 cursor-pointer"
                          >
                            <i className="ri-subtract-line text-xs" />
                          </button>
                          <span className="text-xs text-background-50/60 font-label w-10 text-center">
                            {Math.round(zoom * 100)}%
                          </span>
                          <button
                            type="button"
                            aria-label="Zoom in"
                            onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))}
                            className="w-7 h-7 flex items-center justify-center rounded text-background-50/60 hover:bg-white/10 hover:text-background-50 cursor-pointer"
                          >
                            <i className="ri-add-line text-xs" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Floating contextual toolbar */}
                    {stageMode === "edit" && selectedLayer && (
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

                    {stageMode === "edit" ? (
                      <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-2">
                        <div
                          className="w-full max-w-[800px] transition-transform"
                          style={{ transform: `scale(${zoom})` }}
                        >
                          <JerseyStage
                            ref={stageRef}
                            sport={activeSport}
                            view={view}
                            onViewChange={setView}
                            collar={collar}
                            sleeve={sleeve}
                            colors={colors}
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
                            layers={layers}
                            selectedId={selectedLayerId}
                            onSelect={selectLayer}
                            onLayerChange={(id, patch) => updateLayer(id, patch)}
                            onBackgroundClick={() => setSelectedLayerId(null)}
                            pendingLayer={pendingLayer}
                            onCommitPending={commitPendingLayer}
                          />
                        </div>
                        <p className="text-[11px] text-background-50/30 font-label text-center flex-shrink-0">
                          {pendingLayer
                            ? "Click the design where you want it · Esc to cancel"
                            : "Drag to move · black handle rotates · green handle resizes · double-click text to edit"}
                        </p>
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
                            color={colors.body}
                            colorB={twoTone.enabled ? twoTone.colorB : undefined}
                            splitAt={twoTone.splitAt}
                            softness={twoTone.softness}
                            zoneColors={colors}
                            collar={collar}
                            sleeve={sleeve}
                            fullscreen
                            layers={layers}
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
                          />
                        </Suspense>
                        <p className="text-[11px] text-background-50/40 font-label text-center mt-2 flex-shrink-0">
                          {!layers.length
                            ? "Add text or a logo — it lands on the chest ready to move."
                            : "Drag the artwork to move it · scroll to resize · drag the garment to turn it"}
                        </p>
                      </div>
                    )}

                    {/* Mobile tool tabs — the icon rail is hidden below lg */}
                    <div className="lg:hidden w-full flex items-center gap-2 overflow-x-auto pb-1">
                      {visibleTools.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setActiveTool(t.key)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 border ${
                            activeTool === t.key
                              ? "bg-accent-500 text-background-50 border-accent-500"
                              : "bg-white/5 text-background-50/70 border-white/10 hover:bg-white/10 hover:text-background-50"
                          }`}
                        >
                          <i className={t.icon} />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

              {/* Docked fields panel */}
              <aside className="hidden w-full max-w-[420px] flex-shrink-0 overflow-y-auto border-l border-black/10 bg-[#f7f5ef] md:block">
                <div className="sticky top-0 z-10 border-b border-black/[0.07] bg-[#f7f5ef]/95 px-5 py-4 backdrop-blur-xl">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary-700">Step {workflowStep.step} · {workflowStep.label}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <h2 className="font-heading text-xl font-medium text-foreground-950">{activeToolConfig?.label || workflowStep.label}</h2>
                    <span className="rounded-full border border-background-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-foreground-500">Live preview</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground-500">{activeToolConfig?.hint || workflowStep.description}</p>
                </div>
                <div className="p-5">
                {selectedLayer && <SelectedItemPanel
                  layer={selectedLayer}
                  placement={selectedLayerId ? placements3d[selectedLayerId] : null}
                  onTextChange={(id, text) => updateLayer(id, { text })}
                  onColorChange={(id, color) => updateLayer(id, { color })}
                  onFontChange={(id, fontFamily) => updateLayer(id, { fontFamily })}
                  onGradientChange={(id, patch) => updateLayer(id, patch)}
                  onScaleChange={stageMode === "3d" ? setLayerScale : setLayerSize2d}
                  onRotateChange={stageMode === "3d" ? rotateLayer : rotateLayer2d}
                  onDelete={removeLayer}
                />}

                {activeTool === "design" && (
                  <DesignPanel
                    sport={activeSport}
                    collar={collar}
                    setCollar={setCollar}
                    sleeve={sleeve}
                    setSleeve={setSleeve}
                    colors={colors}
                    setColors={setColors}
                    onHoverZone={setHoverZone}
                    twoTone={twoTone}
                    setTwoTone={setTwoTone}
                  />
                )}
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
                  />
                )}
                {activeTool === "text" && <TextPanel onAdd={armTextPlacement} armed={pendingLayer?.type === "text"} />}
                {activeTool === "logo" && <LogoPanel onUpload={armLogoPlacement} armed={pendingLayer?.type === "logo"} />}
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
                {activeTool === "options" && (
                  <OptionsPanel
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
                  />
                )}
                {activeTool === "roster" && (
                  <RosterTool
                    bottomLabel={sportConfig.bottomLabel}
                    hasSocks={sportConfig.hasSocks}
                    sleeveOptions={sportConfig.sleeveOptions}
                    rosterEntry={rosterEntry}
                    setRosterEntry={setRosterEntry}
                    roster={roster}
                    addToRoster={addToRoster}
                    importRosterCsv={importRosterCsv}
                    removeFromRoster={removeFromRoster}
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
                    setFanJerseyAdded={setFanJerseyAdded}
                    onRequestQuote={handleRequestQuote}
                    submitting={submittingQuote}
                    error={quoteError}
                    onEditStep={(tool) => setActiveTool(tool)}
                    onView3d={() => setStageMode("3d")}
                  />
                )}
                </div>
              </aside>
      </div>

      {/* Mobile: the fields panel docks to the bottom instead of the side */}
      <div className="md:hidden flex-shrink-0 max-h-[42dvh] overflow-y-auto overscroll-contain border-t border-background-200/60 bg-background-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SelectedItemPanel
          layer={selectedLayer}
          placement={selectedLayerId ? placements3d[selectedLayerId] : null}
          onTextChange={(id, text) => updateLayer(id, { text })}
          onColorChange={(id, color) => updateLayer(id, { color })}
          onScaleChange={stageMode === "3d" ? setLayerScale : setLayerSize2d}
          onRotateChange={stageMode === "3d" ? rotateLayer : rotateLayer2d}
          onDelete={removeLayer}
        />

        {activeTool === "design" && (
          <DesignPanel
            sport={activeSport}
            collar={collar}
            setCollar={setCollar}
            sleeve={sleeve}
            setSleeve={setSleeve}
            colors={colors}
            setColors={setColors}
            onHoverZone={setHoverZone}
            twoTone={twoTone}
            setTwoTone={setTwoTone}
          />
        )}
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
          />
        )}
        {activeTool === "text" && <TextPanel onAdd={armTextPlacement} armed={pendingLayer?.type === "text"} />}
        {activeTool === "logo" && <LogoPanel onUpload={armLogoPlacement} armed={pendingLayer?.type === "logo"} />}
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
        {activeTool === "options" && (
          <OptionsPanel
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
          />
        )}
        {activeTool === "roster" && (
          <RosterTool
            bottomLabel={sportConfig.bottomLabel}
            hasSocks={sportConfig.hasSocks}
            sleeveOptions={sportConfig.sleeveOptions}
            rosterEntry={rosterEntry}
            setRosterEntry={setRosterEntry}
            roster={roster}
            addToRoster={addToRoster}
            importRosterCsv={importRosterCsv}
            removeFromRoster={removeFromRoster}
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
            setFanJerseyAdded={setFanJerseyAdded}
            onRequestQuote={handleRequestQuote}
            submitting={submittingQuote}
            error={quoteError}
            onEditStep={(tool) => setActiveTool(tool)}
            onView3d={() => setStageMode("3d")}
          />
        )}
      </div>

      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-white/[0.07] bg-[#0c0d0b]/95 px-4 py-2.5 pb-[max(.625rem,env(safe-area-inset-bottom))] sm:px-6">
        <button
          type="button"
          onClick={backWorkflow}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-background-50/65 transition hover:bg-white/[0.06] hover:text-background-50 cursor-pointer"
        >
          <i className="ri-arrow-left-line" />
          {workflowIndex === 0 ? "Change sport or style" : studioWorkflow[workflowIndex - 1].label}
        </button>
        <div className="hidden text-center md:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-background-50/35">
            Step {workflowStep.step} of {studioWorkflow.length}
          </p>
          <p className="text-xs font-semibold text-background-50/65">{workflowStep.label}</p>
        </div>
        {workflowIndex < studioWorkflow.length - 1 ? (
          <button
            type="button"
            onClick={continueWorkflow}
            disabled={workflowStep.key === "roster" && roster.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,116,73,0.22)] transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
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

function RosterTool({
  bottomLabel = "Shorts",
  hasSocks = false,
  sleeveOptions = [],
  rosterEntry,
  setRosterEntry,
  roster,
  addToRoster,
  importRosterCsv,
  removeFromRoster,
}) {
  const unitCount = rosterUnitCount(roster);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const rosterFileRef = useRef(null);

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
      `${bottomLabel} Number`,
      "Shirt Size",
      `${bottomLabel} Size`,
      "Sock Size",
      "Bottom Length",
      "Sleeve Preference",
      "Role",
      "Quantity",
      "Notes",
    ];
    const example = ["Alex James", "10", "10", "AM", "AM", "Medium", "Regular", "Short", "Player", "1", "Captain"];
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
      <p className="text-xs text-foreground-500 font-label mb-4">
        Add one row per player, or import the complete team from a CSV file.
      </p>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
          Team roster
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

      <div className="grid grid-cols-2 gap-2 mb-4">
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
        >
          Import CSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon="ri-download-line"
          iconPosition="left"
          onClick={downloadRosterTemplate}
        >
          CSV template
        </Button>
      </div>
      {importMessage && (
        <p className="text-[11px] font-label text-primary-700 mb-4" role="status">
          {importMessage}
        </p>
      )}

      {showSizeGuide && (
        <div className="mb-4 rounded-xl border border-background-200/70 overflow-hidden">
          <table className="w-full text-xs font-label">
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
                ["YS", "26–28", "22–24", "48–52"],
                ["YM", "28–30", "24–26", "52–56"],
                ["YL", "30–32", "26–28", "56–60"],
                ["AS", "34–36", "28–30", "65–68"],
                ["AM", "38–40", "31–33", "68–70"],
                ["AL", "42–44", "34–36", "70–72"],
                ["AXL", "46–48", "37–39", "72–74"],
                ["A2XL", "50–52", "40–42", "74–76"],
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

      <div className="space-y-3 mb-4">
        <Input
          placeholder="Player name"
          value={rosterEntry.name}
          onChange={(e) => setRosterEntry((r) => ({ ...r, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Shirt #"
            value={rosterEntry.number}
            onChange={(e) => setRosterEntry((r) => ({ ...r, number: e.target.value }))}
          />
          <Input
            placeholder={`${bottomLabel} #`}
            value={rosterEntry.shortsNumber}
            onChange={(e) => setRosterEntry((r) => ({ ...r, shortsNumber: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">Shirt size</span>
            <Select
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
              {bottomLabel} size
            </span>
            <Select
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
        <div className="grid grid-cols-2 gap-2">
          {hasSocks && (
            <div>
              <span className="text-[11px] font-label text-foreground-500 block mb-1">Sock size</span>
              <Select
                value={rosterEntry.sockSize}
                onChange={(e) => setRosterEntry((r) => ({ ...r, sockSize: e.target.value }))}
              >
                {sockSizeOptions.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
          )}
          <div className={hasSocks ? "" : "col-span-2"}>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">
              {bottomLabel} length
            </span>
            <Select
              value={rosterEntry.bottomLength}
              onChange={(e) => setRosterEntry((r) => ({ ...r, bottomLength: e.target.value }))}
            >
              {bottomLengthOptions.map((length) => (
                <option key={length} value={length}>{length}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">Role</span>
            <Select
              value={rosterEntry.role}
              onChange={(e) => setRosterEntry((r) => ({ ...r, role: e.target.value }))}
            >
              {playerRoleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </Select>
          </div>
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">Quantity</span>
            <Input
              type="number"
              min="1"
              max="99"
              value={rosterEntry.quantity}
              onChange={(e) => setRosterEntry((r) => ({ ...r, quantity: e.target.value }))}
            />
          </div>
        </div>
        {sleeveOptions?.length > 0 && (
          <div>
            <span className="text-[11px] font-label text-foreground-500 block mb-1">
              Player sleeve preference
            </span>
            <Select
              value={rosterEntry.sleevePreference}
              onChange={(e) => setRosterEntry((r) => ({ ...r, sleevePreference: e.target.value }))}
            >
              <option value="Team selection">Team selection</option>
              {sleeveOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
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
        onClick={addToRoster}
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
                {entry.shortsNumber && (
                  <span className="text-foreground-400">
                    ({bottomLabel.toLowerCase()} #{entry.shortsNumber})
                  </span>
                )}{" "}
                <span className="text-foreground-400 font-label">
                  · shirt {entry.shirtSize} / {bottomLabel.toLowerCase()} {entry.shortSize}
                </span>
                {entry.quantity > 1 && (
                  <span className="text-primary-700 font-semibold"> · qty {entry.quantity}</span>
                )}
                {(entry.sockSize || entry.bottomLength || entry.sleevePreference) && (
                  <span className="block text-foreground-400 font-label mt-0.5">
                    {hasSocks && entry.sockSize ? `socks ${entry.sockSize} · ` : ""}
                    {entry.bottomLength || "Regular"} length
                    {entry.sleevePreference && entry.sleevePreference !== "Team selection"
                      ? ` · ${entry.sleevePreference} sleeve`
                      : ""}
                    {entry.role && entry.role !== "Player" ? ` · ${entry.role}` : ""}
                  </span>
                )}
              </span>
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

      <div className={`rounded-xl border p-4 ${roster.length ? "border-primary-200 bg-primary-50" : "border-background-300 bg-background-100/60"}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${roster.length ? "bg-primary-600 text-white" : "bg-background-200 text-foreground-400"}`}>
            <i className={roster.length ? "ri-check-line" : "ri-team-line"} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-900">
              {roster.length ? `${unitCount} kit${unitCount === 1 ? "" : "s"} ready for review` : "Add at least one player"}
            </p>
            <p className="text-[11px] font-label text-foreground-500">
              {roster.length ? "Use Continue to Review below to confirm the order." : "The Review step unlocks after the first roster entry."}
            </p>
          </div>
        </div>
      </div>
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
  setFanJerseyAdded,
  onRequestQuote,
  submitting,
  error,
  onEditStep,
  onView3d,
}) {
  const unitCount = rosterUnitCount(roster);
  const kitsTotal = unitPrice * unitCount;
  const grandTotal = kitsTotal + (fanJerseyAdded ? FAN_JERSEY_PRICE : 0);
  const sportLabel = sports.find((sport) => sport.slug === activeSport)?.label || activeSport;
  const [config, setConfig] = useState(null);
  const [totals, setTotals] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [cardSession, setCardSession] = useState(null);
  const [startingCard, setStartingCard] = useState(false);
  const [placingLocalOrder, setPlacingLocalOrder] = useState(false);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim());
  const shippingComplete = Boolean(
    shipping.firstName.trim() && shipping.lastName.trim() && shipping.address1.trim() &&
    shipping.city.trim() && shipping.postcode.trim() && shipping.country.trim() &&
    (shipping.country !== "US" || shipping.state.trim())
  );
  const canCheckout = roster.length > 0 && emailValid && shippingComplete;

  useEffect(() => {
    getCheckoutConfig()
      .then(setConfig)
      .catch(() => setConfig({ stripeEnabled: false, paypalEnabled: false }));
  }, []);

  useEffect(() => {
    setTotals(null);
    setCardSession(null);
  }, [fanJerseyAdded, unitCount, unitPrice]);

  useEffect(() => {
    if (!import.meta.env.DEV || !window.location.search.includes("preview=checkout") || !canCheckout || totals) return;
    setCalculating(true);
    quoteUniformCheckout({ ...orderPayload, fanJerseyAdded, grandTotal }, contact.email, shipping)
      .then(setTotals)
      .catch((err) => setCheckoutError(err.message || "Couldn't calculate the preview total."))
      .finally(() => setCalculating(false));
  }, [canCheckout, totals]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateShipping = (field) => (event) => {
    setShipping((current) => ({ ...current, [field]: event.target.value }));
    setTotals(null);
    setCardSession(null);
  };

  const completeOrderPayload = async () => ({
    ...orderPayload,
    fanJerseyAdded,
    grandTotal,
    previewImage: await capturePreview(),
  });

  const calculateTotal = async () => {
    if (!canCheckout) {
      setCheckoutError("Enter a valid email and complete the delivery address first.");
      return;
    }
    setCalculating(true);
    setCheckoutError(null);
    try {
      setTotals(await quoteUniformCheckout({ ...orderPayload, fanJerseyAdded, grandTotal }, contact.email, shipping));
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
      setCardSession(await createUniformPaymentIntent(await completeOrderPayload(), contact.email, shipping));
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
        contact.email,
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
        <button
          type="button"
          onClick={onView3d}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary-300 bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-800 transition hover:-translate-y-0.5 hover:border-primary-500 hover:bg-primary-100 cursor-pointer"
        >
          <i className="ri-3d-cube-sphere-line text-sm" />
          View uniform design in 3D
        </button>
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
          title="Kit options"
          value={`${kitType} kit · ${logoApplication}`}
          meta={`Estimated unit price $${unitPrice.toFixed(2)}`}
          onEdit={() => onEditStep("options")}
        />
        <ReviewRow
          icon="ri-team-line"
          title="Roster"
          value={`${unitCount} kit${unitCount === 1 ? "" : "s"} · ${roster.length} player row${roster.length === 1 ? "" : "s"}`}
          meta={roster.length ? roster.slice(0, 3).map((entry) => entry.name).join(", ") + (roster.length > 3 ? "…" : "") : "No players added"}
          onEdit={() => onEditStep("roster")}
        />
      </div>

      <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-background-300 bg-background-100/55 p-3.5">
        <input
          type="checkbox"
          className="mt-1 rounded border-background-300"
          checked={fanJerseyAdded}
          onChange={(event) => setFanJerseyAdded(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-foreground-900">Add a supporter jersey</span>
          <span className="mt-0.5 block text-[11px] font-label text-foreground-500">
            One fan jersey using this team design (+${FAN_JERSEY_PRICE.toFixed(2)})
          </span>
        </span>
      </label>

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
          <div className="flex justify-between"><span>{unitCount} kits × ${unitPrice.toFixed(2)}</span><span>${kitsTotal.toFixed(2)}</span></div>
          {fanJerseyAdded && <div className="flex justify-between"><span>Supporter jersey</span><span>${FAN_JERSEY_PRICE.toFixed(2)}</span></div>}
          <div className="flex justify-between"><span>Subtotal</span><span>${(totals?.subtotal ?? grandTotal).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{totals ? `$${totals.tax.toFixed(2)}` : "—"}</span></div>
          <div className="flex justify-between"><span>{totals?.shippingLabel || "Shipping"}</span><span>{totals ? `$${totals.shipping.toFixed(2)}` : "—"}</span></div>
          {totals && <div className="mt-2 flex justify-between border-t border-white/15 pt-2 text-sm font-bold"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>}
        </div>
      </div>

      <div className="border-t border-background-200 pt-5">
        <h3 className="text-sm font-semibold text-foreground-900">Order contact</h3>
        <p className="mb-3 mt-1 text-[11px] font-label text-foreground-500">
          We send the receipt, production proof and order updates here.
        </p>
        <div className="space-y-2">
          <Input
            placeholder="Your name *"
            aria-label="Your name"
            value={contact.name}
            onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email address *"
            aria-label="Email address"
            value={contact.email}
            onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Phone"
              aria-label="Phone number"
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

      <div className="mt-5 border-t border-background-200 pt-5">
        <h3 className="text-sm font-semibold text-foreground-900">Delivery address</h3>
        <p className="mb-3 mt-1 text-[11px] font-label text-foreground-500">Tax and shipping are calculated from this address before payment.</p>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="First name *" aria-label="Shipping first name" autoComplete="given-name" value={shipping.firstName} onChange={updateShipping("firstName")} />
          <Input placeholder="Last name *" aria-label="Shipping last name" autoComplete="family-name" value={shipping.lastName} onChange={updateShipping("lastName")} />
          <Input className="col-span-2" placeholder="Company (optional)" aria-label="Shipping company" autoComplete="organization" value={shipping.company} onChange={updateShipping("company")} />
          <Input className="col-span-2" placeholder="Street address *" aria-label="Shipping street address" autoComplete="address-line1" value={shipping.address1} onChange={updateShipping("address1")} />
          <Input className="col-span-2" placeholder="Apartment, suite or unit" aria-label="Shipping address line two" autoComplete="address-line2" value={shipping.address2} onChange={updateShipping("address2")} />
          <Input placeholder="City *" aria-label="Shipping city" autoComplete="address-level2" value={shipping.city} onChange={updateShipping("city")} />
          <Input placeholder={shipping.country === "US" ? "State *" : "Region / parish"} aria-label="Shipping region" autoComplete="address-level1" value={shipping.state} onChange={updateShipping("state")} />
          <Input placeholder="Postal code *" aria-label="Shipping postal code" autoComplete="postal-code" value={shipping.postcode} onChange={updateShipping("postcode")} />
          <Select aria-label="Shipping country" value={shipping.country} onChange={updateShipping("country")}>
            <option value="DM">Dominica</option>
            <option value="US">United States</option>
          </Select>
        </div>
        <Button type="button" variant="secondary" className="mt-3 w-full" onClick={calculateTotal} disabled={!canCheckout || calculating} icon="ri-calculator-line">
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

        {totals && (
          <div className="mb-4 rounded-2xl border border-background-200 bg-background-50 p-3.5">
            <h3 className="mb-3 text-sm font-semibold text-foreground-900">Choose payment method</h3>
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
                  const result = await createUniformPaypalOrder(await completeOrderPayload(), contact.email, shipping);
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

        <Button type="button" variant="secondary" disabled={roster.length === 0 || submitting} onClick={onRequestQuote} icon="ri-file-list-3-line" className="w-full">
          {submitting ? "Submitting…" : "Request a quote instead"}
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

