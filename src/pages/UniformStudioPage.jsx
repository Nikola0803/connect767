import { useEffect, useMemo, useRef, useState } from "react";
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
  kitUnitPrice,
  FAN_JERSEY_PRICE,
  sportConfigFor,
  sportModelUrl,
} from "../data/uniforms";
import JerseyStage from "../components/uniform-studio/JerseyStage";
import JerseyGraphic from "../components/uniform-studio/JerseyGraphic";
import FloatingToolbar from "../components/uniform-studio/FloatingToolbar";
import Product3DStage from "../components/product-customizer/garment3d/Product3DStage";
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
];

/**
 * The 3D configurator is switched OFF for customers.
 *
 * Decision (client, this round): the flat editor is what people expect from a
 * kit builder and is easier to explain — the 3D view tested as fiddly to
 * place artwork in and unfamiliar to non-technical customers.
 *
 * Every 3D component is deliberately LEFT IN PLACE and still imported: decals
 * that conform to the garment, click-to-place, the two-tone/gradient shader,
 * and the WebGL screenshot used for the order preview. Flipping this back to
 * `true` restores the Edit/3D toggle with no other change. Nothing was
 * deleted, so this is reversible in one line.
 */
const ENABLE_3D = false;

let layerIdCounter = 0;
const nextLayerId = () => `layer-${Date.now()}-${layerIdCounter++}`;

