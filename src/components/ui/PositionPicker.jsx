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

  const chooseReposition = () => {
    if (onFitChange) onFitChange("cover");
  };

  const beginRepositionFromHandle = (event) => {
    event.stopPropagation();
    if (!src) return;
    if (canChooseFit && fit !== "cover") {
      onFitChange("cover");
    }
    beginDrag(event);
  };

  const changeZoom = (amount) => {
    const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + amount));
    onZoomChange(Number(nextZoom.toFixed(2)));
  };

  const frameSize = isLogo
    ? "h-32 w-32 rounded-full"
    : "w-full aspect-[16/9] rounded-2xl";

  const zoomDisabled = !src || isContained;

  return (
    <div className="mt-3 rounded-2xl border border-background-200/80 bg-background-50/70 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        {label && (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-600">
            {label}
          </p>
        )}
        {src && (
          <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-400">
            <i className="ri-drag-move-2-line" aria-hidden="true" />
            Drag photo to reposition
          </span>
        )}
      </div>

      <div className={`flex ${isLogo ? "justify-center" : "w-full"}`}>
        <div
          ref={frameRef}
          onMouseDown={isContained ? undefined : beginDrag}
          onTouchStart={isContained ? undefined : beginDrag}
          className={`relative overflow-hidden bg-background-100 border-2 flex-shrink-0 select-none shadow-sm ${
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
              <div
                className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-xl border border-background-200 bg-background-50/95 p-1 shadow-md backdrop-blur-sm"
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="Reposition photo"
                  title="Drag to reposition photo"
                  onMouseDown={beginRepositionFromHandle}
                  onTouchStart={beginRepositionFromHandle}
                  onClick={chooseReposition}
                  className={`flex h-9 w-9 cursor-move items-center justify-center rounded-lg transition-colors ${
                    isLogo || fit === "cover"
                      ? "bg-primary-600 text-background-50"
                      : "text-foreground-600 hover:bg-primary-50 hover:text-primary-800"
                  }`}
                >
                  <i className="ri-drag-move-2-line text-base" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={zoomDisabled || z <= ZOOM_MIN}
                  onClick={() => changeZoom(-0.1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 transition-colors hover:bg-primary-50 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <i className="ri-subtract-line text-base" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  disabled={zoomDisabled || z >= ZOOM_MAX}
                  onClick={() => changeZoom(0.1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-600 transition-colors hover:bg-primary-50 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <i className="ri-add-line text-base" aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <i className="ri-image-line text-foreground-300 text-xl" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 min-w-0">
          {canChooseFit && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground-500">
                Display
              </p>
              <div className="grid grid-cols-3 gap-2" aria-label="Cover photo display">
                <button
                  type="button"
                  onClick={chooseSmart}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    isSmart
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-background-200 bg-background-50 text-foreground-500 hover:border-primary-300 hover:text-foreground-800"
                  }`}
                >
                  <i className="ri-magic-line text-base" aria-hidden="true" />
                  Smart
                </button>
                <button
                  type="button"
                  aria-label="Fit full image"
                  onClick={chooseFit}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    fit === "contain"
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-background-200 bg-background-50 text-foreground-500 hover:border-primary-300 hover:text-foreground-800"
                  }`}
                >
                  <i className="ri-aspect-ratio-line text-base" aria-hidden="true" />
                  Full image
                </button>
                <button
                  type="button"
                  onClick={chooseReposition}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    fit === "cover"
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-background-200 bg-background-50 text-foreground-500 hover:border-primary-300 hover:text-foreground-800"
                  }`}
                >
                  <i className="ri-drag-move-2-line text-base" aria-hidden="true" />
                  Reposition
                </button>
              </div>
            </div>
          )}
          <p className="mb-4 text-sm leading-relaxed font-label text-foreground-500">
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

          <div className={`mb-2 flex items-center justify-between ${isContained ? "opacity-45" : ""}`}>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-600">
              <i className="ri-zoom-in-line text-base" aria-hidden="true" />
              Zoom
            </span>
            <span className="rounded-full bg-background-100 px-2.5 py-1 text-xs font-semibold text-foreground-500">
              {Math.round(z * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease zoom"
              disabled={zoomDisabled || z <= ZOOM_MIN}
              onClick={() => changeZoom(-0.1)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-background-200 bg-background-50 text-foreground-600 transition-colors hover:border-primary-300 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <i className="ri-subtract-line" aria-hidden="true" />
            </button>
            <input
              type="range"
              aria-label="Photo zoom"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.05}
              value={z}
              disabled={zoomDisabled}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="min-w-0 flex-1 cursor-pointer accent-primary-500 disabled:opacity-40"
            />
            <button
              type="button"
              aria-label="Increase zoom"
              disabled={zoomDisabled || z >= ZOOM_MAX}
              onClick={() => changeZoom(0.1)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-background-200 bg-background-50 text-foreground-600 transition-colors hover:border-primary-300 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <i className="ri-add-line" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!src}
              onClick={() => {
                onPositionChange(formatPosition(50, 50));
                onZoomChange(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 hover:text-primary-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-restart-line text-sm" aria-hidden="true" />
              Reset position
            </button>
          </div>
      </div>
    </div>
  );
}
