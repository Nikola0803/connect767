import { useId, useRef, useState } from "react";
import { useDraggableLayer } from "../../hooks/useDraggableLayer";

/**
 * Forked from uniform-studio/DraggableLayer.jsx rather than shared, so the
 * product customizer's extra features (clipart layers, opacity, text
 * effects, curved text) can't ever regress the Uniform Studio — the two
 * tools' drag/resize/rotate physics come from the same underlying
 * `useDraggableLayer` hook either way, so the core feel is identical.
 */
export default function ProductDraggableLayer({ layer, stageRef, selected, onSelect, onChange }) {
  const layerRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [editing, setEditing] = useState(Boolean(layer.autoEdit));
  const curveId = useId();

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

  const fontSize = 10 + layer.size * 1.1;
  const opacity = (layer.opacity ?? 100) / 100;
  const curve = layer.curve || 0;

  const textStyle = {
    color: layer.color,
    fontSize: `${fontSize}px`,
    fontFamily: layer.fontFamily || "'Oswald', sans-serif",
    fontWeight: layer.bold ? 900 : undefined,
    fontStyle: layer.italic ? "italic" : undefined,
    WebkitTextStroke: layer.outline ? `1.5px ${layer.outlineColor || "#1b1a16"}` : undefined,
    textShadow: layer.shadow ? "0 3px 6px rgba(0,0,0,0.35)" : undefined,
  };

  return (
    <>
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
          opacity,
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
          {layer.type === "text" && curve > 0 ? (
            <svg width={fontSize * 10} height={fontSize * 4} style={{ overflow: "visible" }}>
              <defs>
                <path
                  id={curveId}
                  d={`M 10,${fontSize * 2 + curve / 4} A ${fontSize * 8},${curve * 3} 0 0 1 ${fontSize * 10 - 10},${fontSize * 2 + curve / 4}`}
                  fill="none"
                />
              </defs>
              <text style={{ ...textStyle, fontSize: `${fontSize}px` }} className="font-bold uppercase tracking-wide">
                <textPath href={`#${curveId}`} startOffset="50%" textAnchor="middle">
                  {layer.text || "TEXT"}
                </textPath>
              </text>
            </svg>
          ) : layer.type === "text" ? (
            editing ? (
              <input
                autoFocus
                value={layer.text}
                maxLength={20}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => onChange(layer.id, { text: e.target.value.toUpperCase() })}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditing(false);
                }}
                style={textStyle}
                className="font-bold uppercase tracking-wide bg-background-50/90 rounded px-1 outline-none border border-primary-400"
              />
            ) : (
              <span
                className="font-bold uppercase tracking-wide whitespace-nowrap relative"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                style={{ ...textStyle, lineHeight: 1 }}
              >
                {layer.text || "TEXT"}
                {selected && (
                  <button
                    type="button"
                    aria-label="Edit text"
                    title="Edit text"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(true);
                    }}
                    className="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-sm cursor-pointer"
                  >
                    <i className="ri-pencil-fill" style={{ fontSize: "10px" }} />
                  </button>
                )}
              </span>
            )
          ) : layer.type === "clipart" ? (
            <i
              className={layer.icon}
              style={{ fontSize: `${layer.size * 3}px`, color: layer.color }}
              draggable={false}
            />
          ) : (
            <img
              src={layer.src}
              alt="Uploaded artwork"
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
