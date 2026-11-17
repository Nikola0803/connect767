import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const CONTROLS = "button, input, textarea, select, [contenteditable='true']";
const isEditingTarget = (target, includeZones = true) => Boolean(target?.closest?.(
  `${CONTROLS}, [data-production-layer]${includeZones ? ", [data-zone-id]" : ""}`,
));

/** View transforms stay outside JerseyStage so artwork coordinates and full
 * design exports are independent of how closely the customer is inspecting it. */
const ProductionViewport = forwardRef(function ProductionViewport({
  children, zoom, onZoomChange, panMode = false, placingArtwork = false, contentClassName = "",
}, ref) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const dragRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const measure = () => {
      if (!viewport.clientWidth || !viewport.clientHeight || !content.offsetWidth || !content.offsetHeight) return;
      setFitScale(Math.min(1, viewport.clientWidth / content.offsetWidth, viewport.clientHeight / content.offsetHeight));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const reset = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setPan({ x: 0, y: 0 });
    onZoomChange(1);
  }, [onZoomChange]);
  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const wheel = (event) => {
      // The wheel over artwork continues to resize that artwork. Ctrl/Cmd
      // explicitly requests viewport zoom, even when over an artwork layer.
      if (isEditingTarget(event.target, false) && !event.ctrlKey && !event.metaKey) return;
      if (!event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      onZoomChange((current) => current + (event.deltaY < 0 ? 0.1 : -0.1));
    };
    viewport.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => viewport.removeEventListener("wheel", wheel, { capture: true });
  }, [onZoomChange]);

  const endDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <div
    ref={viewportRef}
    role="group"
    aria-label="Production map viewport"
    tabIndex={0}
    className="relative z-0 flex min-h-0 w-full flex-1 items-start justify-center overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    style={{ touchAction: "none", cursor: dragging ? "grabbing" : panMode ? "grab" : undefined }}
    onPointerDownCapture={(event) => {
      if (placingArtwork || event.target.closest?.(CONTROLS) || (event.button !== 0 && event.button !== 1)) return;
      const forcedPan = panMode || event.button === 1 || event.altKey;
      if (!forcedPan && isEditingTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
      setDragging(true);
    }}
    onPointerMove={(event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPan({ x: drag.pan.x + event.clientX - drag.x, y: drag.pan.y + event.clientY - drag.y });
    }}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
    onLostPointerCapture={() => { dragRef.current = null; setDragging(false); }}
    onDoubleClick={(event) => {
      if (placingArtwork || isEditingTarget(event.target)) return;
      reset();
    }}
    onKeyDown={(event) => {
      if (isEditingTarget(event.target)) return;
      const step = event.shiftKey ? 40 : 16;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (delta) {
        event.preventDefault();
        setPan((current) => ({ x: current.x + delta[0], y: current.y + delta[1] }));
      } else if (["+", "=", "-", "_", "0"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "0") reset();
        else onZoomChange((current) => current + (["+", "="].includes(event.key) ? 0.1 : -0.1));
      }
    }}
  >
    <div ref={contentRef} data-production-transform className={`w-full shrink-0 will-change-transform ${contentClassName}`}
      style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom * fitScale})`, transformOrigin: "top center" }}>
      {children}
    </div>
  </div>;
});

export default ProductionViewport;
