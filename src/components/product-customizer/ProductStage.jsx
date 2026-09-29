import { forwardRef } from "react";
import ProductGraphic from "./ProductGraphic";
import ProductDraggableLayer from "./ProductDraggableLayer";

const NO_GUIDE_VIEWS = ["inside-label"];

const ProductStage = forwardRef(function ProductStage(
  {
    productType,
    view,
    color,
    layers,
    selectedId,
    onSelect,
    onLayerChange,
    onBackgroundClick,
    showGrid,
    onUploadDrop,
    fill,
  },
  stageRef
) {
  const viewLayers = layers.filter((l) => l.view === view);
  const showPrintGuide = !NO_GUIDE_VIEWS.includes(view);
  const isEmpty = viewLayers.length === 0;

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file && onUploadDrop) onUploadDrop(file);
  };

  return (
    <div className="w-full rounded-[28px] bg-gradient-to-br from-background-100/80 to-background-50 border border-background-200/60 p-6 md:p-10 flex items-center justify-center shadow-inner">
      <div
        ref={stageRef}
        onMouseDown={onBackgroundClick}
        onTouchStart={onBackgroundClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="relative w-full max-w-md aspect-[4/5] rounded-2xl bg-background-50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden"
      >
        {showGrid && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
              backgroundSize: "10% 10%",
            }}
          />
        )}

        <div className="absolute inset-6 md:inset-10">
          <ProductGraphic productType={productType} view={view} color={color} />
        </div>

        {fill?.pattern && fill.pattern !== "none" && (
          <div
            className="absolute inset-[22%] rounded-sm overflow-hidden pointer-events-none"
            style={{
              backgroundColor: fill.pattern === "solid" ? `${fill.color}55` : "transparent",
              backgroundImage:
                fill.pattern === "stripes"
                  ? `repeating-linear-gradient(45deg, ${fill.color}66 0 8px, transparent 8px 16px)`
                  : fill.pattern === "dots"
                    ? `radial-gradient(${fill.color}77 2px, transparent 2px)`
                    : undefined,
              backgroundSize: fill.pattern === "dots" ? "14px 14px" : undefined,
            }}
          />
        )}

        {/* Print-safe-area guide, doubling as a direct upload dropzone —
            matches Printful's own "Upload or drop your design here" print
            area when nothing's been placed there yet. */}
        {showPrintGuide && (
          <label
            className={`absolute inset-[22%] rounded-sm flex items-center justify-center text-center transition-colors ${
              isEmpty
                ? "border-2 border-dashed border-primary-300/70 bg-primary-50/20 hover:bg-primary-50/40 cursor-pointer"
                : "border border-dashed border-primary-300/40 pointer-events-none"
            }`}
          >
            {isEmpty && (
              <div className="flex flex-col items-center gap-1.5 text-primary-700 pointer-events-none px-3">
                <i className="ri-upload-cloud-2-line text-xl" />
                <span className="text-xs font-semibold leading-tight">
                  Upload or drop
                  <br />
                  your design here
                </span>
              </div>
            )}
            {isEmpty && (
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            )}
          </label>
        )}

        {viewLayers.map((layer) => (
          <ProductDraggableLayer
            key={layer.id}
            layer={layer}
            stageRef={stageRef}
            selected={layer.id === selectedId}
            onSelect={onSelect}
            onChange={onLayerChange}
          />
        ))}
      </div>
    </div>
  );
});

export default ProductStage;
