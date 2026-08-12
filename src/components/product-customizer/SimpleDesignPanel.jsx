import { clipartLibrary } from "../../data/customizer";
import ColorPickerPanel from "./ColorPickerPanel";

/**
 * Design controls panel — color, text, logo, icons.
 * Clean, dark-themed for full-screen customizer.
 */
export default function SimpleDesignPanel({
  colorPalette,
  color,
  setColor,
  allowText,
  allowLogo,
  onAddText,
  uploads,
  onUploadNew,
  onAddFromLibrary,
  onAddClipart,
}) {
  return (
    <div className="space-y-6">
      {/* Color picker */}
      <div>
        <ColorPickerPanel
          colorPalette={colorPalette}
          currentColor={color}
          onColorChange={setColor}
        />
      </div>

      {/* Add text */}
      {allowText && (
        <div>
          <button
            type="button"
            onClick={onAddText}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-primary-500 bg-primary-500/20 text-sm font-semibold text-primary-300 hover:bg-primary-500/30 transition-colors cursor-pointer"
          >
            <i className="ri-add-line" />
            Add text
          </button>
          <p className="text-xs text-background-400 font-label mt-2">Double-click to edit text</p>
        </div>
      )}

      {/* Upload logo */}
      {allowLogo && (
        <div>
          <label className="flex flex-col items-center justify-center gap-2 w-full py-4 rounded-lg border-2 border-dashed border-background-600 hover:border-primary-500 hover:bg-primary-500/10 cursor-pointer transition-colors text-center mb-3">
            <i className="ri-upload-cloud-2-line text-xl text-background-400" />
            <span className="text-xs text-background-300 font-label">Upload logo (PNG/SVG)</span>
            <input type="file" accept="image/*" className="hidden" onChange={onUploadNew} />
          </label>

          {/* Recent uploads */}
          {uploads.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-background-400 uppercase tracking-wide mb-2">
                Your uploads
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {uploads.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onAddFromLibrary(u)}
                    className="aspect-square rounded-lg border border-background-700 bg-background-800/50 hover:border-primary-500 hover:bg-primary-500/20 transition-colors overflow-hidden p-1"
                    title="Add to design"
                  >
                    <img src={u.src} alt="Upload" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Icon library */}
          <p className="text-[10px] font-semibold text-background-400 uppercase tracking-wide mb-2">
            Or pick an icon
          </p>
          <div className="grid grid-cols-4 gap-2">
            {clipartLibrary.slice(0, 8).map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.label}
                onClick={() => onAddClipart(c)}
                className="aspect-square flex items-center justify-center rounded-lg border border-background-700 bg-background-800/50 text-background-300 hover:border-primary-500 hover:bg-primary-500/20 hover:text-primary-300 transition-all cursor-pointer"
              >
                <i className={`${c.icon} text-lg`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
