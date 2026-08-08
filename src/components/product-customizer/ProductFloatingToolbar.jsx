import { garmentColorPalette, fontOptions } from "../../data/customizer";

export default function ProductFloatingToolbar({ layer, onUpdate, onDuplicate, onDelete, onReorder }) {
  if (!layer) return null;
  const isText = layer.type === "text";

  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-background-50/95 backdrop-blur-md border border-background-200/80 shadow-lg shadow-foreground-950/5 overflow-x-auto max-w-full">
      {isText && (
        <>
          <select
            value={layer.fontFamily}
            onChange={(e) => onUpdate(layer.id, { fontFamily: e.target.value })}
            className="bg-background-100 text-foreground-800 text-xs font-medium rounded-lg px-2.5 py-2 border border-background-200/70 focus:outline-none cursor-pointer flex-shrink-0"
          >
            {fontOptions.map((f) => (
              <option key={f.key} value={f.family}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              aria-label="Bold"
              onClick={() => onUpdate(layer.id, { bold: !layer.bold })}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer font-black text-xs ${
                layer.bold ? "bg-primary-500 text-background-50" : "hover:bg-background-100 text-foreground-700"
              }`}
            >
              B
            </button>
            <button
              type="button"
              aria-label="Italic"
              onClick={() => onUpdate(layer.id, { italic: !layer.italic })}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer italic text-xs ${
                layer.italic ? "bg-primary-500 text-background-50" : "hover:bg-background-100 text-foreground-700"
              }`}
            >
              I
            </button>
            <button
              type="button"
              aria-label="Outline"
              title="Outline"
              onClick={() => onUpdate(layer.id, { outline: !layer.outline })}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer ${
                layer.outline ? "bg-primary-500 text-background-50" : "hover:bg-background-100 text-foreground-700"
              }`}
            >
              <i className="ri-shape-line text-sm" />
            </button>
            <button
              type="button"
              aria-label="Shadow"
              title="Drop shadow"
              onClick={() => onUpdate(layer.id, { shadow: !layer.shadow })}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer ${
                layer.shadow ? "bg-primary-500 text-background-50" : "hover:bg-background-100 text-foreground-700"
              }`}
            >
              <i className="ri-drop-line text-sm" />
            </button>
          </div>

          <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />

          <div className="flex items-center gap-1 flex-shrink-0" title="Curve text">
            <i className="ri-line-height text-foreground-400 text-sm" />
            <input
              type="range"
              min="0"
              max="40"
              value={layer.curve || 0}
              onChange={(e) => onUpdate(layer.id, { curve: Number(e.target.value) })}
              className="w-16 cursor-pointer accent-primary-500"
            />
          </div>

          <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />

          <div className="flex items-center gap-1 flex-shrink-0">
            {garmentColorPalette.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => onUpdate(layer.id, { color: c })}
                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform flex-shrink-0 ${
                  layer.color === c ? "border-foreground-950 scale-110" : "border-background-200"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />
        </>
      )}

      {layer.type === "clipart" && (
        <>
          <div className="flex items-center gap-1 flex-shrink-0">
            {garmentColorPalette.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => onUpdate(layer.id, { color: c })}
                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform flex-shrink-0 ${
                  layer.color === c ? "border-foreground-950 scale-110" : "border-background-200"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />
        </>
      )}

      <div className="flex items-center gap-1 flex-shrink-0" title="Opacity">
        <i className="ri-contrast-2-line text-foreground-400 text-sm" />
        <input
          type="range"
          min="10"
          max="100"
          value={layer.opacity ?? 100}
          onChange={(e) => onUpdate(layer.id, { opacity: Number(e.target.value) })}
          className="w-14 cursor-pointer accent-primary-500"
        />
      </div>

      <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          aria-label="Smaller"
          onClick={() => onUpdate(layer.id, { size: Math.max(6, layer.size - 2) })}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 text-foreground-700 cursor-pointer"
        >
          <i className="ri-subtract-line text-sm" />
        </button>
        <span className="text-xs font-label w-8 text-center text-foreground-600">
          {Math.round(layer.size)}
        </span>
        <button
          type="button"
          aria-label="Bigger"
          onClick={() => onUpdate(layer.id, { size: Math.min(60, layer.size + 2) })}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 text-foreground-700 cursor-pointer"
        >
          <i className="ri-add-line text-sm" />
        </button>
      </div>

      <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />

      <button
        type="button"
        aria-label="Reset rotation"
        onClick={() => onUpdate(layer.id, { rotation: 0 })}
        title="Reset rotation"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 text-foreground-700 cursor-pointer flex-shrink-0"
      >
        <i className="ri-refresh-line text-sm" />
      </button>
      <button
        type="button"
        aria-label="Bring forward"
        onClick={() => onReorder(layer.id, "up")}
        title="Bring forward"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 text-foreground-700 cursor-pointer flex-shrink-0"
      >
        <i className="ri-bring-forward text-sm" />
      </button>
      <button
        type="button"
        aria-label="Send backward"
        onClick={() => onReorder(layer.id, "down")}
        title="Send backward"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 text-foreground-700 cursor-pointer flex-shrink-0"
      >
        <i className="ri-send-backward text-sm" />
      </button>
      <button
        type="button"
        aria-label="Duplicate"
        onClick={() => onDuplicate(layer.id)}
        title="Duplicate (Ctrl+D)"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 text-foreground-700 cursor-pointer flex-shrink-0"
      >
        <i className="ri-file-copy-line text-sm" />
      </button>

      <div className="w-px h-6 bg-background-200/70 flex-shrink-0" />

      <button
        type="button"
        aria-label="Delete"
        onClick={() => onDelete(layer.id)}
        title="Delete (Del)"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent-500 text-accent-600 hover:text-background-50 cursor-pointer flex-shrink-0"
      >
        <i className="ri-delete-bin-line text-sm" />
      </button>
    </div>
  );
}
