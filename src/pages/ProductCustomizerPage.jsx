import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function ProductCustomizerPage() {
  const navigate = useNavigate();
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
  const [sleeveStyle, setSleeveStyle] = useState("short");
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
      <div className="fixed inset-0 h-screen bg-gradient-to-b from-background-50 to-primary-50/20 flex items-center justify-center z-50">
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
            We've got your {product.label.toLowerCase()} design — someone from the team will follow up with pricing and
            production timing.
          </p>
          <Button to="/" variant="primary">
            Back home
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <ProductGallery productTypes={productTypes} onSelect={selectProduct} />
      </div>
    );
  }

  // Design customization — FULL SCREEN MODE
  if (step === "design") {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-background-950 overflow-hidden flex flex-col z-40">
        {/* Top bar with back button and product info */}
        <div className="flex items-center justify-between px-6 py-4 bg-background-900 border-b border-background-800">
          <button
            type="button"
            onClick={backToGallery}
            className="inline-flex items-center gap-2 text-sm font-semibold text-background-50 hover:text-primary-300 transition-colors"
          >
            <i className="ri-arrow-left-line" />
            Back
          </button>
          <h2 className="font-heading text-lg font-medium text-background-50">{product.label}</h2>
          <div className="w-12" />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Color & text/logo options */}
          <div className="w-64 bg-background-900 border-r border-background-800 overflow-y-auto p-6">
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

          {/* Center: Canvas */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            {product.placements.length > 1 && (
              <div className="flex items-center gap-1.5">
                {product.placements.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setView(p.key)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      view === p.key
                        ? "bg-primary-500 text-background-50"
                        : "bg-background-800 text-background-300 hover:bg-background-700"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

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
              <Product3DStage productType={product} color={color} textures={textures} fullscreen={true} />
            )}

            <button
              type="button"
              onClick={() => setStageMode((m) => (m === "edit" ? "3d" : "edit"))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-background-50 hover:bg-primary-700 transition-colors"
            >
              <i className={stageMode === "edit" ? "ri-3d-cube-sphere-line" : "ri-edit-2-line"} />
              {stageMode === "edit" ? "3D View" : "Edit"}
            </button>
          </div>

          {/* Right: Layer controls & order button */}
          <div className="w-64 bg-background-900 border-l border-background-800 overflow-y-auto p-6 flex flex-col">
            <div className="flex-1">
              {selectedLayer && stageMode === "edit" && (
                <div className="space-y-4">
                  <SelectedLayerBar
                    layer={selectedLayer}
                    onUpdate={updateLayer}
                    onDelete={removeLayer}
                    sleeveStyle={sleeveStyle}
                    onSleeveChange={setSleeveStyle}
                    productType={product}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 mt-auto pt-6 border-t border-background-800">
              <Button
                variant="accent"
                icon="ri-arrow-right-line"
                disabled={layers.length === 0}
                onClick={() => setStep("order")}
                className="w-full"
              >
                Continue
              </Button>
              {layers.length === 0 && <p className="text-xs text-background-400 text-center">Add text or logo first</p>}
            </div>
          </div>
        </div>

        <DesignCapture layers={layers} placements={product.placements} onTextureUpdate={handleTextureUpdate} />
      </div>
    );
  }

  // Order details
  if (step === "order") {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-background-950 overflow-y-auto flex items-center justify-center z-40">
        <div className="w-full max-w-md p-6">
          <button
            type="button"
            onClick={() => setStep("design")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-background-50 hover:text-primary-300 transition-colors mb-6"
          >
            <i className="ri-arrow-left-line" />
            Back to design
          </button>

          <div className="rounded-2xl bg-background-900 border border-background-800 p-6">
            <h2 className="font-heading text-xl font-medium text-background-50 mb-1">Order details</h2>
            <p className="text-xs text-background-400 font-label mb-6">{product.label}</p>

            <label className="block text-xs font-semibold text-background-100 mb-1.5" htmlFor="quantity">
              Quantity
            </label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="mb-3 bg-background-800 border-background-700 text-background-50"
            />

            <div className="rounded-xl bg-gradient-to-br from-primary-900 to-primary-800 border border-primary-700 p-3.5 mb-4">
              <div className="flex items-center justify-between text-xs text-background-200 font-label mb-1">
                <span>Base price</span>
                <span>${product.basePrice.toFixed(2)} / unit</span>
              </div>
              {pricing.tier.discount > 0 && (
                <div className="flex items-center justify-between text-xs text-primary-200 font-label mb-1 font-semibold">
                  <span className="flex items-center gap-1">
                    <i className="ri-price-tag-3-fill" />
                    Bulk discount
                  </span>
                  <span>-{Math.round(pricing.tier.discount * 100)}%</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-semibold text-background-50 pt-1.5 mt-1.5 border-t border-primary-700">
                <span>Total</span>
                <span>${pricing.total.toFixed(2)}</span>
              </div>
            </div>

            <label className="block text-xs font-semibold text-background-100 mb-1.5" htmlFor="sizes">
              Sizes needed
            </label>
            <Textarea
              id="sizes"
              rows={2}
              placeholder="e.g. 4x S, 6x M, 2x L"
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              className="mb-4 bg-background-800 border-background-700 text-background-50"
            />

            <label className="block text-xs font-semibold text-background-100 mb-1.5" htmlFor="quote-email">
              Your email
            </label>
            <Input
              id="quote-email"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 bg-background-800 border-background-700 text-background-50"
            />

            <div className="pt-4 border-t border-background-800">
              {submitError && (
                <p className="text-xs text-accent-400 font-label mb-3 flex items-start gap-1.5">
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
    );
  }
}
