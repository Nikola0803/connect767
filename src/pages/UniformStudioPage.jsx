import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toPng } from "html-to-image";
import {
  sports,
  templates,
  pricingTiers,
  faqs,
  defaultZoneColors,
  fontOptions,
  fitTypeOptions,
  kitTypeOptions,
  shirtSizeOptions,
  shortSizeOptions,
  kitUnitPrice,
  FAN_JERSEY_PRICE,
  sportConfigFor,
} from "../data/uniforms";
import JerseyStage from "../components/uniform-studio/JerseyStage";
import JerseyGraphic from "../components/uniform-studio/JerseyGraphic";
import FloatingToolbar from "../components/uniform-studio/FloatingToolbar";
import Product3DStage from "../components/product-customizer/garment3d/Product3DStage";
import DesignCapture from "../components/product-customizer/garment3d/DesignCapture";
import {
  DesignPanel,
  TextPanel,
  LogoPanel,
  LayersPanel,
  OptionsPanel,
} from "../components/uniform-studio/StudioPanels";
import Button from "../components/ui/Button";
import { Input, Select } from "../components/ui/FormField";
import DemoModeNotice from "../components/DemoModeNotice";
import { isLiveApi } from "../lib/config";
import { submitUniformQuote } from "../data/repository";

const tools = [
  { key: "design", label: "Design", icon: "ri-palette-line" },
  { key: "text", label: "Text", icon: "ri-font-size" },
  { key: "logo", label: "Logo", icon: "ri-image-add-line" },
  { key: "layers", label: "Layers", icon: "ri-stack-line" },
  { key: "options", label: "Options", icon: "ri-settings-4-line" },
  { key: "roster", label: "Roster", icon: "ri-team-line" },
];

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

  // ---------- 3D preview — reuses the same Three.js pipeline the generic
  // product customizer already has (GarmentModel/Product3DStage/
  // DesignCapture): a real rotating mesh with the customer's text/logo
  // layers baked on as a live texture, not a flat mockup. ----------
  const [stageMode, setStageMode] = useState("3d"); // 'edit' | '3d'
  const [textures, setTextures] = useState({});
  const handleTextureUpdate = (key, canvas) => setTextures((t) => ({ ...t, [key]: canvas }));
  const jerseyPlacements = useMemo(() => [{ key: "front", label: "Front" }, { key: "back", label: "Back" }], []);
  const jerseyProductType = useMemo(() => ({ slug: "jersey", placements: jerseyPlacements }), [jerseyPlacements]);

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

  const selectTemplate = (t) => {
    setSelectedTemplate(t.slug);
    setCollar(t.defaultCollar || sportConfig.collarOptions[0]);
    setSleeve(t.defaultSleeve || sportConfig.sleeveOptions?.[0] || "Sleeveless");
  };

  const selectLayer = (id) => {
    setSelectedLayerId(id);
    const layer = layers.find((l) => l.id === id);
    if (layer) setActiveTool(layer.type === "text" ? "text" : "logo");
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
        size: 16,
        rotation: 0,
        text: "NAME",
        color: "#ffffff",
        fontFamily: fontOptions[0].family,
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

  const handleRequestQuote = async () => {
    let preview = null;
    if (stageRef.current) {
      try {
        preview = await toPng(stageRef.current, { pixelRatio: 1.5, skipFonts: true });
        setPreviewImg(preview);
      } catch {
        setPreviewImg(null);
      }
    }

    setQuoteError(null);
    setSubmittingQuote(true);
    try {
      const grandTotal = unitPrice * roster.length + (fanJerseyAdded ? FAN_JERSEY_PRICE : 0);
      await submitUniformQuote({
        template: template?.name || "Blank Canvas",
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
        roster,
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
      <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14">
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

  return (
    <div className="pt-16 md:pt-20">
      {/* Header */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-12 bg-primary-950 text-background-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-50/10 border border-background-50/20 text-xs font-medium mb-4">
            <i className="ri-t-shirt-line" />
            3D Uniform Studio
          </div>
          <h1 className="font-heading text-3xl md:text-5xl font-light leading-tight mb-3">
            Kit up the whole squad — <span className="italic text-accent-400">in one window.</span>
          </h1>
          <p className="text-background-50/75 text-sm md:text-base font-label max-w-xl mx-auto">
            Full product builder: recolor every panel, drag on logos and text, then build your
            roster — right down to each player's size.
          </p>
        </div>
      </div>

      {/* Sport tabs */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 border-b border-background-200/70 bg-background-50 sticky top-16 md:top-20 z-30">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
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
      </div>

      {/* Template gallery */}
      {!selectedTemplate && (
        <div className="w-full px-4 md:px-8 lg:px-12 py-10">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-heading text-2xl font-light text-foreground-950 mb-6">
              Choose a template
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleTemplates.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className="text-left rounded-2xl border border-background-200/70 hover:border-primary-300 bg-background-50 p-5 transition-colors cursor-pointer group"
                >
                  <div className="w-full h-40 rounded-xl overflow-hidden mb-4 bg-background-100 p-4">
                    <JerseyGraphic
                      view="front"
                      collar={t.defaultCollar}
                      sleeve={t.defaultSleeve}
                      colors={defaultZoneColors}
                    />
                  </div>
                  <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1">
                    {t.name}
                  </h3>
                  <p className="text-xs text-foreground-600 font-label leading-relaxed">
                    {t.description}
                  </p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => selectTemplate({ slug: "blank-canvas" })}
                className="text-left rounded-2xl border-2 border-dashed border-background-300 hover:border-primary-400 bg-background-100/40 p-5 transition-colors cursor-pointer flex flex-col items-center justify-center text-center min-h-[220px]"
              >
                <i className="ri-add-circle-line text-3xl text-foreground-400 mb-2" />
                <h3 className="font-heading text-lg font-medium text-foreground-950 mb-1">
                  Design from scratch
                </h3>
                <p className="text-xs text-foreground-600 font-label">
                  Start with a blank canvas
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full product customizer workspace — pro-tool layout: icon rail,
          canvas, docked fields panel (mirrors lexasport.com's studio) */}
      {selectedTemplate && (
        <div className="w-full px-4 md:px-8 lg:px-12 py-8 bg-[#14110d]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-background-50/60 hover:text-background-50 cursor-pointer"
              >
                <i className="ri-arrow-left-line" />
                Choose a different template
              </button>
              <span className="text-xs font-label text-background-50/35">
                {template?.name || "Blank Canvas"} · {sports.find((s) => s.slug === activeSport)?.label}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
              {/* Unified workspace surface — icon rail and canvas share one
                  card (a hairline divider, not a gap) so it reads as one
                  instrument rather than loose floating boxes. */}
              <div className="rounded-3xl bg-[#1a160f] ring-1 ring-white/[0.06] shadow-[0_30px_80px_-25px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="flex">
                  {/* Icon rail — desktop only; mobile gets the pill row below the canvas */}
                  <div className="hidden lg:flex flex-col items-center gap-1 py-6 px-3 border-r border-white/[0.06] flex-shrink-0">
                    {tools.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        title={t.label}
                        aria-label={t.label}
                        onClick={() => setActiveTool(t.key)}
                        className={`w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl cursor-pointer transition-colors ${
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
                    ))}
                  </div>

                  {/* Canvas */}
                  <div className="flex-1 min-w-0 flex flex-col items-center gap-4 px-5 md:px-10 py-8">
                    {/* Top bar: view thumbnails + zoom/export, inline instead of a separate row above the card */}
                    <div className="w-full flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setStageMode((m) => (m === "edit" ? "3d" : "edit"))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-white/5 text-background-50/70 hover:bg-white/10 hover:text-background-50"
                      >
                        <i className={stageMode === "edit" ? "ri-3d-cube-sphere-line" : "ri-edit-2-line"} />
                        {stageMode === "edit" ? "3D view" : "Edit"}
                      </button>
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
                    {stageMode === "edit" && (
                      <div className="min-h-[44px] flex items-center">
                        {selectedLayer && (
                          <FloatingToolbar
                            layer={selectedLayer}
                            onUpdate={updateLayer}
                            onDuplicate={duplicateLayer}
                            onDelete={removeLayer}
                            onReorder={reorderLayer}
                          />
                        )}
                      </div>
                    )}

                    {stageMode === "edit" ? (
                      <>
                        <div
                          className="w-full max-w-md transition-transform"
                          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
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
                          />
                        </div>
                        <p className="text-[11px] text-background-50/30 font-label text-center">
                          Drag to move · drag the black handle to rotate · drag the green handle to
                          resize · double-click text to edit
                        </p>
                      </>
                    ) : (
                      <div className="w-full">
                        <Product3DStage productType={jerseyProductType} color={colors.body} textures={textures} />
                        <p className="text-[11px] text-background-50/30 font-label text-center mt-3">
                          Live 3D preview — rotates with your logo, text, and shirt color applied.
                          Switch back to Edit to place logos and text precisely.
                        </p>
                      </div>
                    )}

                    {/* Only runs while the 3D view is open — no reason to pay for an
                        offscreen capture on every layer/drag update while editing in 2D. */}
                    {stageMode === "3d" && (
                      <DesignCapture layers={layers} placements={jerseyPlacements} onTextureUpdate={handleTextureUpdate} />
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
                </div>
              </div>

              {/* Docked fields panel */}
              <div className="rounded-3xl bg-background-50 ring-1 ring-background-200/60 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)] p-5 md:p-6 lg:max-h-[760px] lg:overflow-y-auto lg:sticky lg:top-24">
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
                  />
                )}
                {activeTool === "text" && <TextPanel onAdd={addTextLayer} />}
                {activeTool === "logo" && <LogoPanel onUpload={addLogoLayer} />}
                {activeTool === "layers" && (
                  <LayersPanel
                    layers={layers}
                    view={view}
                    selectedId={selectedLayerId}
                    onSelect={selectLayer}
                    onRemove={removeLayer}
                    onReorder={reorderLayer}
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

            {/* Download — outside the dark canvas card so it sits in page context */}
            <div className="flex justify-end mt-3">
              <Button
                variant="outline"
                size="sm"
                icon="ri-download-2-line"
                iconPosition="left"
                onClick={handleDownload}
                disabled={exporting || stageMode !== "edit"}
              >
                {exporting ? "Exporting…" : "Download design"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20 bg-background-100/50 border-t border-background-200/70">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
              Pricing that <span className="italic text-primary-700">scales with you.</span>
            </h2>
            <p className="text-sm text-foreground-600 font-label">
              One-off gift orders or a full club roster — the pricing model adjusts automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-7 border transition-colors ${
                  tier.highlight
                    ? "bg-primary-950 text-background-50 border-primary-950"
                    : "bg-background-50 border-background-200/70"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 right-6 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold uppercase tracking-wider">
                    Most common
                  </span>
                )}
                <h3
                  className={`font-heading text-xl font-medium mb-1 ${
                    tier.highlight ? "text-background-50" : "text-foreground-950"
                  }`}
                >
                  {tier.name}
                </h3>
                <p
                  className={`text-xs font-label mb-4 ${
                    tier.highlight ? "text-background-50/70" : "text-foreground-500"
                  }`}
                >
                  {tier.description}
                </p>
                <div className="flex items-baseline gap-1.5 mb-6">
                  <span
                    className={`font-heading text-3xl font-semibold ${
                      tier.highlight ? "text-background-50" : "text-foreground-950"
                    }`}
                  >
                    {tier.price}
                  </span>
                  <span
                    className={`text-xs font-label ${
                      tier.highlight ? "text-background-50/60" : "text-foreground-500"
                    }`}
                  >
                    {tier.unit}
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2 text-sm ${
                        tier.highlight ? "text-background-50/90" : "text-foreground-800"
                      }`}
                    >
                      <i
                        className={`ri-check-line mt-0.5 ${
                          tier.highlight ? "text-accent-400" : "text-primary-600"
                        }`}
                      />
                      <span className="font-label">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-8 text-center">
            Questions, <span className="italic text-primary-700">answered.</span>
          </h2>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 bg-primary-950 text-background-50 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-light mb-4">
          Ready to kit up your team?
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="accent"
            size="lg"
            icon="ri-arrow-right-line"
            onClick={() => {
              selectTemplate({ slug: "blank-canvas" });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Open the studio
          </Button>
          <Button to="/auth/register" variant="outline-light" size="lg">
            Create free account
          </Button>
        </div>
      </div>
    </div>
  );
}

function RosterTool({
  bottomLabel = "Shorts",
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

      <div className="pt-1">
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
      </div>
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-background-200/70 bg-background-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-foreground-900">{question}</span>
        <i
          className={`ri-arrow-down-s-line text-foreground-500 transition-transform flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-foreground-600 leading-relaxed font-label">
          {answer}
        </div>
      )}
    </div>
  );
}
