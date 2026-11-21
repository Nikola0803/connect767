import { useCallback, useEffect, useRef, useState } from "react";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  positionToPercent,
  formatPosition,
  imageCropStyle,
  resolveSmartImageFit,
} from "../../lib/imagePosition";

/**
 * Drag-to-reposition editor for the logo and cover photo.
 *
 * Replaces a 3x3 grid of arrow buttons. Nine fixed anchors meant a face
 * slightly left of centre simply could not be centred — you picked the
 * nearest of nine and lived with it. Dragging the image inside the frame it
 * will actually be cropped to is both more precise and the interaction people
 * already know from every social profile editor.
 *
 * The preview frame matches the real aspect ratio of the destination (round
 * for a logo, 16:9 for a cover), so what's framed here is what gets published
 * — the old picker gave no preview at all.
 */
export default function PositionPicker({
  position,
  zoom,
  onPositionChange,
  onZoomChange,
  label,
  src,
  shape = "cover", // 'cover' (16:9) | 'logo' (circle)
  fit = "cover",
  onFitChange,
}) {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState(null);

  const pct = positionToPercent(position);
  const z = zoom || 1;

  const beginDrag = (e) => {
    if (!src) return;
    e.preventDefault();
    const point = e.touches?.[0] ?? e;
    dragRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      originX: pct.x,
      originY: pct.y,
      rect: frameRef.current?.getBoundingClientRect(),
    };
    setDragging(true);
  };

  const onMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d?.rect) return;
      const point = e.touches?.[0] ?? e;

      // object-position moves the image OPPOSITE to the percentage, so the
      // delta is inverted — otherwise dragging left would push the picture
      // right and feel broken.
      //
      // Divided by (zoom - 1) worth of overflow: at 1x there's nothing to
      // pan, and the further you're zoomed the less the image needs to move
      // per pixel of cursor travel for the same visual shift.
      const travelX = Math.max(1, d.rect.width * Math.max(0.25, z - 1));
      const travelY = Math.max(1, d.rect.height * Math.max(0.25, z - 1));

      const nextX = d.originX - ((point.clientX - d.startX) / travelX) * 100;
      const nextY = d.originY - ((point.clientY - d.startY) / travelY) * 100;
      onPositionChange(formatPosition(nextX, nextY));
    },
    [onPositionChange, z],
  );

  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
  }, [dragging, onMove]);

  const isLogo = shape === "logo";
  const canChooseFit = !isLogo && onFitChange;
  const effectiveFit = resolveSmartImageFit(fit, naturalRatio);
  const isContained = canChooseFit && effectiveFit === "contain";
  const isSmart = canChooseFit && fit === "smart";

  const chooseSmart = () => {
    onFitChange("smart");
    onPositionChange(formatPosition(50, 50));
    onZoomChange(1);
  };

  const chooseFit = () => {
    onFitChange("contain");
    onPositionChange(formatPosition(50, 50));
    onZoomChange(1);
  };

  const chooseReposition = () => onFitChange("cover");

  const frameSize = isLogo
    ? "w-24 h-24 rounded-full"
    : "w-full max-w-[12rem] aspect-[16/9] rounded-xl";

  return (
    <div className="mt-3 rounded-xl border border-background-200/80 bg-background-50/70 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        {label && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-600">
            {label}
          </p>
        )}
        {src && (
          <span className="text-[10px] font-label text-foreground-400">
            Drag the preview to adjust
          </span>
        )}
      </div>

      <div className={`grid items-start gap-4 ${isLogo ? "grid-cols-[6rem_minmax(0,1fr)]" : "sm:grid-cols-[12rem_minmax(0,1fr)]"}`}>
        <div
          ref={frameRef}
          onMouseDown={isContained ? undefined : beginDrag}
          onTouchStart={isContained ? undefined : beginDrag}
          className={`relative overflow-hidden bg-background-100 border-2 flex-shrink-0 select-none ${
            frameSize
          } ${
            src && !isContained
              ? dragging
                ? "border-primary-500 cursor-grabbing"
                : "border-background-300 cursor-grab hover:border-primary-400"
              : src
              ? "border-background-300"
              : "border-dashed border-background-300"
          }`}
          style={{ touchAction: "none" }}
        >
          {src ? (
            <>
              <img
                src={src}
                alt="Position preview"
                draggable={false}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setNaturalRatio(image.naturalWidth / image.naturalHeight);
                }}
                className={`w-full h-full pointer-events-none ${isContained ? "object-contain" : "object-cover"}`}
                style={imageCropStyle(position, zoom, isContained ? "contain" : "cover")}
              />
              {/* Only while dragging — a permanent grid would read as part of
                  the picture rather than a tool. */}
              {dragging && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 inset-y-0 w-px bg-background-50/50" />
                  <div className="absolute left-2/3 inset-y-0 w-px bg-background-50/50" />
                  <div className="absolute top-1/3 inset-x-0 h-px bg-background-50/50" />
                  <div className="absolute top-2/3 inset-x-0 h-px bg-background-50/50" />
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <i className="ri-image-line text-foreground-300 text-xl" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          {canChooseFit && (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-500">
                Display
              </p>
              <div className="grid grid-cols-3 rounded-lg border border-background-200 bg-background-100 p-1" aria-label="Cover photo display">
                <button
                  type="button"
                  onClick={chooseSmart}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                    isSmart
                      ? "bg-background-50 text-primary-800 shadow-sm"
                      : "text-foreground-500 hover:text-foreground-800"
                  }`}
                >
                  Smart
                </button>
                <button
                  type="button"
                  aria-label="Fit full image"
                  onClick={chooseFit}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                    fit === "contain"
                      ? "bg-background-50 text-primary-800 shadow-sm"
                      : "text-foreground-500 hover:text-foreground-800"
                  }`}
                >
                  Full image
                </button>
                <button
                  type="button"
                  onClick={chooseReposition}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                    fit === "cover"
                      ? "bg-background-50 text-primary-800 shadow-sm"
                      : "text-foreground-500 hover:text-foreground-800"
                  }`}
                >
                  Reposition
                </button>
              </div>
            </div>
          )}
          <p className="mb-3 text-[11px] leading-relaxed font-label text-foreground-500">
            {src
              ? isSmart
                ? effectiveFit === "cover"
                  ? "Smart mode fills this frame and keeps your focal point."
                  : "Smart mode keeps this tall or extra-wide artwork complete."
                : isContained
                  ? "The entire photo is visible. Choose Reposition to crop and move it."
                  : "Drag directly on the preview, then fine-tune the zoom."
              : "Upload an image to position it."}
          </p>

          <div className={`mb-1.5 flex items-center justify-between ${isContained ? "opacity-45" : ""}`}>
            <span className="text-[11px] font-semibold text-foreground-600">Zoom</span>
            <span className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-semibold text-foreground-500">
              {Math.round(z * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.05}
            value={z}
            disabled={!src || isContained}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-primary-500 disabled:opacity-40"
          />

          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              disabled={!src}
              onClick={() => {
                onPositionChange(formatPosition(50, 50));
                onZoomChange(1);
              }}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 hover:text-primary-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
