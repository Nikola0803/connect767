import { forwardRef, useRef } from "react";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";
import DraggableLayer from "./DraggableLayer";

/** Camera-viewfinder-style corner brackets instead of a full dashed
 * rectangle — reads as a precision print-safe-area guide rather than a
 * placeholder box, the same visual language high-end configurators use. */
function SafeAreaGuide() {
  const corner = "absolute w-5 h-5 border-accent-500/70";
  return (
    <div className="pointer-events-none absolute inset-[16%]">
      <div className={`${corner} top-0 left-0 border-t-2 border-l-2 rounded-tl`} />
      <div className={`${corner} top-0 right-0 border-t-2 border-r-2 rounded-tr`} />
      <div className={`${corner} bottom-0 left-0 border-b-2 border-l-2 rounded-bl`} />
      <div className={`${corner} bottom-0 right-0 border-b-2 border-r-2 rounded-br`} />
    </div>
  );
}

const JerseyStage = forwardRef(function JerseyStage(
  {
    sport,
    view,
    onViewChange,
    collar,
    sleeve,
    colors,
    highlightZone,
    zoneModel,
    zoneStyles,
    selectedZoneId,
    showZoneOutlines,
    correctionMode,
    onSelectZone,
    onMoveZonePoint,
    layers,
    selectedId,
    onSelect,
    onLayerChange,
    onBackgroundClick,
    // Click-to-place: when something is armed, the next click on the jersey
    // creates it at that exact spot instead of dropping it in the middle for
    // the customer to drag into position.
    pendingLayer,
    onCommitPending,
  },
  stageRef
) {
  const frontStageRef = useRef(null);
  const backStageRef = useRef(null);

  const handleStageDown = (e, side) => {
    onViewChange?.(side);
    if (!pendingLayer) {
      onBackgroundClick?.(e);
      return;
    }
    // Position as a percentage of the stage, matching how layers store x/y.
    const rect = e.currentTarget.getBoundingClientRect();
    const point = e.touches?.[0] ?? e;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    onCommitPending?.({
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(4, Math.min(96, y)),
      view: side,
    });
  };

  return (
    <div ref={stageRef} className="w-full py-2">
      {/* Front and back stay visible together. Each side remains its own
          editing surface so artwork coordinates and drag bounds never leak
          from one face of the garment onto the other. */}
      <div className="grid w-full grid-cols-2 gap-3 md:gap-4">
        {["front", "back"].map((side) => {
          const sideRef = side === "front" ? frontStageRef : backStageRef;
          const active = view === side;
          return (
            <div key={side} className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  onViewChange?.(side);
                  onBackgroundClick?.();
                }}
                className={`mb-2 w-full rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition cursor-pointer ${
                  active
                    ? "bg-primary-600 text-white"
                    : "bg-white/[0.06] text-background-50/50 hover:bg-white/10 hover:text-background-50"
                }`}
              >
                {side}
              </button>
              <div
                ref={sideRef}
                onMouseDown={(event) => handleStageDown(event, side)}
                onTouchStart={(event) => handleStageDown(event, side)}
                style={{ cursor: pendingLayer ? "copy" : undefined }}
                className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-background-50 to-background-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.55)] transition ${
                  active ? "ring-2 ring-primary-500" : "ring-1 ring-white/10"
                }`}
              >
                <div className="absolute inset-2 sm:inset-3 md:inset-4">
                  <ApprovedUniformGraphic
                    sport={sport}
                    view={side}
                    collar={collar}
                    sleeve={sleeve}
                    colors={colors}
                    highlightZone={highlightZone}
                    zones={zoneModel?.[side]}
                    zoneStyles={zoneStyles?.[side]}
                    selectedZoneId={selectedZoneId}
                    showZoneOutlines={showZoneOutlines}
                    correctionMode={correctionMode && active}
                    onSelectZone={(zoneId) => {
                      onViewChange?.(side);
                      onSelectZone?.(zoneId, side);
                    }}
                    onMoveZonePoint={(zoneId, commandIndex, pointType, point) =>
                      onMoveZonePoint?.(side, zoneId, commandIndex, pointType, point)
                    }
                  />
                </div>

                <SafeAreaGuide />

                {layers
                  .filter((layer) => layer.view === side)
                  .map((layer) => (
                    <DraggableLayer
                      key={layer.id}
                      layer={layer}
                      stageRef={sideRef}
                      selected={layer.id === selectedId}
                      onSelect={(id) => {
                        onViewChange?.(side);
                        onSelect(id);
                      }}
                      onChange={onLayerChange}
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default JerseyStage;
