/**
 * Replaces the old ProductFloatingToolbar (font/bold/italic/outline/
 * shadow/curve/duplicate/reorder — eight controls for a tool meant to be
 * simple). Dragging to move, and the resize/rotate handles, live directly
 * on the selected element already (see ProductDraggableLayer.jsx) — this
 * bar only adds the two things that can't happen by touching the element
 * itself: changing its color, and removing it.
 */
const QUICK_COLORS = ["#1b1a16", "#ffffff", "#e4583a", "#0c8a57", "#1f5c7a", "#d98c3f"];

export default function SelectedLayerBar({ layer, onUpdate, onDelete }) {
  const canRecolor = layer.type === "text" || layer.type === "clipart";

  return (
    <div className="inline-flex items-center gap-3 bg-foreground-950 text-background-50 rounded-full px-3 py-2 shadow-lg">
      {canRecolor && (
        <div className="flex items-center gap-1.5">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => onUpdate(layer.id, { color: c })}
              className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform ${
                layer.color === c ? "border-background-50 scale-110" : "border-background-50/30 hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label="Remove"
        onClick={() => onDelete(layer.id)}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-background-50/10 hover:bg-accent-500 transition-colors cursor-pointer"
      >
        <i className="ri-delete-bin-line text-sm" />
      </button>
    </div>
  );
}
