import { useEffect, useRef } from "react";
import { fontOptions } from "../../data/uniforms";

/**
 * Controls for whatever is currently selected on the garment.
 *
 * These used to float over the 3D canvas as drei <Html> overlays — a text
 * field, a colour row and a button bar, stacked ~100px tall and offset above
 * the artwork. That put a DOM element directly over the model, so it
 * swallowed the clicks meant for the garment underneath: dragging stopped
 * working, typing wouldn't focus, and the whole studio felt dead. Plain DOM
 * in the side panel can't fight the canvas for pointer events, and it's
 * always in the same place instead of moving with the camera.
 */

const TEXT_COLOURS = [
  "#1b1a16",
  "#ffffff",
  "#c0392b",
  "#e4a11b",
  "#0c8a57",
  "#1f5c7a",
  "#4b2e83",
  "#e4583a",
];

const MIN_SCALE = 0.04;
const MAX_SCALE = 0.8;

export default function SelectedItemPanel({
  layer,
  placement,
  onTextChange,
  onColorChange,
  onFontChange,
  onGradientChange,
  onScaleChange,
  onRotateChange,
  onDelete,
}) {
  const inputRef = useRef(null);
  const isText = layer?.type === "text";

  // Focus the field as soon as a text item is created, so "Add text" goes
  // straight to typing. Keyed on the layer id: re-running on every render
  // would steal focus back mid-edit.
  useEffect(() => {
    if (!isText || !inputRef.current) return;
    const el = inputRef.current;
    const id = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [layer?.id, isText]);

  if (!layer) {
    return (
      <div className="rounded-xl border border-dashed border-background-300 bg-background-100/40 p-4 text-center">
        <i className="ri-cursor-line text-xl text-foreground-300" />
        <p className="text-xs text-foreground-500 font-label mt-1.5">
          Click something on the garment to edit it.
        </p>
      </div>
    );
  }

  const label =
    layer.type === "text" ? "Text" : layer.type === "skin" ? "Skin" : "Logo";

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-800">
          Selected · {label}
        </span>
        <button
          type="button"
          onClick={() => onDelete(layer.id)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 hover:text-accent-700 cursor-pointer"
        >
          <i className="ri-delete-bin-line" />
          Remove
        </button>
      </div>

      {isText && (
        <>
          <label className="block text-xs font-semibold text-foreground-800 mb-1.5" htmlFor="sel-text">
            Wording
          </label>
          <input
            id="sel-text"
            ref={inputRef}
            value={layer.text ?? ""}
            onChange={(e) => onTextChange(layer.id, e.target.value)}
            placeholder="Type your text"
            className="w-full px-3 py-2.5 text-sm rounded-lg border-2 border-primary-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 font-label mb-4"
          />

          <label className="block text-xs font-semibold text-foreground-800 mb-1.5" htmlFor="sel-font">
            Font
          </label>
          <select
            id="sel-font"
            value={layer.fontFamily || fontOptions[0].family}
            onChange={(e) => onFontChange(layer.id, e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 focus:outline-none focus:border-primary-400 cursor-pointer mb-4"
          >
            {fontOptions.map((f) => (
              // Rendered in its own typeface so the list is a preview, not a
              // list of adjectives to guess between.
              <option key={f.key} value={f.family} style={{ fontFamily: f.family }}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground-800">
              {layer.gradient ? "Colours (fades top to bottom)" : "Colour"}
            </span>
            <button
              type="button"
              onClick={() =>
                onGradientChange(layer.id, {
                  gradient: !layer.gradient,
                  // Seed the second stop the first time so switching on
                  // produces a visible fade instead of a flat block.
                  color2: layer.color2 || "#c0392b",
                })
              }
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                layer.gradient
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-200 text-foreground-600 hover:bg-background-300"
              }`}
            >
              {layer.gradient ? "Gradient on" : "Gradient"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {TEXT_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Text colour ${c}`}
                onClick={() => onColorChange(layer.id, c)}
                className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                  layer.color === c
                    ? "border-primary-500 ring-2 ring-primary-300 scale-110"
                    : "border-background-300"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {layer.gradient && (
            <>
              <span className="block text-[11px] font-semibold text-foreground-600 mb-1.5">
                Fades to
              </span>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {TEXT_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Gradient end colour ${c}`}
                    onClick={() => onGradientChange(layer.id, { gradient: true, color2: c })}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                      layer.color2 === c
                        ? "border-primary-500 ring-2 ring-primary-300 scale-110"
                        : "border-background-300"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Size and rotation exist in both editors, they're just stored
          differently: the 3D view keeps a world-space scale on the placement,
          the flat editor a percentage on the layer. Reading whichever is
          present keeps one panel serving both. */}
      {(() => {
        const in3d = Boolean(placement);
        const sizeValue = in3d ? placement.scale : (layer.size ?? 16);
        const sizeMin = in3d ? MIN_SCALE : 4;
        const sizeMax = in3d ? MAX_SCALE : 60;
        const sizeStep = in3d ? 0.005 : 1;
        return (
        <>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground-800" htmlFor="sel-size">
              Size
            </label>
            <span className="text-[11px] text-foreground-500 font-label">
              {Math.round((sizeValue / sizeMax) * 100)}%
            </span>
          </div>
          <input
            id="sel-size"
            type="range"
            min={sizeMin}
            max={sizeMax}
            step={sizeStep}
            value={sizeValue}
            onChange={(e) => onScaleChange(layer.id, Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-background-200 accent-primary-500 mb-4"
          />

          <span className="block text-xs font-semibold text-foreground-800 mb-1.5">Rotate</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRotateChange(layer.id, -1)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-background-300 bg-background-50 text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer"
            >
              <i className="ri-anticlockwise-line" />
              Left
            </button>
            <button
              type="button"
              onClick={() => onRotateChange(layer.id, 1)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-background-300 bg-background-50 text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer"
            >
              <i className="ri-clockwise-line" />
              Right
            </button>
          </div>

          <p className="text-[11px] text-foreground-500 font-label mt-3">
            Drag it on the design to move it.
          </p>
        </>
        );
      })()}
    </div>
  );
}
