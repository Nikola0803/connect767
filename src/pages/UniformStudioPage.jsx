import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import * as THREE from "three";
import {
  sports,
  templates,
  defaultZoneColors,
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
  TextPanel,
  LogoPanel,
  LayersPanel,
  OptionsPanel,
  SkinsPanel,
} from "../components/uniform-studio/StudioPanels";
import { skinDataUri } from "../data/skins";
import Button from "../components/ui/Button";
import Tooltip from "../components/ui/Tooltip";
import SelectedItemPanel from "../components/uniform-studio/SelectedItemPanel";
import { Input, Select, Textarea } from "../components/ui/FormField";
import DemoModeNotice from "../components/DemoModeNotice";
import { isLiveApi } from "../lib/config";
import { submitUniformQuote } from "../data/repository";

const tools = [
  {
    key: "design",
    label: "Design",
    icon: "ri-palette-line",
    hint: "Collar, sleeve length and the colour of every panel. Hover a colour to highlight the part it changes.",
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
  { key: "design", label: "Design", step: 3, defaultTool: "design", tools: ["design"] },
  { key: "artwork", label: "Artwork", step: 4, defaultTool: "logo", tools: ["text", "logo", "skins", "layers"] },
  { key: "options", label: "Kit options", step: 5, defaultTool: "options", tools: ["options"] },
  { key: "roster", label: "Roster", step: 6, defaultTool: "roster", tools: ["roster"] },
  { key: "review", label: "Review", step: 7, defaultTool: "review", tools: ["review"] },
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

  // ---------- Design state ----------
  const [collar, setCollar] = useState("Crew");
  const [sleeve, setSleeve] = useState("Short");
  const [colors, setColors] = useState(defaultZoneColors);
  const [view, setView] = useState("front");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [activeTool, setActiveTool] = useState(
    studioWorkflow.find((step) => step.key === initialWorkflowStep)?.defaultTool || "design"
  );
  const [zoom, setZoom] = useState(1);
  const [hoverZone, setHoverZone] = useState(null);
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
  // baseball, cricket — rendered the same GLB. Keyed off the active sport
  // now, so switching the sport tab actually switches the garment.
  const studioProductType = useMemo(
    () => ({
      slug: activeSport,
      modelUrl: sportModelUrl(activeSport),
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
  const [submitted, setSubmitted] = useState(false);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [exporting, setExporting] = useState(false);

  const visibleTemplates = useMemo(
    () => templates.filter((t) => t.sportSlug === activeSport && t.slug !== "blank-canvas"),
    [activeSport]
  );
  const template = templates.find((t) => t.slug === selectedTemplate);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const sportConfig = sportConfigFor(activeSport);
  const workflowIndex = Math.max(
    0,
    studioWorkflow.findIndex((step) => step.tools.includes(activeTool))
  );
  const workflowStep = studioWorkflow[workflowIndex];

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

  const handleSportChange = (slug) => {
    setActiveSport(slug);
    setSelectedTemplate(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sport", slug);
      return next;
    });
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

  useEffect(() => {
    if (!storageKey) return;
    // Nothing designed yet — don't write an empty record over a real saved one.
    if (!layers.length && !Object.keys(placements3d).length) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ layers, placements3d, colors, collar, sleeve, savedAt: Date.now() }),
      );
    } catch {
      /* private browsing / quota — the design just won't persist, which is
         no worse than before this existed */
    }
  }, [storageKey, layers, placements3d, colors, collar, sleeve]);

  const restoreSaved = (key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved?.layers?.length && !Object.keys(saved?.placements3d || {}).length) return false;
      setLayers(saved.layers || []);
      setPlacements3d(saved.placements3d || {});
      if (saved.colors) setColors(saved.colors);
      if (saved.collar) setCollar(saved.collar);
      if (saved.sleeve) setSleeve(saved.sleeve);
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
      trim,
      shirtStrip: trim,
      sleeveStrip: trim,
      shortsStrip: trim,
      panel: accent,
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

  const selectTemplate = (t) => {
    setSelectedTemplate(t.slug);
    setCollar(t.defaultCollar || sportConfig.collarOptions[0]);
    setSleeve(t.defaultSleeve || sportConfig.sleeveOptions?.[0] || "Sleeveless");
    // Pick up where they left off on this exact kit, if they were here before.
    const restored = restoreSaved(`c767:studio:${activeSport}:${t.slug}`);
    if (!restored) {
      setColors({ ...defaultZoneColors, ...(t.defaultColors || {}) });
    }
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
      src: skinDataUri(skinKey, colors.body, colors.trim),
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
      view,
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
        src: skinDataUri(skinKey, colors.body, colors.trim),
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
        const src = skinDataUri(l.skinKey, colors.body, colors.trim);
        if (src === l.src) return l;
        changed = true;
        return { ...l, src };
      });
      return changed ? next : ls;
    });
  }, [colors.body, colors.trim]);

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
      link.download = `${template?.name || "jersey"}-${view}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      /* export best-effort — canvas export can fail on some browsers with
         cross-origin images; the design itself is unaffected either way */
    } finally {
      setExporting(false);
    }
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
      const unitCount = rosterUnitCount(roster);
      const grandTotal = unitPrice * unitCount + (fanJerseyAdded ? FAN_JERSEY_PRICE : 0);
      await submitUniformQuote({
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
        grandTotal,
        layers,
        // The artwork's real position on the garment. Without this the whole
        // 3D configurator was decorative: production received layers still
        // carrying their default flat-editor coordinates, so a crest dragged
        // onto the left chest arrived dead-centre.
        placements3d,
        // Tells production which coordinate system to trust for each layer.
        designMode: stageMode === "3d" ? "3d" : "flat",
        roster,
        contact,
        previewImage: preview,
      });
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
    const activeSportMeta = sports.find((sport) => sport.slug === activeSport) || sports[0];

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
            <ol className="grid grid-cols-4 overflow-hidden rounded-2xl border border-background-300 bg-background-50 shadow-sm sm:grid-cols-7">
              {["Sport", "Style", "Design", "Artwork", "Options", "Roster", "Review"].map((label, index) => (
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

          <section className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-[26px] border border-background-300/80 bg-background-50/95 p-5 shadow-[0_18px_50px_rgba(69,48,30,0.07)] lg:sticky lg:top-5 lg:self-start">
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">
                Step 1
              </p>
              <h2 className="mt-1 font-heading text-2xl font-semibold">Choose your sport</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground-500">
                We tailor garment options and roster fields to each sport.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
                {sports.map((sport) => {
                  const selected = activeSport === sport.slug;
                  return (
                    <button
                      key={sport.slug}
                      type="button"
                      onClick={() => handleSportChange(sport.slug)}
                      className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition duration-200 cursor-pointer ${
                        selected
                          ? "border-primary-500 bg-primary-600 text-white shadow-[0_10px_24px_rgba(0,116,73,0.18)]"
                          : "border-background-200 bg-background-50 text-foreground-700 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50"
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white/15" : "bg-primary-100 text-primary-800"}`}>
                        <i className={`${sport.icon} text-lg`} />
                      </span>
                      <span className="text-sm font-semibold">{sport.label}</span>
                      <i className={`ri-arrow-right-s-line ml-auto ${selected ? "text-white/80" : "text-foreground-300 group-hover:text-primary-700"}`} />
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="rounded-[26px] border border-background-300/80 bg-background-50/95 p-5 shadow-[0_18px_50px_rgba(69,48,30,0.07)] sm:p-7">
              <div className="mb-6 flex flex-col gap-3 border-b border-background-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary-700">
                    Step 2 · {activeSportMeta.label}
                  </p>
                  <h2 className="mt-1 font-heading text-2xl font-semibold sm:text-3xl">
                    Select a starting point
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-foreground-500">
                  Pick a proven cut or begin with a clean canvas. Every color, logo and detail remains editable.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleTemplates.map((uniformTemplate) => (
                  <button
                    key={uniformTemplate.slug}
                    type="button"
                    onClick={() => selectTemplate(uniformTemplate)}
                    className="group overflow-hidden rounded-2xl border border-background-300 bg-background-50 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary-400 hover:shadow-[0_18px_38px_rgba(0,116,73,0.11)] cursor-pointer"
                  >
                    <div className="relative flex h-56 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#ffffff_0%,#f5efe3_72%)] p-4">
                      <span className="absolute left-4 top-4 rounded-full border border-background-300 bg-background-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-800">
                        Template
                      </span>
                      <img
                        src={uniformTemplate.image}
                        alt={`${uniformTemplate.name} ${activeSportMeta.label} uniform template`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain drop-shadow-[0_18px_20px_rgba(25,40,32,0.16)] transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-heading text-xl font-semibold">{uniformTemplate.name}</h3>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800 transition group-hover:bg-primary-600 group-hover:text-white">
                          <i className="ri-arrow-right-line" />
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground-500">
                        {uniformTemplate.description}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-foreground-600">
                        <span className="rounded-full bg-background-100 px-2.5 py-1">{uniformTemplate.defaultCollar}</span>
                        <span className="rounded-full bg-background-100 px-2.5 py-1">{uniformTemplate.defaultSleeve} sleeve</span>
                      </div>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => selectTemplate({ slug: "blank-canvas" })}
                  className="group flex min-h-[340px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/55 p-7 text-center transition duration-200 hover:-translate-y-1 hover:border-primary-500 hover:bg-primary-100/70 hover:shadow-[0_18px_38px_rgba(0,116,73,0.1)] cursor-pointer"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-3xl text-white shadow-[0_12px_25px_rgba(0,116,73,0.22)] transition-transform duration-200 group-hover:rotate-3 group-hover:scale-105">
                    <i className="ri-add-line" />
                  </span>
                  <h3 className="mt-5 font-heading text-2xl font-semibold">Design from scratch</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-foreground-500">
                    Start clean and build a completely original {activeSportMeta.label.toLowerCase()} uniform.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary-800">
                    Open blank canvas <i className="ri-arrow-right-line" />
                  </span>
                </button>
              </div>

              <div className="mt-6 grid gap-3 border-t border-background-200 pt-5 sm:grid-cols-3">
                {[
                  ["ri-image-add-line", "Upload artwork", "PNG, JPG or SVG logos"],
                  ["ri-3d-cube-sphere-line", "Preview in 3D", "Load only when you need it"],
                  ["ri-team-line", "Build the roster", "Names, sizes and quantities"],
                ].map(([icon, title, description]) => (
                  <div key={title} className="flex items-start gap-3 rounded-xl bg-background-100/65 p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800">
                      <i className={icon} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-0.5 text-xs text-foreground-500">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ---------- The studio itself: one full viewport, nothing else ----------
  return (
    <div className="h-[100dvh] flex flex-col bg-[#14110d] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 md:px-6 py-3 pt-[max(.75rem,env(safe-area-inset-top))] border-b border-white/[0.06] flex-shrink-0">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-2 text-sm font-semibold text-background-50/70 hover:text-background-50 cursor-pointer"
        >
          <i className="ri-arrow-left-line" />
          Back
        </button>
        <span className="text-xs font-label text-background-50/40 truncate">
          {template?.name || "Blank Canvas"} · {sports.find((s) => s.slug === activeSport)?.label}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={stageMode === "3d"}
            onClick={() => setStageMode((mode) => (mode === "3d" ? "edit" : "3d"))}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
        className="flex-shrink-0 border-b border-white/[0.08] bg-[#1b1712] px-3 py-2 sm:px-5"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto">
          <div className="hidden items-center gap-1 text-background-50/35 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
              <i className="ri-check-line" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Sport</span>
            <i className="ri-arrow-right-s-line mx-1" />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
              <i className="ri-check-line" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Style</span>
            <i className="ri-arrow-right-s-line mx-1" />
          </div>
          {studioWorkflow.map((step, index) => {
            const active = index === workflowIndex;
            const complete = index < workflowIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => openWorkflowStep(index)}
                className={`group flex flex-shrink-0 items-center gap-2 rounded-full px-3 py-2 transition cursor-pointer ${
                  active
                    ? "bg-primary-600 text-white shadow-[0_8px_20px_rgba(0,116,73,0.25)]"
                    : complete
                      ? "text-primary-300 hover:bg-white/[0.06]"
                      : "text-background-50/45 hover:bg-white/[0.06] hover:text-background-50/75"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${active ? "bg-white/15" : complete ? "bg-primary-700 text-white" : "bg-white/[0.07]"}`}>
                  {complete ? <i className="ri-check-line" /> : step.step}
                </span>
                <span className="text-xs font-semibold whitespace-nowrap">{step.label}</span>
              </button>
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

      <div className="flex-1 min-h-0 flex">
                  {/* Icon rail — desktop only; mobile gets the pill row below the canvas */}
                  <div className="hidden lg:flex flex-col items-center gap-1 py-4 px-2 border-r border-white/[0.06] flex-shrink-0 overflow-y-auto">
                    {tools.map((t) => (
                      <Tooltip key={t.key} label={t.label} description={t.hint} placement="right">
                        <button
                          type="button"
                          aria-label={t.label}
                          onClick={() => setActiveTool(t.key)}
                          className={`w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl cursor-pointer transition-colors flex-shrink-0 ${
                            activeTool === t.key
                              ? "bg-accent-500 text-background-50"
                              : "text-background-50/45 hover:bg-white/5 hover:text-background-50/85"
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
                  <div className="flex-1 min-w-0 flex flex-col items-center gap-3 px-4 md:px-8 py-4 overflow-hidden">
                    {/* Top bar: view thumbnails + zoom/export, inline instead of a separate row above the card */}
                    <div className="w-full flex items-center justify-between gap-2 flex-shrink-0">
                      {ENABLE_3D && (
                        <div
                          className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-1"
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
                      {stageMode === "edit" && (
                        <div className="inline-flex items-center gap-1 bg-white/5 rounded-lg px-1 py-1">
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
                          className="w-full max-w-sm transition-transform"
                          style={{ transform: `scale(${zoom})` }}
                        >
                          <JerseyStage
                            ref={stageRef}
                            sport={activeSport}
                            view={view}
                            collar={collar}
                            sleeve={sleeve}
                            colors={colors}
                            highlightZone={hoverZone}
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
                      {tools.map((t) => (
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
              <div className="w-full max-w-[400px] flex-shrink-0 border-l border-background-200/60 bg-background-50 p-5 overflow-y-auto hidden md:block">
                <SelectedItemPanel
                  layer={selectedLayer}
                  placement={selectedLayerId ? placements3d[selectedLayerId] : null}
                  onTextChange={(id, text) => updateLayer(id, { text })}
                  onColorChange={(id, color) => updateLayer(id, { color })}
                  onFontChange={(id, fontFamily) => updateLayer(id, { fontFamily })}
                  onGradientChange={(id, patch) => updateLayer(id, patch)}
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
                {activeTool === "text" && <TextPanel onAdd={armTextPlacement} armed={pendingLayer?.type === "text"} />}
                {activeTool === "logo" && <LogoPanel onUpload={armLogoPlacement} armed={pendingLayer?.type === "logo"} />}
                {activeTool === "skins" && (
                  <SkinsPanel
                    colorA={colors.body}
                    colorB={colors.trim}
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
        {activeTool === "text" && <TextPanel onAdd={armTextPlacement} armed={pendingLayer?.type === "text"} />}
        {activeTool === "logo" && <LogoPanel onUpload={armLogoPlacement} armed={pendingLayer?.type === "logo"} />}
        {activeTool === "skins" && (
          <SkinsPanel
            colorA={colors.body}
            colorB={colors.trim}
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

      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-white/[0.08] bg-[#1b1712] px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <button
          type="button"
          onClick={backWorkflow}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-background-50/65 transition hover:bg-white/[0.06] hover:text-background-50 cursor-pointer"
        >
          <i className="ri-arrow-left-line" />
          {workflowIndex === 0 ? "Change style" : studioWorkflow[workflowIndex - 1].label}
        </button>
        <div className="hidden text-center md:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-background-50/35">
            Step {workflowStep.step} of 7
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
          Confirm the design and roster, then send the order for a production proof and final invoice.
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
              Estimated order total
            </p>
            <p className="mt-1 font-heading text-3xl font-semibold">${grandTotal.toFixed(2)}</p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-background-50/75">
            Final after proof
          </span>
        </div>
        <div className="mt-3 space-y-1 border-t border-white/15 pt-3 text-xs text-background-50/70">
          <div className="flex justify-between"><span>{unitCount} kits × ${unitPrice.toFixed(2)}</span><span>${kitsTotal.toFixed(2)}</span></div>
          {fanJerseyAdded && <div className="flex justify-between"><span>Supporter jersey</span><span>${FAN_JERSEY_PRICE.toFixed(2)}</span></div>}
        </div>
      </div>

      <div className="border-t border-background-200 pt-5">
        <h3 className="text-sm font-semibold text-foreground-900">Order contact</h3>
        <p className="mb-3 mt-1 text-[11px] font-label text-foreground-500">
          We send the production proof, final price and payment link here.
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

      <div className="pt-4">
        {!isLiveApi && <DemoModeNotice className="mb-3" />}
        {error && (
          <p className="mb-3 flex items-start gap-1.5 text-xs font-label text-accent-600">
            <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={roster.length === 0 || submitting}
          onClick={onRequestQuote}
          icon="ri-arrow-right-line"
          className="w-full"
        >
          {submitting ? "Submitting…" : "Submit team order request"}
        </Button>
        <p className="mt-2 text-center text-[10px] font-label leading-relaxed text-foreground-400">
          No payment is taken now. You approve the production proof and final invoice before manufacturing begins.
        </p>
      </div>
    </div>
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

