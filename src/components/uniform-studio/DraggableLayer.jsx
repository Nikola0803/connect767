import { useRef, useState } from "react";
import { useDraggableLayer } from "../../hooks/useDraggableLayer";

export default function DraggableLayer({ layer, stageRef, selected, onSelect, onChange }) {
  const layerRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [editing, setEditing] = useState(false);

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
        onMouseDown={(e) => {
          onSelect(layer.id);
          handleMoveStart(e);
        }}
        onTouchStart={(e) => {
          onSelect(layer.id);
          handleMoveStart(e);
        }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ transform: `rotate(${layer.rotation || 0}deg)` }}
        >
          {layer.type === "text" ? (
            editing ? (
              <input
                autoFocus
                value={layer.text}
                maxLength={14}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => onChange(layer.id, { text: e.target.value.toUpperCase() })}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditing(false);
                }}
                style={{
                  color: layer.color,
                  fontSize: `${fontSize}px`,
                  fontFamily: layer.fontFamily || "'Oswald', sans-serif",
                }}
                className="font-bold uppercase tracking-wide bg-background-50/90 rounded px-1 outline-none border border-primary-400"
              />
            ) : (
              <span
                className="font-bold uppercase tracking-wide whitespace-nowrap"
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
                aria-label="Resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
                className="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-primary-500 text-background-50 flex items-center justify-center cursor-nwse-resize shadow-sm"
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
