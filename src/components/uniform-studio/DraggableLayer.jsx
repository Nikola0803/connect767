import { useRef, useState } from "react";
import { useDraggableLayer } from "../../hooks/useDraggableLayer";

export default function DraggableLayer({ layer, stageRef, selected, onSelect, onChange }) {
  const layerRef = useRef(null);
  const [snap, setSnap] = useState(null);
  // A freshly-added text layer opens straight into its input. Without this,
  // "Add text" dropped an inert word on the jersey and you had to discover
  // that double-clicking it was the way in.
  const [editing, setEditing] = useState(Boolean(layer.autoEdit));

  const { handleMoveStart, handleResizeStart, handleRotateStart } = useDraggableLayer({
    stageRef,
    layerRef,
    x: layer.x,
    y: layer.y,
    size: layer.size,
    rotation: layer.rotation || 0,
    onChange: (patch) => onChange(layer.id, patch),
    onSnap: setSnap,
  });

  const fontSize = 10 + layer.size * 1.1; // px, scales with size %
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const resizeBy = (delta) => {
    onChange(layer.id, {
      x: layer.x,
      y: layer.y,
      size: clamp((layer.size ?? 16) + delta, 6, 120),
      rotation: layer.rotation || 0,
    });
  };

  return (
    <>
      {/* Alignment guides, drawn on the stage while dragging this layer */}
      {selected && (snap === "x" || snap === "both") && (
        <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-accent-500/70 z-10" />
      )}
      {selected && (snap === "y" || snap === "both") && (
        <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-px bg-accent-500/70 z-10" />
      )}

      <div
        ref={layerRef}
        className="absolute select-none"
        style={{
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          transform: "translate(-50%, -50%)",
          cursor: "grab",
          touchAction: "none",
        }}
        role="group"
        tabIndex={selected ? 0 : -1}
        aria-label={`Selected ${layer.type === "text" ? "text" : "artwork"}. Drag to move, use the green handle or mouse wheel to resize.`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect(layer.id);
          handleMoveStart(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onSelect(layer.id);
          handleMoveStart(e);
        }}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(layer.id);
          resizeBy(e.deltaY < 0 ? 2 : -2);
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const movement = {
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
          }[e.key];
          if (movement) {
            e.preventDefault();
            onChange(layer.id, {
              x: clamp(layer.x + movement.x, 0, 100),
              y: clamp(layer.y + movement.y, 0, 100),
              size: layer.size,
              rotation: layer.rotation || 0,
            });
          }
          if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            resizeBy(2);
          }
          if (e.key === "-" || e.key === "_") {
            e.preventDefault();
            resizeBy(-2);
          }
        }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ transform: `rotate(${layer.rotation || 0}deg)` }}
        >
          {layer.type === "text" ? (
            editing ? (
              <textarea
                autoFocus
                // Placeholder text is selected on entry so typing replaces it
                // outright — otherwise every new layer starts with the user
                // deleting "YOUR TEXT" a character at a time.
                onFocus={(e) => e.currentTarget.select()}
                value={layer.text}
                rows={layer.textLayout === "stacked" || layer.text?.includes("\n") ? 2 : 1}
                maxLength={30}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => onChange(layer.id, { text: e.target.value.toUpperCase() })}
                onBlur={() => {
                  setEditing(false);
                  if (layer.autoEdit) onChange(layer.id, { autoEdit: false });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) e.currentTarget.blur();
                }}
                style={{
                  color: layer.color,
                  fontSize: `${fontSize}px`,
                  fontFamily: layer.fontFamily || "'Oswald', sans-serif",
                  lineHeight: 1.05,
                  resize: "none",
                  textAlign: "center",
                }}
                aria-label="Edit uniform text"
                className="overflow-hidden font-bold uppercase tracking-wide bg-background-50/90 rounded px-1 outline-none border border-primary-400"
              />
            ) : (
              <span
                className="font-bold uppercase tracking-wide whitespace-pre-line text-center"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                style={{
                  color: layer.color,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1,
                  fontFamily: layer.fontFamily || "'Oswald', sans-serif",
                }}
              >
                {layer.text || "TEXT"}
              </span>
            )
          ) : (
            <img
              src={layer.src}
              alt="Uploaded logo"
              draggable={false}
              style={{ width: `${layer.size * 3}px`, height: `${layer.size * 3}px` }}
              className="object-contain pointer-events-none"
            />
          )}

          {selected && (
            <div className="absolute inset-0 outline outline-2 outline-primary-500 outline-offset-4 rounded pointer-events-none" />
          )}

          {selected && (
            <>
              <button
                type="button"
                aria-label="Rotate"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleRotateStart(e);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleRotateStart(e);
                }}
                className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-foreground-900 text-background-50 flex items-center justify-center cursor-grab shadow-sm"
                style={{ touchAction: "none", transform: `translateX(-50%) rotate(${-(layer.rotation || 0)}deg)` }}
              >
                <i className="ri-refresh-line text-xs" />
              </button>
              <button
                type="button"
                aria-label="Resize artwork"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
                className="absolute -bottom-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary-500 text-background-50 shadow-md cursor-nwse-resize"
                style={{ touchAction: "none" }}
              >
                <i className="ri-expand-diagonal-line text-xs" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