export default function UniformStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSport = searchParams.get("sport") || "soccer";
  const scratch = searchParams.get("mode") === "scratch";

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
  const [activeTool, setActiveTool] = useState("design");
  const [zoom, setZoom] = useState(1);
  const [hoverZone, setHoverZone] = useState(null);
  const stageRef = useRef(null);
  // Set by Product3DStage's CaptureBridge while the 3D view is mounted.
  const capture3dRef = useRef(null);

  // ---------- 3D preview — reuses the same Three.js pipeline the generic
  // product customizer already has (GarmentModel/Product3DStage/
  // DesignCapture): a real rotating mesh with the customer's text/logo
  // layers baked on as a live texture, not a flat mockup. ----------
  // The 3D garment IS the studio — it opens live, no toggle to find. The flat
  // editor is still there behind the Edit button for fine positioning, but
  // it's the secondary surface now, not the entry point.
  const [stageMode, setStageMode] = useState(ENABLE_3D ? "3d" : "edit"); // '3d' | 'edit'

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
  const [rosterEntry, setRosterEntry] = useState({
    name: "",
    number: "",
    shortsNumber: "",
    shirtSize: "AM",
    shortSize: "AM",
  });
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
    () => templates.filter((t) => t.sportSlug === activeSport),
    [activeSport]
  );
  const template = templates.find((t) => t.slug === selectedTemplate);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const sportConfig = sportConfigFor(activeSport);

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
    restoreSaved(`c767:studio:${activeSport}:${t.slug}`);
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
    setRoster((r) => [...r, { ...rosterEntry, id: `${Date.now()}` }]);
    setRosterEntry({ name: "", number: "", shortsNumber: "", shirtSize: "AM", shortSize: "AM" });
  };
  const removeFromRoster = (id) => setRoster((r) => r.filter((entry) => entry.id !== id));

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
      const grandTotal = unitPrice * roster.length + (fanJerseyAdded ? FAN_JERSEY_PRICE : 0);
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
      <div className="h-screen flex items-center justify-center px-4">
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
            We've got your {roster.length}-shirt roster for the {template?.name || "Blank Canvas"}{" "}
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
    return (
      <div className="h-screen flex flex-col bg-background-50">
        <div className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-background-200/70 flex-shrink-0">
          <Button to="/" variant="ghost" size="sm" icon="ri-arrow-left-line" iconPosition="left">
            Back to site
          </Button>
          <span className="font-heading text-base font-medium text-foreground-950">
            Uniform Studio
          </span>
          <div className="w-24" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-5 md:px-8 py-3 border-b border-background-200/70 flex-shrink-0">
          {sports.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => handleSportChange(s.slug)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeSport === s.slug
                  ? "bg-primary-500 text-background-50 border-primary-500"
                  : "bg-background-50 text-foreground-700 border-background-200/70 hover:bg-background-100"
              }`}
            >
              <i className={s.icon} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-8 py-6">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleTemplates.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => selectTemplate(t)}
                className="text-left rounded-2xl border border-background-200/70 hover:border-primary-400 bg-background-50 p-4 transition-colors cursor-pointer"
              >
                <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-background-100 p-3">
                  <JerseyGraphic
                    view="front"
                    collar={t.defaultCollar}
                    sleeve={t.defaultSleeve}
                    colors={defaultZoneColors}
                  />
                </div>
                <h3 className="font-heading text-sm font-medium text-foreground-950">{t.name}</h3>
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectTemplate({ slug: "blank-canvas" })}
              className="rounded-2xl border-2 border-dashed border-background-300 hover:border-primary-400 bg-background-100/40 p-4 transition-colors cursor-pointer flex flex-col items-center justify-center text-center min-h-[180px]"
            >
              <i className="ri-add-circle-line text-3xl text-foreground-400 mb-2" />
              <h3 className="font-heading text-sm font-medium text-foreground-950">
                Design from scratch
              </h3>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- The studio itself: one full viewport, nothing else ----------
  return (
    <div className="h-screen flex flex-col bg-[#14110d] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
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
                    <div className="w-full flex items-center justify-end gap-2 flex-shrink-0">
                      {ENABLE_3D && (
                      <Tooltip
                        label={stageMode === "edit" ? "Switch to 3D" : "Switch to flat editor"}
                        description={
                          stageMode === "edit"
                            ? "Place artwork directly on the garment — click to position, drag to move, scroll to resize."
                            : "Lay the kit out flat for precise nudging, rotation and text editing."
                        }
                        placement="bottom"
                      >
                        <button
                          type="button"
                          onClick={() => setStageMode((m) => (m === "edit" ? "3d" : "edit"))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50"
                        >
                          <i className={stageMode === "edit" ? "ri-3d-cube-sphere-line" : "ri-edit-2-line"} />
                          {stageMode === "edit" ? "3D view" : "Edit"}
                        </button>
                      </Tooltip>
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
              <div className="w-full max-w-[340px] flex-shrink-0 border-l border-background-200/60 bg-background-50 p-5 overflow-y-auto hidden md:block">
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
                    contact={contact}
                    setContact={setContact}
                    rosterEntry={rosterEntry}
                    setRosterEntry={setRosterEntry}
                    roster={roster}
                    addToRoster={addToRoster}
                    removeFromRoster={removeFromRoster}
                    onRequestQuote={handleRequestQuote}
                    submitting={submittingQuote}
                    error={quoteError}
                    unitPrice={unitPrice}
                    fanJerseyAdded={fanJerseyAdded}
                    setFanJerseyAdded={setFanJerseyAdded}
                  />
                )}
              </div>
      </div>

      {/* Mobile: the fields panel docks to the bottom instead of the side */}
      <div className="md:hidden flex-shrink-0 max-h-[45vh] overflow-y-auto border-t border-background-200/60 bg-background-50 p-4">
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
            contact={contact}
            setContact={setContact}
            rosterEntry={rosterEntry}
            setRosterEntry={setRosterEntry}
            roster={roster}
            addToRoster={addToRoster}
            removeFromRoster={removeFromRoster}
            onRequestQuote={handleRequestQuote}
            submitting={submittingQuote}
            error={quoteError}
            unitPrice={unitPrice}
            fanJerseyAdded={fanJerseyAdded}
            setFanJerseyAdded={setFanJerseyAdded}
          />
        )}
      </div>
    </div>
  );
}

function RosterTool({
  bottomLabel = "Shorts",
  contact,
  setContact,
  rosterEntry,
  setRosterEntry,
  roster,
  addToRoster,
  removeFromRoster,
  onRequestQuote,
  submitting,
  error,
  unitPrice,
  fanJerseyAdded,
  setFanJerseyAdded,
}) {
  const kitsTotal = unitPrice * roster.length;
  const grandTotal = kitsTotal + (fanJerseyAdded ? FAN_JERSEY_PRICE : 0);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  return (
    <div>
      <p className="text-xs text-foreground-500 font-label mb-4">
        Add one row per player — the price below updates live as you add or remove people.
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

      <label className="flex items-center gap-2.5 text-xs font-label text-foreground-700 cursor-pointer py-3 border-t border-background-200/70">
        <input
          type="checkbox"
          className="rounded border-background-300"
          checked={fanJerseyAdded}
          onChange={(e) => setFanJerseyAdded(e.target.checked)}
        />
        Also add a Fan/Supporter Jersey for this design (+${FAN_JERSEY_PRICE.toFixed(2)})
      </label>

      <div className="rounded-xl bg-primary-950 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-label uppercase tracking-wide text-background-50/60">
            Grand Total
          </span>
          <span className="font-heading text-3xl font-semibold text-background-50">
            ${grandTotal.toFixed(2)}
          </span>
        </div>
        <div className="space-y-1 pt-3 border-t border-background-50/15">
          <div className="flex items-center justify-between text-xs text-background-50/70 font-label">
            <span>Unit price / kit</span>
            <span>${unitPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-background-50/70 font-label">
            <span>{roster.length} kit{roster.length === 1 ? "" : "s"} on roster</span>
            <span>${kitsTotal.toFixed(2)}</span>
          </div>
          {fanJerseyAdded && (
            <div className="flex items-center justify-between text-xs text-background-50/70 font-label">
              <span>Fan/Supporter Jersey</span>
              <span>${FAN_JERSEY_PRICE.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact details. The quote used to go out with none of these — the
          shop got a design and a roster and no way to reply. */}
      <div className="pt-4 border-t border-background-200/70">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-1">
          Where do we send the quote?
        </h3>
        <p className="text-[11px] text-foreground-500 font-label mb-3">
          We'll reply with pricing and a production proof — usually within one business day.
        </p>
        <div className="space-y-2">
          <Input
            placeholder="Your name *"
            aria-label="Your name"
            value={contact.name}
            onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email address *"
            aria-label="Email address"
            value={contact.email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Phone"
              aria-label="Phone number"
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            />
            <Input
              placeholder="Club / team"
              aria-label="Club or team name"
              value={contact.club}
              onChange={(e) => setContact((c) => ({ ...c, club: e.target.value }))}
            />
          </div>
          <Textarea
            rows={2}
            placeholder="Anything else we should know? (deadline, colours, sponsor placement…)"
            aria-label="Additional notes"
            value={contact.notes}
            onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
          />
        </div>
      </div>

      <div className="pt-4">
        {!isLiveApi && <DemoModeNotice className="mb-3" />}
        {error && (
          <p className="text-xs text-accent-600 font-label mb-3 flex items-start gap-1.5">
            <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="accent"
          disabled={roster.length === 0 || submitting}
          onClick={onRequestQuote}
          icon="ri-arrow-right-line"
          className="w-full"
        >
          {submitting ? "Sending…" : "Request quote"}
        </Button>
        {roster.length === 0 && (
          <p className="text-[11px] text-foreground-500 font-label mt-2 text-center">
            Add at least one player above to request a quote.
          </p>
        )}
      </div>
    </div>
  );
}

