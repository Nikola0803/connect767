import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { productTypes as fallbackProductTypes, garmentColorPalette as fallbackColorPalette, fontOptions } from "../data/customizer";
import { getProductTypes, submitProductCustomOrder } from "../data/repository";
import ProductStage from "../components/product-customizer/ProductStage";
import ProductGallery from "../components/product-customizer/ProductGallery";
import SimpleDesignPanel from "../components/product-customizer/SimpleDesignPanel";
import SelectedLayerBar from "../components/product-customizer/SelectedLayerBar";
import Product3DStage from "../components/product-customizer/garment3d/Product3DStage";
import DesignCapture from "../components/product-customizer/garment3d/DesignCapture";
import Button from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/FormField";

/**
 * Rebuilt as a plain 3-step flow — pick a product, design it (color, text,
 * logo, all on one screen), then order — rather than the Printful-style
 * pro-tool layout (icon rail, zoom, alignment grid, undo/redo, mirror-to-
 * placement, per-layer font/outline/shadow controls, a layer list) this
 * page had before. That layout suited a design agency; Connect767 sells a
 * handful of products with three real customization types (recolor, add
 * text, add a logo), so the tool now only asks for exactly that. See
 * SimpleDesignPanel.jsx and SelectedLayerBar.jsx for what replaced the old
 * CustomizerPanels.jsx / ProductFloatingToolbar.jsx / LayerStrip.jsx.
 */

// Bulk pricing — a genuine perk of ordering more at once, calculated live
// as you type a quantity, the same way most print-on-demand storefronts
// surface volume discounts.
const PRICE_TIERS = [
  { min: 50, discount: 0.3, label: "50+ — 30% off" },
  { min: 25, discount: 0.2, label: "25–49 — 20% off" },
  { min: 12, discount: 0.1, label: "12–24 — 10% off" },
  { min: 1, discount: 0, label: "1–11 — full price" },
];

function priceFor(basePrice, quantity) {
  const tier = PRICE_TIERS.find((t) => quantity >= t.min) || PRICE_TIERS[PRICE_TIERS.length - 1];
  const unit = basePrice * (1 - tier.discount);
  return { unit, total: unit * quantity, tier };
}

let layerIdCounter = 0;
const nextLayerId = () => `layer-${Date.now()}-${layerIdCounter++}`;
let uploadIdCounter = 0;
const nextUploadId = () => `upload-${Date.now()}-${uploadIdCounter++}`;

