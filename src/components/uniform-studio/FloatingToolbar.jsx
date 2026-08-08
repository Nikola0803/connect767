import { zoneColorPalette, fontOptions } from "../../data/uniforms";

export default function FloatingToolbar({ layer, onUpdate, onDuplicate, onDelete, onReorder }) {
  if (!layer) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-foreground-950 text-background-50 shadow-lg overflow-x-auto max-w-full">
      {layer.type === "text" && (
        <>
          <select
            value={layer.fontFamily}
            onChange={(e) => onUpdate(layer.id, { fontFamily: e.target.value })}
            className="bg-foreground-900 text-background-50 text-xs font-medium rounded-lg px-2.5 py-2 border border-background-50/15 focus:outline-none cursor-pointer flex-shrink-0"
          >
            {fontOptions.map((f) => (
              <option key={f.key} value={f.family}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-background-50/15 flex-shrink-0" />

          <div className="flex items-center gap-1 flex-shrink-0">
            {zoneColorPalette.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => onUpdate(layer.id, { color: c })}
                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform flex-shrink-0 ${
                  layer.color === c ? "border-background-50 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-background-50/15 flex-shrink-0" />
        </>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          aria-label="Smaller"
          onClick={() => onUpdate(layer.id, { size: Math.max(6, layer.size - 2) })}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-50/10 cursor-pointer"
        >
          <i className="ri-subtract-line text-sm" />
        </button>
        <span className="text-xs font-label w-8 text-center">{Math.round(layer.size)}</span>
        <button
          type="button"
          aria-label="Bigger"
          onClick={() => onUpdate(layer.id, { size: Math.min(60, layer.size + 2) })}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-50/10 cursor-pointer"
        >
          <i className="ri-add-line text-sm" />
        </button>
      </div>

      <div className="w-px h-6 bg-background-50/15 flex-shrink-0" />

      <button
        type="button"
        aria-label="Reset rotation"
        onClick={() => onUpdate(layer.id, { rotation: 0 })}
        title="Reset rotation"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-50/10 cursor-pointer flex-shrink-0"
      >
        <i className="ri-refresh-line text-sm" />
      </button>
      <button
        type="button"
        aria-label="Bring forward"
        onClick={() => onReorder(layer.id, "up")}
        title="Bring forward"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-50/10 cursor-pointer flex-shrink-0"
      >
        <i className="ri-bring-forward text-sm" />
      </button>
      <button
        type="button"
        aria-label="Send backward"
        onClick={() => onReorder(layer.id, "down")}
        title="Send backward"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-50/10 cursor-pointer flex-shrink-0"
      >
        <i className="ri-send-backward text-sm" />
      </button>
      <button
        type="button"
        aria-label="Duplicate"
        onClick={() => onDuplicate(layer.id)}
        title="Duplicate"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-50/10 cursor-pointer flex-shrink-0"
      >
        <i className="ri-file-copy-line text-sm" />
      </button>

      <div className="w-px h-6 bg-background-50/15 flex-shrink-0" />

      <button
        type="button"
        aria-label="Delete"
        onClick={() => onDelete(layer.id)}
        title="Delete"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent-500/80 text-accent-400 hover:text-background-50 cursor-pointer flex-shrink-0"
      >
        <i className="ri-delete-bin-line text-sm" />
      </button>
    </div>
  );
}
