import { forwardRef } from "react";
import JerseyGraphic from "./JerseyGraphic";
import ShortsGraphic from "./ShortsGraphic";
import SocksGraphic from "./SocksGraphic";
import DraggableLayer from "./DraggableLayer";
import { sportConfigFor } from "../../data/uniforms";

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
    collar,
    sleeve,
    colors,
    highlightZone,
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
  const config = sportConfigFor(sport);

  const handleStageDown = (e) => {
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
    });
  };

  return (
    <div className="w-full">
      {/* Editing canvas — the piece currently being customized (drag logos/text here) */}
      <div className="w-full flex items-center justify-center py-2">
        <div
          ref={stageRef}
          onMouseDown={handleStageDown}
          onTouchStart={handleStageDown}
          style={{ cursor: pendingLayer ? "copy" : undefined }}
          className="relative w-full max-w-md aspect-[4/5] rounded-2xl bg-gradient-to-b from-background-50 to-background-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.55)] ring-1 ring-white/10 overflow-hidden"
        >
          <div className="absolute inset-8 md:inset-12">
            <JerseyGraphic
              view={view}
              collar={collar}
              sleeve={sleeve}
              colors={colors}
              highlightZone={highlightZone}
            />
          </div>

          <SafeAreaGuide />

          {layers
            .filter((l) => l.view === view)
            .map((layer) => (
              <DraggableLayer
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

      {/* Full-kit preview strip — shirt, shorts, and socks shown together on
          the same page, read-only, so nobody has to navigate away or guess
          how the pieces look as a set. Matches the client's explicit
          "everything shown fully on one window" requirement. */}
      <div className="mt-6 pt-5 border-t border-background-50/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-background-50/35 mb-3 text-center">
          Full kit preview
        </p>
        <div className={`grid gap-2.5 md:gap-3 ${config.hasSocks ? "grid-cols-4" : "grid-cols-3"}`}>
          <PreviewTile label="Front">
            <JerseyGraphic view="front" collar={collar} sleeve={sleeve} colors={colors} />
          </PreviewTile>
          <PreviewTile label="Back">
            <JerseyGraphic view="back" collar={collar} sleeve={sleeve} colors={colors} />
          </PreviewTile>
          <PreviewTile label={config.bottomLabel}>
            <ShortsGraphic colors={colors} />
          </PreviewTile>
          {config.hasSocks && (
            <PreviewTile label="Socks">
              <SocksGraphic colors={colors} />
            </PreviewTile>
          )}
        </div>
      </div>
    </div>
  );
});

function PreviewTile({ label, children }) {
  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="w-full aspect-square rounded-xl bg-background-50 ring-1 ring-white/5 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)] p-2.5 md:p-3 transition-transform duration-200 group-hover:-translate-y-0.5">
        {children}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-background-50/45">
        {label}
      </span>
    </div>
  );
}

export default JerseyStage;