function StepPill({ num, label, state, onClick }) {
  // state: 'done' | 'active' | 'upcoming'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "upcoming"}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        state === "active"
          ? "bg-primary-500 text-background-50 cursor-pointer"
          : state === "done"
          ? "bg-primary-50 text-primary-700 hover:bg-primary-100 cursor-pointer"
          : "bg-background-100 text-foreground-400 cursor-not-allowed"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
          state === "active" ? "bg-background-50/25" : state === "done" ? "bg-primary-200" : "bg-background-200"
        }`}
      >
        {state === "done" ? <i className="ri-check-line" /> : num}
      </span>
      {label}
    </button>
  );
}

export default function ProductCustomizerPage() {
  // ---------- Product config: admin-managed via wp-admin when a backend is
  // connected (see repository.js's getProductTypes()), local fixtures
  // otherwise. ----------
  const [productTypes, setProductTypesList] = useState(fallbackProductTypes);
  useEffect(() => {
    let alive = true;
    getProductTypes().then((list) => {
      if (alive && list?.length) setProductTypesList(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [productType, setProductType] = useState(null);
  const [step, setStep] = useState("design"); // 'design' | 'order' — product step is "no product chosen yet"
  const [color, setColor] = useState("#ffffff");
  const [view, setView] = useState("front");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [uploads, setUploads] = useState([]);
  const stageRef = useRef(null);

  // ---------- 3D preview ----------
  const [stageMode, setStageMode] = useState("edit");
  const [textures, setTextures] = useState({});
  const handleTextureUpdate = (key, canvas) => setTextures((t) => ({ ...t, [key]: canvas }));

  const [quantity, setQuantity] = useState(12);
  const [sizes, setSizes] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);

  const product = productTypes.find((p) => p.slug === productType) || null;
  const colorPalette = product?.colorPalette || fallbackColorPalette;
  const currentPlacement = product ? product.placements.find((p) => p.key === view) || product.placements[0] : null;
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;
  const pricing = useMemo(
    () => priceFor(product?.basePrice || 0, quantity),
    [product?.basePrice, quantity]
  );

  const selectProduct = (slug) => {
    const next = productTypes.find((p) => p.slug === slug);
    if (!next) return;
    setProductType(slug);
    setView(next.placements[0].key);
    setColor((next.colorPalette || fallbackColorPalette)[0] || "#ffffff");
    setLayers([]);
    setSelectedLayerId(null);
    setStep("design");
  };

  const backToGallery = () => {
    setProductType(null);
    setLayers([]);
    setSelectedLayerId(null);
    setStep("design");
  };

  const selectLayer = (id) => setSelectedLayerId(id);

  const addTextLayer = () => {
    if (currentPlacement && currentPlacement.allowText === false) return;
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
        text: "",
        color: "#1b1a16",
        fontFamily: fontOptions[0].family,
        opacity: 100,
        autoEdit: true,
      },
    ]);
    setSelectedLayerId(id);
  };

  const addArtworkFromSrc = (src) => {
    if (currentPlacement && currentPlacement.allowLogo === false) return;
    const id = nextLayerId();
    setLayers((ls) => [
      ...ls,
      { id, type: "logo", view, x: 50, y: 40, size: 16, rotation: 0, src, opacity: 100 },
    ]);
    setSelectedLayerId(id);
  };

  const handleNewUpload = (fileOrEvent) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files?.[0] : fileOrEvent;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const uploadId = nextUploadId();
      setUploads((u) => [...u, { id: uploadId, src: reader.result }]);
      addArtworkFromSrc(reader.result);
    };
    reader.readAsDataURL(file);
    if (fileOrEvent?.target) fileOrEvent.target.value = "";
  };

  const addClipartLayer = (clip) => {
    if (currentPlacement && currentPlacement.allowLogo === false) return;
    const id = nextLayerId();
    setLayers((ls) => [
      ...ls,
      { id, type: "clipart", view, x: 50, y: 40, size: 16, rotation: 0, icon: clip.icon, color: "#1b1a16", opacity: 100 },
    ]);
    setSelectedLayerId(id);
  };

  const updateLayer = (id, patch) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeLayer = (id) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const handleRequestOrder = async () => {
    let preview = null;
    if (stageRef.current) {
      try {
        preview = await toPng(stageRef.current, { pixelRatio: 1.5, skipFonts: true });
        setPreviewImg(preview);
      } catch {
        setPreviewImg(null);
      }
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitProductCustomOrder({
        productType: product.label,
        color,
        technique: "dtg",
        quantity,
        sizes,
        email,
        layers,
        estimatedTotal: pricing.total.toFixed(2),
        previewImage: preview,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Couldn't send your order request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14 bg-gradient-to-b from-background-50 to-primary-50/20">
        <div className="text-center max-w-lg">
          {previewImg && (
            <img
              src={previewImg}
              alt="Your design"
              className="w-40 h-40 object-contain mx-auto mb-6 rounded-2xl border border-background-200/70 shadow-lg bg-background-50"
            />
          )}
          <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-5">
            <i className="ri-check-line text-2xl" />
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-3">
            Order request sent
          </h1>
          <p className="text-sm text-foreground-600 mb-8">
            We've got your {product.label.toLowerCase()} design — someone from the team will
            follow up with pricing and production timing.
          </p>
          <Button to="/shop" variant="primary">
            Back to shop
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-16 md:pt-20">
        <ProductGallery productTypes={productTypes} onSelect={selectProduct} />
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-20 pb-16">
      {/* Step indicator */}
      <div className="w-full px-4 md:px-8 lg:px-12 py-4 border-b border-background-200/70 bg-background-50 sticky top-16 md:top-20 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-2">
          <StepPill num={1} label="Product" state="done" onClick={backToGallery} />
          <i className="ri-arrow-right-s-line text-foreground-300" />
          <StepPill
            num={2}
            label="Design"
            state={step === "design" ? "active" : "done"}
            onClick={() => setStep("design")}
          />
          <i className="ri-arrow-right-s-line text-foreground-300" />
          <StepPill
            num={3}
            label="Order"
            state={step === "order" ? "active" : layers.length > 0 ? "done" : "upcoming"}
            onClick={() => layers.length > 0 && setStep("order")}
          />
        </div>
      </div>

      {step === "design" && (
        <div className="w-full px-4 md:px-8 lg:px-12 py-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
            <div className="order-2 md:order-1">
              <SimpleDesignPanel
                colorPalette={colorPalette}
                color={color}
                setColor={setColor}
                allowText={currentPlacement?.allowText !== false}
                allowLogo={currentPlacement?.allowLogo !== false}
                onAddText={addTextLayer}
                uploads={uploads}
                onUploadNew={handleNewUpload}
                onAddFromLibrary={(u) => addArtworkFromSrc(u.src)}
                onAddClipart={addClipartLayer}
              />
            </div>

            <div className="order-1 md:order-2 flex flex-col items-center gap-4">
              {product.placements.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {product.placements.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setView(p.key)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                        view === p.key
                          ? "bg-primary-500 text-background-50"
                          : "bg-background-100 text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative w-full max-w-md">
                <button
                  type="button"
                  onClick={() => setStageMode((m) => (m === "edit" ? "3d" : "edit"))}
                  className="absolute -top-2 right-0 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-foreground-950 text-background-50 shadow-md cursor-pointer hover:bg-foreground-800"
                >
                  <i className={stageMode === "edit" ? "ri-3d-cube-sphere-line" : "ri-edit-2-line"} />
                  {stageMode === "edit" ? "3D view" : "Edit"}
                </button>

                {stageMode === "edit" ? (
                  <ProductStage
                    ref={stageRef}
                    productType={productType}
                    view={view}
                    color={color}
                    layers={layers}
                    selectedId={selectedLayerId}
                    onSelect={selectLayer}
                    onLayerChange={(id, patch) => updateLayer(id, patch)}
                    onBackgroundClick={() => setSelectedLayerId(null)}
                    showGrid={false}
                    onUploadDrop={handleNewUpload}
                  />
                ) : (
                  <Product3DStage productType={product} color={color} textures={textures} />
                )}
              </div>

              <div className="min-h-[40px] flex items-center">
                {selectedLayer && stageMode === "edit" && (
                  <SelectedLayerBar layer={selectedLayer} onUpdate={updateLayer} onDelete={removeLayer} />
                )}
              </div>

              <Button
                variant="accent"
                icon="ri-arrow-right-line"
                disabled={layers.length === 0}
                onClick={() => setStep("order")}
              >
                Continue to order
              </Button>
              {layers.length === 0 && (
                <p className="text-xs text-foreground-500 font-label">Add some text or a logo first.</p>
              )}
            </div>
          </div>

          <DesignCapture layers={layers} placements={product.placements} onTextureUpdate={handleTextureUpdate} />
        </div>
      )}

      {step === "order" && (
        <div className="w-full px-4 md:px-8 lg:px-12 py-10">
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setStep("design")}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-500 hover:text-foreground-800 cursor-pointer mb-6"
            >
              <i className="ri-arrow-left-line" />
              Back to design
            </button>

            <div className="rounded-2xl bg-background-50 border border-background-200/60 shadow-sm p-6">
              <h2 className="font-heading text-xl font-medium text-foreground-950 mb-1">Order details</h2>
              <p className="text-xs text-foreground-500 font-label mb-6">{product.label}</p>

              <label className="block text-xs font-semibold text-foreground-800 mb-1.5" htmlFor="quantity">
                Quantity
              </label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="mb-3"
              />

              <div className="rounded-xl bg-gradient-to-br from-primary-50 to-secondary-50/60 border border-primary-100 p-3.5 mb-4">
                <div className="flex items-center justify-between text-xs text-foreground-600 font-label mb-1">
                  <span>Base price</span>
                  <span>${product.basePrice.toFixed(2)} / unit</span>
                </div>
                {pricing.tier.discount > 0 && (
                  <div className="flex items-center justify-between text-xs text-primary-700 font-label mb-1 font-semibold">
                    <span className="flex items-center gap-1">
                      <i className="ri-price-tag-3-fill" />
                      Bulk discount
                    </span>
                    <span>-{Math.round(pricing.tier.discount * 100)}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-semibold text-foreground-950 pt-1.5 mt-1.5 border-t border-primary-200/60">
                  <span>Estimated total</span>
                  <span>${pricing.total.toFixed(2)}</span>
                </div>
              </div>

              <label className="block text-xs font-semibold text-foreground-800 mb-1.5" htmlFor="sizes">
                Sizes needed
              </label>
              <Textarea
                id="sizes"
                rows={2}
                placeholder="e.g. 4x S, 6x M, 2x L"
                value={sizes}
                onChange={(e) => setSizes(e.target.value)}
                className="mb-4"
              />

              <label className="block text-xs font-semibold text-foreground-800 mb-1.5" htmlFor="quote-email">
                Your email
              </label>
              <Input
                id="quote-email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="pt-4 mt-4 border-t border-background-200/70">
                {submitError && (
                  <p className="text-xs text-accent-600 font-label mb-3 flex items-start gap-1.5">
                    <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
                    {submitError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="accent"
                  disabled={submitting}
                  onClick={handleRequestOrder}
                  icon="ri-arrow-right-line"
                  className="w-full"
                >
                  {submitting ? "Sending…" : "Request order"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
