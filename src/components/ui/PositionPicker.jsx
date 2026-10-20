import { useCallback, useEffect, useRef, useState } from "react";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  positionToPercent,
  formatPosition,
  imageCropStyle,
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
  const isContained = canChooseFit && fit === "contain";

  const chooseFit = () => {
    onFitChange("contain");
    onPositionChange(formatPosition(50, 50));
    onZoomChange(1);
  };

  const chooseReposition = () => onFitChange("cover");

  return (
    <div className="mt-3">
      {label && <p className="text-[11px] font-label text-foreground-500 mb-1.5">{label}</p>}

      <div className="flex items-start gap-4">
        <div
          ref={frameRef}
          onMouseDown={isContained ? undefined : beginDrag}
          onTouchStart={isContained ? undefined : beginDrag}
          className={`relative overflow-hidden bg-background-100 border-2 flex-shrink-0 select-none ${
            isLogo ? "w-24 h-24 rounded-full" : "w-40 aspect-[16/9] rounded-lg"
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
                className={`w-full h-full pointer-events-none ${isContained ? "object-contain" : "object-cover"}`}
                style={imageCropStyle(position, zoom, isContained ? "contain" : "cover")}
              />
              {!isContained && !dragging && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-foreground-950/70 text-background-50 text-[10px] font-semibold shadow-sm">
                    <i className="ri-drag-move-2-line text-sm" />
                    Drag to reposition
                  </span>
                </div>
              )}
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

        <div className="flex-1 min-w-0 pt-0.5">
          {canChooseFit && (
            <div className="grid grid-cols-2 gap-2 mb-3" aria-label="Cover photo display">
              <button
                type="button"
                onClick={chooseFit}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                  isContained
                    ? "border-primary-500 bg-primary-50 text-primary-800"
                    : "border-background-300 text-foreground-600 hover:border-primary-300"
                }`}
              >
                <i className="ri-aspect-ratio-line text-sm" />
                Fit full image
              </button>
              <button
                type="button"
                onClick={chooseReposition}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                  !isContained
                    ? "border-primary-500 bg-primary-50 text-primary-800"
                    : "border-background-300 text-foreground-600 hover:border-primary-300"
                }`}
              >
                <i className="ri-drag-move-2-line text-sm" />
                Reposition
              </button>
            </div>
          )}
          <p className="text-[11px] font-label text-foreground-500 mb-2">
            {src
              ? isContained
                ? "The entire photo will be visible. Choose Reposition to crop and move it."
                : "Drag the image freely inside the frame."
              : "Upload an image to position it."}
          </p>

          <div className={`flex items-center justify-between mb-1 ${isContained ? "opacity-45" : ""}`}>
            <span className="text-[11px] font-label text-foreground-500">Zoom</span>
            <span className="text-[11px] font-label text-foreground-500">
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

          <button
            type="button"
            disabled={!src}
            onClick={() => {
              onPositionChange(formatPosition(50, 50));
              onZoomChange(1);
            }}
            className="mt-2 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reset to centre
          </button>
        </div>
      </div>
    </div>
  );
}
