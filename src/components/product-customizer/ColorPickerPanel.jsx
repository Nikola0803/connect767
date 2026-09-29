/**
 * Simple color picker — preset colors + custom picker.
 */
export default function ColorPickerPanel({
  colorPalette,
  currentColor,
  onColorChange,
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-background-300 mb-3">
        Pick a color
      </p>

      {/* Preset color grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {colorPalette.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => onColorChange(c)}
            className={`aspect-square rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${
              currentColor === c
                ? "border-primary-400 ring-2 ring-primary-300"
                : "border-background-700 hover:border-background-600"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      {/* Custom color picker */}
      <div>
        <label htmlFor="custom-color" className="text-xs font-semibold text-background-300 block mb-2">
          Or pick custom
        </label>
        <div className="flex gap-2">
          <input
            id="custom-color"
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-10 w-14 rounded-lg border border-background-700 cursor-pointer"
          />
          <input
            type="text"
            value={currentColor}
            onChange={(e) => {
              if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                onColorChange(e.target.value);
              }
            }}
            maxLength="7"
            placeholder="#000000"
            className="flex-1 px-2 py-2 text-xs rounded-lg border border-background-700 bg-background-800 font-mono text-background-50 placeholder-background-500 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>
    </div>
  );
}
