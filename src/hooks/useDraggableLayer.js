import { useCallback, useRef } from "react";

const SNAP_THRESHOLD = 2; // percentage points

/**
 * Drag-to-move, drag-to-resize, and drag-to-rotate for a layer positioned
 * (in %) within a bounded stage element. Percent-based positioning means
 * layers stay put correctly if the stage is ever resized. Move mode snaps
 * to the stage's horizontal/vertical center, like the alignment guides in
 * real design tools.
 *
 * onChange receives the full updated { x, y, size, rotation } each time it
 * changes. onSnap(axis|null) fires so the caller can render a guide line.
 */
export function useDraggableLayer({
  stageRef,
  layerRef,
  x,
  y,
  size,
  rotation = 0,
  onChange,
  onSnap,
  minSize = 6,
  maxSize = 120,
}) {
  const dragState = useRef(null);

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const startTracking = () => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
  };

  const handleMoveStart = useCallback(
    (e) => {
      e.stopPropagation();
      const point = "touches" in e ? e.touches[0] : e;
      dragState.current = {
        mode: "move",
        startClientX: point.clientX,
        startClientY: point.clientY,
        startX: x,
        startY: y,
        size,
        rotation,
      };
      startTracking();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x, y, size, rotation]
  );

  const handleResizeStart = useCallback(
    (e) => {
      e.stopPropagation();
      const point = "touches" in e ? e.touches[0] : e;
      dragState.current = {
        mode: "resize",
        startClientX: point.clientX,
        startClientY: point.clientY,
        startSize: size,
        x,
        y,
        rotation,
      };
      startTracking();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x, y, size, rotation]
  );

  const handleRotateStart = useCallback(
    (e) => {
      e.stopPropagation();
      dragState.current = { mode: "rotate", x, y, size };
      startTracking();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x, y, size, rotation]
  );

  function handleMove(e) {
    if (!dragState.current || !stageRef.current) return;
    if (e.cancelable) e.preventDefault();
    const point = "touches" in e ? e.touches[0] : e;
    const rect = stageRef.current.getBoundingClientRect();
    const state = dragState.current;

    if (state.mode === "move") {
      const dxPct = ((point.clientX - state.startClientX) / rect.width) * 100;
      const dyPct = ((point.clientY - state.startClientY) / rect.height) * 100;
      let nextX = clamp(state.startX + dxPct, 0, 100);
      let nextY = clamp(state.startY + dyPct, 0, 100);
      let snapAxis = null;

      if (Math.abs(nextX - 50) < SNAP_THRESHOLD) {
        nextX = 50;
        snapAxis = "x";
      }
      if (Math.abs(nextY - 50) < SNAP_THRESHOLD) {
        nextY = 50;
        snapAxis = snapAxis ? "both" : "y";
      }
      onSnap?.(snapAxis);
      onChange({ x: nextX, y: nextY, size: state.size, rotation: state.rotation });
    } else if (state.mode === "resize") {
      const dx = (point.clientX - state.startClientX) / rect.width;
      const dy = (point.clientY - state.startClientY) / rect.height;
      const delta = ((dx + dy) / 2) * 100;
      onChange({
        x: state.x,
        y: state.y,
        size: clamp(state.startSize + delta, minSize, maxSize),
        rotation: state.rotation,
      });
    } else if (state.mode === "rotate" && layerRef?.current) {
      const box = layerRef.current.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const angle = (Math.atan2(point.clientY - cy, point.clientX - cx) * 180) / Math.PI + 90;
      onChange({ x: state.x, y: state.y, size: state.size, rotation: Math.round(angle) });
    }
  }

  function handleEnd() {
    dragState.current = null;
    onSnap?.(null);
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleEnd);
    window.removeEventListener("touchmove", handleMove);
    window.removeEventListener("touchend", handleEnd);
  }

  return { handleMoveStart, handleResizeStart, handleRotateStart };
}
