import { useEffect, useRef, useState } from "react";
import { skinLibrary, skinGroups, skinDataUri, findSkin } from "../../data/skins";
import {
  zoneColorPalette,
  fitTypeOptions,
  kitTypeOptions,
  ADD_ON_PRICES,
  BASE_KIT_PRICE,
  SHIRT_ONLY_PRICE,
  minimumFullKitsFor,
  shirtSizeOptions,
  sportConfigFor,
} from "../../data/uniforms";
import { NO_DETECTED_SOURCE_ELEMENTS, zoneOverlapWarnings, zoneValidation } from "./uniformZoneModel";
import {
  DEFAULT_STUDIO_BACKGROUND,
  STUDIO_BACKGROUND_PRESETS,
  isStudioHex,
} from "./studioBackgrounds";
import AIUniformComposer from "./AIUniformComposer";
import CollarAttachment from "./CollarAttachment";

/** #rrggbb → {r,g,b}, tolerating a missing leading hash. */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/**
 * Shifts a color toward black (amount < 0) or white (amount > 0) on a
 * -100…100 scale — the "navy → royal blue" style ramp, done by mixing
 * rather than naive channel addition so a saturated color stays on its own
 * hue instead of washing out to grey at the extremes.
 */
function shadeColor(hex, amount) {
  if (!amount) return hex;
  const { r, g, b } = hexToRgb(hex);
  const t = Math.abs(amount) / 100;
  const target = amount > 0 ? 255 : 0;
  return `#${toHex(r + (target - r) * t)}${toHex(g + (target - g) * t)}${toHex(b + (target - b) * t)}`;
}

const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);

/**
 * One recolorable zone. Presets stay the fast path (most teams pick a club
 * color and move on), with a full-gamut picker behind a toggle for the
 * clubs whose color is a specific hex, plus a shade slider so a chosen
 * color can be pushed lighter/darker without hunting for a second swatch.
 */
function ColorRow({ label, value, onChange, zone, onHoverZone }) {
  const hoverable = Boolean(zone && onHoverZone);
  const [custom, setCustom] = useState(false);
  const [base, setBase] = useState(value);
  const [shade, setShade] = useState(0);

  useEffect(() => {
    if (!isHex(value)) return;
    setBase(value);
    setShade(0);
  }, [value]);

  const applyBase = (hex) => {
    setBase(hex);
    onChange(shadeColor(hex, shade));
  };

  const applyShade = (next) => {
    setShade(next);
    onChange(shadeColor(base, next));
  };

  return (
    <div
      className={`mb-5 -mx-2 px-2 py-1.5 rounded-lg transition-colors ${hoverable ? "hover:bg-primary-50/60" : ""}`}
      onMouseEnter={() => hoverable && onHoverZone(zone)}
      onMouseLeave={() => hoverable && onHoverZone(null)}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-foreground-800 flex items-center gap-1.5">
          {label}
          {hoverable && (
            <i className="ri-eye-line text-foreground-300 text-xs" title="Hover to see this zone on the model" />
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCustom((c) => !c)}
            title={custom ? "Use preset colors" : "Pick any color"}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
              custom
                ? "bg-primary-500 text-background-50"
                : "bg-background-100 text-foreground-600 hover:bg-background-200"
            }`}
          >
            {custom ? "Preset" : "Custom"}
          </button>
          <span
            className="w-6 h-6 rounded-full ring-1 ring-background-300 shadow-sm"
            style={{ backgroundColor: value }}
          />
        </div>
      </div>

      {!custom ? (
        <div className="flex flex-wrap gap-2">
          {zoneColorPalette.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Set ${label} to ${c}`}
              aria-pressed={value.toLowerCase() === c.toLowerCase()}
              onClick={() => {
                setBase(c);
                setShade(0);
                onChange(c);
              }}
              className="relative h-8 w-8 rounded-lg cursor-pointer ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500"
              style={{ backgroundColor: c }}
            >
              {value.toLowerCase() === c.toLowerCase() && (
                <span className="absolute inset-0 rounded-lg ring-2 ring-offset-2 ring-primary-500" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              type="color"
              aria-label={`${label} color`}
              value={isHex(base) ? base : "#000000"}
              onChange={(e) => applyBase(e.target.value)}
              className="h-9 w-12 rounded-lg border border-background-300 bg-background-50 cursor-pointer p-0.5"
            />
            <input
              type="text"
              aria-label={`${label} hex value`}
              value={base}
              maxLength={7}
              onChange={(e) => {
                const v = e.target.value;
                setBase(v);
                if (isHex(v)) onChange(shadeColor(v, shade));
              }}
              placeholder="#0c8a57"
              className="flex-1 min-w-0 px-2.5 py-2 text-xs font-mono rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-foreground-600">Shade</span>
              <span className="text-[10px] font-label text-foreground-400">
                {shade === 0 ? "As picked" : shade > 0 ? `+${shade} lighter` : `${-shade} darker`}
              </span>
            </div>
            <input
              type="range"
              aria-label={`${label} shade`}
              min="-80"
              max="80"
              step="5"
              value={shade}
              onChange={(e) => applyShade(Number(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary-500"
              style={{
                background: `linear-gradient(to right, ${shadeColor(
                  isHex(base) ? base : "#000000",
                  -80
                )}, ${isHex(base) ? base : "#000000"}, ${shadeColor(
                  isHex(base) ? base : "#000000",
                  80
                )})`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function DesignPanel({ sport, collar, setCollar, sleeve, setSleeve, colors, setColors, onHoverZone, twoTone, setTwoTone }) {
  useEffect(() => () => onHoverZone?.(null), [onHoverZone]);
  const setZone = (zone) => (color) => {
    setColors((current) => ({
      ...current,
      [zone]: color,
      ...(zone === "body" && twoTone && !twoTone.enabled ? { shorts: color } : {}),
    }));
    if (zone === "shorts" && twoTone) {
      setTwoTone((current) => ({
        ...current,
        enabled: color.toLowerCase() !== colors.body.toLowerCase(),
        colorB: color,
        splitAt: 0.5,
        softness: 0.005,
      }));
    }
  };
  const toggleTwoTone = (enabled) => {
    setTwoTone((current) => ({ ...current, enabled, splitAt: 0.5, softness: 0.005 }));
    setColors((current) => ({
      ...current,
      shorts: enabled ? twoTone.colorB : current.body,
    }));
  };
  const config = sportConfigFor(sport);
  const colorZones = [
    { key: "body", label: "Shirt body" },
    { key: "collar", label: "Collar" },
    ...(config.sleeveOptions ? [{ key: "sleeve", label: "Sleeve" }] : []),
    { key: "shorts", label: config.bottomLabel },
    ...(config.hasSocks ? [{ key: "socks", label: "Socks" }] : []),
    { key: "shirtStrip", label: "Shirt ends" },
    ...(config.sleeveOptions ? [{ key: "sleeveStrip", label: "Sleeve ends" }] : []),
    { key: "shortsStrip", label: `${config.bottomLabel} ends` },
  ];

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-2">
        Collar &amp; sleeves
      </h3>
      <div className="mb-2">
        {config.collarOptions.includes("Polo") && <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground-800">
          <input type="checkbox" checked={collar === "Polo"} onChange={(event) => setCollar(event.target.checked ? "Polo" : "Crew")} className="accent-primary-600" />
          Polo collar (+${ADD_ON_PRICES.collarPolo.toFixed(2)}/kit)
        </label>}
        <p className="mt-1 text-xs leading-snug text-foreground-500">Standard crew or V-Neck collar included in the base price.</p>
      </div>
      {config.sleeveOptions && (
        <div className="mb-2">
          <p className="mb-1 text-xs text-foreground-500">Short sleeves included in the base price.</p>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-2" role="group" aria-label="Sleeve options">
            <label className="flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-semibold leading-snug text-foreground-800">
              <input type="checkbox" checked={sleeve === "Long"} onChange={(event) => setSleeve(event.target.checked ? "Long" : "Short")} className="accent-primary-600" />
              <span>Long sleeves <span className="font-normal">(+${ADD_ON_PRICES.sleeveLong.toFixed(2)}/kit)</span></span>
            </label>
            <label className="flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-semibold leading-snug text-foreground-800">
              <input type="checkbox" checked={sleeve === "Mixed"} onChange={(event) => setSleeve(event.target.checked ? "Mixed" : "Short")} className="accent-primary-600" />
              Mixed sleeves
            </label>
          </div>
          {sleeve === "Mixed" && <p className="mt-1 text-xs leading-snug text-foreground-500">Choose sleeves per player in Team roster. Only long-sleeve kits add $2.00 each.</p>}
        </div>
      )}

      {twoTone && (
        <>
          <label className="flex items-center gap-2 border-t border-background-200/70 pt-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-background-300 cursor-pointer"
              checked={twoTone.enabled}
              onChange={(e) => toggleTwoTone(e.target.checked)}
            />
            <span className="text-xs text-foreground-700 font-label">
              Different shirt and {config.bottomLabel.toLowerCase()} colors
            </span>
          </label>

        </>
      )}

      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-2 pt-2 border-t border-background-200/70">
        Garment colors
      </h3>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Garment part colors" onMouseLeave={() => onHoverZone?.(null)}>
        {colorZones.map((zone) => <label key={zone.key}
          onMouseEnter={() => onHoverZone?.(zone.key)} onMouseLeave={() => onHoverZone?.(null)}
          onFocus={() => onHoverZone?.(null)} onBlur={() => onHoverZone?.(null)}
          onPointerCancel={() => onHoverZone?.(null)}
          className="relative flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-left transition hover:border-primary-300 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
          <span className="h-6 w-6 shrink-0 rounded-md border border-black/10" style={{ backgroundColor: colors[zone.key] }} aria-hidden="true" />
          <span className="min-w-0 text-[11px] font-semibold leading-tight text-foreground-800">{zone.label}</span>
          <input type="color" aria-label={`${zone.label} color`} value={colors[zone.key]} onClick={() => onHoverZone?.(null)} onChange={(event) => { setZone(zone.key)(event.target.value); onHoverZone?.(null); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>)}
      </div>
    </div>
  );
}

export function ZoneEditorPanel({
  view,
  onViewChange,
  zoneModel,
  selectedZoneId,
  onSelectZone,
  zoneStyles,
  onUpdateZoneStyle,
  showOutlines,
  onToggleOutlines,
  correctionMode,
  onToggleCorrection,
  onUndo,
  canUndo,
  onResetZone,
  onResetAll,
  sockColor = "#f6f1e7",
  onSockColorChange,
}) {
  const [selectedParent, setSelectedParent] = useState(null);
  useEffect(() => {
    if (selectedZoneId) setSelectedParent(null);
  }, [selectedZoneId]);
  const zones = zoneModel?.[view] || [];
  const garmentFor = (item) => item.id.includes("sock")
    ? "socks"
    : item.id.includes("shorts") || item.id.includes("waistband")
      ? "shorts"
      : "jersey";
  const parentZones = selectedParent ? zones.filter((item) => garmentFor(item) === selectedParent) : [];
  const selected = selectedParent
    ? { id: `parent-${selectedParent}`, name: `Full ${selectedParent} mask` }
    : zones.find((item) => item.id === selectedZoneId) || zones[0];
  const solidSocks = selectedParent === "socks" || selected?.id?.includes("sock");
  const styleSource = selectedParent ? parentZones[0] : selected;
  const style = styleSource ? (zoneStyles?.[view]?.[styleSource.id] || {}) : {};
  const validation = zoneValidation(zones);
  const overlaps = zoneOverlapWarnings(zones);
  const groups = [...new Set(zones.map((item) => item.group))];
  const update = (patch) => {
    if (solidSocks) {
      if (patch.color) onSockColorChange?.(patch.color);
      const solidPatch = {
        color: patch.color || sockColor,
        opacity: 1,
        gradientEnabled: false,
        pattern: "none",
        borderColor: null,
        texture: "fabric",
        ...patch,
      };
      zones.filter((item) => garmentFor(item) === "socks").forEach((item) => onUpdateZoneStyle?.(view, item.id, solidPatch));
    } else if (selectedParent) parentZones.forEach((item) => onUpdateZoneStyle?.(view, item.id, patch));
    else if (selected) onUpdateZoneStyle?.(view, selected.id, patch);
  };

  return (
    <div>
      <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-3.5 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-700">Zone verification</p>
            <p className="mt-1 text-xs text-foreground-700 font-label">Inspect outlines first, then drag the orange anchors and blue Bézier handles to correct the selected boundary.</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${validation.length ? "bg-amber-100 text-amber-800" : "bg-primary-100 text-primary-800"}`}>
            {validation.length || overlaps.length ? `${validation.length + overlaps.length} issue${validation.length + overlaps.length === 1 ? "" : "s"}` : "Paths valid · no overlaps"}
          </span>
        </div>
      </div>
      {overlaps.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          <strong>Review overlap:</strong> {overlaps.map((item) => item.ids.join(" / ")).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        {["front", "back"].map((side) => (
          <button key={side} type="button" onClick={() => onViewChange?.(side)} className={`rounded-lg border px-3 py-2 text-xs font-bold capitalize cursor-pointer ${view === side ? "border-primary-600 bg-primary-600 text-white" : "border-background-300 bg-white text-foreground-700"}`}>
            {side} zones
          </button>
        ))}
      </div>

      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground-400">Level 1 · Full garment masks</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {["jersey", "shorts", "socks"].map((parent) => (
          <button
            key={parent}
            type="button"
            onClick={() => { setSelectedParent(parent); onSelectZone?.(null, view); }}
            className={`rounded-lg border px-2 py-2 text-[10px] font-bold capitalize cursor-pointer ${selectedParent === parent ? "border-primary-600 bg-primary-600 text-white" : "border-background-300 bg-white text-foreground-700"}`}
          >
            Full {parent}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={onToggleOutlines} className={`flex-1 rounded-lg border px-2.5 py-2 text-[11px] font-bold cursor-pointer ${showOutlines ? "border-primary-500 bg-primary-50 text-primary-800" : "border-background-300 bg-white text-foreground-700"}`}>
          <i className="ri-focus-3-line mr-1" /> {showOutlines ? "Hide outlines" : "Show all outlines"}
        </button>
        <button type="button" onClick={onToggleCorrection} className={`flex-1 rounded-lg border px-2.5 py-2 text-[11px] font-bold cursor-pointer ${correctionMode ? "border-accent-500 bg-accent-50 text-accent-800" : "border-background-300 bg-white text-foreground-700"}`}>
          <i className="ri-node-tree mr-1" /> {correctionMode ? "Finish correction" : "Correct boundary"}
        </button>
      </div>

      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground-400">Level 2 · Individual zone masks</p>
      <div className="max-h-60 overflow-y-auto rounded-xl border border-background-200 bg-white p-2 mb-5">
        {groups.map((group) => (
          <div key={group} className="mb-2 last:mb-0">
            <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground-400">{group}</p>
            {zones.filter((item) => item.group === group).map((item) => (
              <button key={item.id} type="button" onClick={() => { setSelectedParent(null); onSelectZone?.(item.id, view); }} className={`w-full rounded-lg px-2 py-2 text-left transition cursor-pointer ${selected?.id === item.id ? "bg-primary-600 text-white" : "hover:bg-background-100 text-foreground-700"}`}>
                <span className="block text-[11px] font-bold">{item.name}</span>
                <span className={`block font-mono text-[9px] ${selected?.id === item.id ? "text-white/70" : "text-foreground-400"}`}>{item.id}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {selected && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground-800">Solid color</label>
            <div className="flex gap-2">
              <input type="color" value={solidSocks ? sockColor : (style.color || "#f6f1e7")} onChange={(event) => update({ color: event.target.value })} className="h-10 w-12 rounded-lg border border-background-300 p-1 cursor-pointer" />
              <input type="text" value={solidSocks ? sockColor : (style.color || "#f6f1e7")} onChange={(event) => isHex(event.target.value) && update({ color: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-background-300 px-3 py-2 text-xs font-mono uppercase" aria-label="Selected zone HEX color" />
            </div>
          </div>

          {!solidSocks && <div>
            <div className="mb-1 flex justify-between text-[11px] font-bold"><span>Opacity</span><span>{Math.round((style.opacity ?? 1) * 100)}%</span></div>
            <input type="range" min="0" max="1" step="0.01" value={style.opacity ?? 1} onChange={(event) => update({ opacity: Number(event.target.value) })} className="w-full accent-primary-600" />
          </div>}

          {solidSocks && (
            <p className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[11px] font-semibold text-primary-800">
              Socks use one solid color at full opacity. This selection updates the front, back and cuffs together.
            </p>
          )}

          {!solidSocks && <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={Boolean(style.gradientEnabled)} onChange={(event) => update({ gradientEnabled: event.target.checked })} /> Gradient color
          </label>}
          {!solidSocks && style.gradientEnabled && (
            <div className="flex gap-2">
              <input type="color" value={style.gradientColor || "#ffffff"} onChange={(event) => update({ gradientColor: event.target.value })} className="h-9 w-12 rounded-lg border border-background-300 p-1" />
              <select value={style.gradientDirection || "diagonal"} onChange={(event) => update({ gradientDirection: event.target.value })} className="flex-1 rounded-lg border border-background-300 px-2 text-xs">
                <option value="diagonal">Diagonal</option><option value="vertical">Vertical</option>
              </select>
            </div>
          )}

          {!solidSocks && <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold">Pattern
              <select value={style.pattern || "none"} onChange={(event) => update({ pattern: event.target.value })} className="mt-1 w-full rounded-lg border border-background-300 px-2 py-2 text-xs font-normal">
                <option value="none">None</option><option value="diagonal">Diagonal stripe</option><option value="checks">Checks</option><option value="dots">Dots</option>
              </select>
            </label>
            <label className="text-[11px] font-bold">Pattern color
              <input type="color" value={style.patternColor || "#ffffff"} onChange={(event) => update({ patternColor: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-background-300 p-1" />
            </label>
            <label className="text-[11px] font-bold">Border / trim
              <input type="color" value={style.borderColor || "#008c59"} onChange={(event) => update({ borderColor: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-background-300 p-1" />
            </label>
            <label className="text-[11px] font-bold">Texture
              <select value={style.texture || "fabric"} onChange={(event) => update({ texture: event.target.value })} className="mt-1 w-full rounded-lg border border-background-300 px-2 py-2 text-xs font-normal">
                <option value="fabric">Original fabric</option><option value="mesh">Mesh overlay</option><option value="none">None</option>
              </select>
            </label>
          </div>}

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-background-200">
            <button type="button" disabled={!canUndo} onClick={onUndo} className="rounded-lg border border-background-300 px-2 py-2 text-[10px] font-bold disabled:opacity-40 cursor-pointer"><i className="ri-arrow-go-back-line" /> Undo</button>
            <button type="button" onClick={() => selectedParent ? parentZones.forEach((item) => onResetZone?.(view, item.id)) : onResetZone?.(view, selected.id)} className="rounded-lg border border-background-300 px-2 py-2 text-[10px] font-bold cursor-pointer">Reset {selectedParent ? "garment" : "zone"}</button>
            <button type="button" onClick={onResetAll} className="rounded-lg border border-accent-300 px-2 py-2 text-[10px] font-bold text-accent-700 cursor-pointer">Reset all</button>
          </div>
        </div>
      )}

      <details className="mt-5 rounded-xl bg-background-100 p-3 text-[11px] text-foreground-600">
        <summary className="font-bold cursor-pointer">Source elements not present</summary>
        <ul className="mt-2 list-disc pl-4 space-y-1">{NO_DETECTED_SOURCE_ELEMENTS.map((label) => <li key={label}>{label}</li>)}</ul>
      </details>
    </div>
  );
}

/**
 * Fit/Kit type + the priced add-on options from spec §4.4/§4.5 — separate
 * from DesignPanel (which stays "what does it look like") so pricing-
 * affecting choices live in one obvious place with their cost shown right
 * next to each option, same as the legacy prototype surfaced "(+$2.00/pr
 * kit)" directly in each dropdown.
 */
export function StudioBackgroundPanel({
  studioBackground = DEFAULT_STUDIO_BACKGROUND,
  setStudioBackground,
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-3">
        Studio background
      </h3>
      <p className="text-xs text-foreground-500 font-label mb-3">
        Change the workspace behind the uniform for clearer editing or presentation. This never
        recolors the garment or production artwork.
      </p>
      <div className="grid grid-cols-1 gap-2 mb-3">
        {STUDIO_BACKGROUND_PRESETS.map((preset) => {
          const selected = studioBackground.toUpperCase() === preset.color.toUpperCase();
          return (
            <button
              key={preset.color}
              type="button"
              onClick={() => setStudioBackground?.(preset.color)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition cursor-pointer ${
                selected
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-400"
                  : "border-background-300 bg-background-50 hover:border-primary-300"
              }`}
            >
              <span
                className="h-8 w-8 flex-none rounded-lg border border-black/10 shadow-inner"
                style={{ backgroundColor: preset.color }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground-900">{preset.name}</span>
                <span className="block text-[10px] text-foreground-500 font-label">{preset.use}</span>
              </span>
              {selected && <i className="ri-check-line ml-auto text-primary-600" aria-label="Selected" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="relative h-10 w-12 flex-none overflow-hidden rounded-lg border border-background-300 cursor-pointer">
          <input
            type="color"
            value={studioBackground}
            onChange={(event) => setStudioBackground?.(event.target.value.toUpperCase())}
            className="absolute -inset-2 h-14 w-16 cursor-pointer"
            aria-label="Custom studio background color"
          />
        </label>
        <input
          key={studioBackground}
          type="text"
          defaultValue={studioBackground}
          onBlur={(event) => {
            const value = event.target.value.toUpperCase();
            if (isStudioHex(value)) setStudioBackground?.(value);
            else event.target.value = studioBackground;
          }}
          aria-label="Studio background HEX color"
          className="min-w-0 flex-1 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold uppercase text-foreground-900 focus:border-primary-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setStudioBackground?.(DEFAULT_STUDIO_BACKGROUND)}
          className="rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer"
        >
          Reset
        </button>
      </div>
      <p className="mb-6 text-[10px] text-foreground-500 font-label">
        Saved with this design and used throughout the studio preview.
      </p>
    </div>
  );
}

export function OptionsPanel({
  sport,
  fitType, setFitType, kitType, setKitType, logoApplication, setLogoApplication,
  insideCollarMessage, setInsideCollarMessage, insideCollarText, setInsideCollarText,
  insideCollarAttachment, setInsideCollarAttachment,
  extraTeamShirts = [{ size: "AM", quantity: 1 }], setExtraTeamShirts,
  section = "all",
}) {
  return (
    <div>
      {section !== "production" && <>
      {!fitTypeOptions.includes(fitType) && <div role="alert" className="mb-2 flex items-start gap-2 rounded-lg border-2 border-accent-400 bg-accent-50 px-3 py-2 text-accent-950">
        <i className="ri-error-warning-fill mt-0.5 text-lg text-accent-600" aria-hidden="true" />
        <div><p className="text-xs font-bold">Fit selection required</p><p className="mt-0.5 text-xs leading-snug">Choose Men, Women or Youth to unlock Step 2.</p></div>
      </div>}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground-800">Fit type <span className="ml-1 text-[10px] font-normal text-accent-700">Required</span></span>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Fit type (required)">
          {fitTypeOptions.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={fitType === f}
              onClick={() => setFitType(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                fitType === f
                  ? "bg-primary-500 text-background-50 border-primary-500 shadow-sm shadow-primary-500/20"
                  : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-xs font-semibold text-foreground-800 block mb-1.5">Kit type</span>
        <div className="grid grid-cols-2 gap-2">
          {kitTypeOptions.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === "Full" || kitType === "Shirt"}
              onClick={() => setKitType(k === "Shirt" && kitType !== "Shirt" ? "Shirt" : "Full")}
              className={`min-w-0 px-2.5 py-2 text-left text-xs rounded-xl border cursor-pointer transition-all ${
                (k === "Full" || kitType === "Shirt")
                  ? "bg-primary-50 text-primary-900 border-primary-500"
                  : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
              }`}
            >
              <span className="flex items-center justify-between gap-1 font-semibold">{k === "Full" ? "Full Kit" : "Shirt Only"}{(k === "Full" || kitType === "Shirt") && <i className="ri-check-line" aria-hidden="true" />}</span>
              <span className="mt-1 block"><strong className="text-base font-semibold">${(k === "Full" ? BASE_KIT_PRICE : SHIRT_ONLY_PRICE).toFixed(2)}</strong><span className="ml-1 text-[11px] font-normal opacity-80">{k === "Full" ? "per kit" : "per shirt"}</span></span>
              <span className="mt-1 block text-[10px] font-normal leading-snug opacity-80">{k === "Full" ? `Team order · Min Qnty ${minimumFullKitsFor(sport)}` : "Extra shirts with a Full Kit order"}</span>
            </button>
          ))}
        </div>
        {kitType === "Shirt" && <div className="mt-3 space-y-2">
          <p className="text-xs text-foreground-600">Add extra shirts to your full-kit team order.</p>
          {extraTeamShirts.map((row, index) => <div key={index} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-[11px] text-foreground-600">Size<select aria-label={`Extra shirt size ${index + 1}`} value={row.size} onChange={(event) => { const size = event.target.value; setExtraTeamShirts?.((rows) => rows.map((item, i) => i === index ? { ...item, size } : item)); }} className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2 text-xs text-foreground-900">{shirtSizeOptions.map((size) => <option key={size} value={size} disabled={extraTeamShirts.some((item, i) => i !== index && item.size === size)}>{size}</option>)}</select></label>
            <label className="w-20 text-[11px] text-foreground-600">Quantity<input type="number" min="1" max="99" aria-label={`Extra shirt quantity ${index + 1}`} value={row.quantity} onChange={(event) => { const quantity = Math.max(1, Math.min(99, parseInt(event.target.value, 10) || 1)); setExtraTeamShirts?.((rows) => rows.map((item, i) => i === index ? { ...item, quantity } : item)); }} className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2 text-xs text-foreground-900" /></label>
            <button type="button" aria-label={`Remove extra shirt size ${index + 1}`} onClick={() => { if (extraTeamShirts.length === 1) setKitType("Full"); else setExtraTeamShirts?.((rows) => rows.filter((_, i) => i !== index)); }} className="cursor-pointer p-2 text-foreground-500"><i className="ri-close-line" aria-hidden="true" /></button>
          </div>)}
          {extraTeamShirts.length < shirtSizeOptions.length && <button type="button" onClick={() => setExtraTeamShirts?.((rows) => [...rows, { size: shirtSizeOptions.find((size) => !rows.some((row) => row.size === size)), quantity: 1 }])} className="cursor-pointer text-xs font-semibold text-primary-700">+ Add another size</button>}
        </div>}
      </div>

      </>}
      {section !== "fit" && <>
      {section === "all" && <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-3 pt-2 border-t border-background-200/70">Production extras</h3>}
      <div className="mb-3">
        <p className="mb-3 text-xs leading-relaxed text-foreground-600">
          All uniform prints, including logos, are sublimated and included in the base price.
        </p>
        <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-foreground-800">
          <input type="checkbox" checked={logoApplication === "Embroidery"} onChange={(event) => setLogoApplication(event.target.checked ? "Embroidery" : "Sublimated")} className="mt-0.5 accent-primary-600" />
          <span>Embroidered team logo <span className="font-normal text-foreground-500">(+${ADD_ON_PRICES.logoEmbroidery.toFixed(2)}/kit)</span></span>
        </label>
      </div>

      <div className="mb-2">
        <span className="text-xs font-semibold text-foreground-800 block mb-2">
          Inside-collar logo or message
          <span className="ml-1 font-normal text-foreground-500">
            (+${ADD_ON_PRICES.insideCollarMessage.toFixed(2)}/kit)
          </span>
        </span>
        <div className="flex gap-2 flex-wrap mb-3">
          {["No", "Yes"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setInsideCollarMessage(opt === "Yes")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                (opt === "Yes") === insideCollarMessage
                  ? "bg-primary-500 text-background-50 border-primary-500 shadow-sm shadow-primary-500/20"
                  : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {insideCollarMessage && (
          <>
          <input
            type="text"
            placeholder="Message for the inside collar"
            value={insideCollarText}
            onChange={(e) => setInsideCollarText(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label"
          />
          <CollarAttachment attachment={insideCollarAttachment} onChange={setInsideCollarAttachment} />
          </>
        )}
      </div>
      </>}
    </div>
  );
}

export function UniformSetupPanel({ designProps, optionsProps }) {
  return <div className="space-y-2.5">
    <OptionsPanel {...optionsProps} section="fit" />
    <DesignPanel {...designProps} />
    <details className="group rounded-xl border border-primary-300 bg-primary-50 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold text-primary-900 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2.5"><i className="ri-settings-4-line text-lg text-primary-700" aria-hidden="true" /><span>Production extras<span className="mt-0.5 block text-[11px] font-normal text-primary-800">{optionsProps.logoApplication === "Embroidery" ? "Embroidery" : "Sublimated logo included"}{optionsProps.insideCollarMessage ? " · Collar customization" : ""}</span></span></span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800"><i className="ri-arrow-down-s-line transition-transform group-open:rotate-180" aria-hidden="true" /></span>
      </summary>
      <div className="rounded-b-xl border-t border-primary-200 bg-background-50 p-3"><OptionsPanel {...optionsProps} section="production" /></div>
    </details>
  </div>;
}

/**
 * Armed-state banner shared by the Text/Logo/Skins panels.
 *
 * Click-to-place is modal — between arming and clicking, the app is waiting
 * on the customer and nothing else will respond normally. Modes that don't
 * announce themselves feel broken, so this says plainly what the studio is
 * waiting for and how to back out.
 */
function ArmedNotice({ label }) {
  return (
    <div className="mb-4 rounded-lg border border-primary-300 bg-primary-50 px-3 py-2.5 flex items-start gap-2">
      <i className="ri-cursor-line text-primary-600 mt-0.5" />
      <span className="text-xs text-primary-800 font-label leading-snug">
        Now click the garment where you want {label}. Press{" "}
        <kbd className="font-semibold">Esc</kbd> to cancel.
      </span>
    </div>
  );
}

export function TextPanel({ onAdd, armed }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Text
      </h3>
      {armed && <ArmedNotice label="the text" />}
      <button
        type="button"
        onClick={onAdd}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer mb-4 transition-colors ${
          armed
            ? "bg-primary-100 text-primary-700 ring-2 ring-primary-400"
            : "bg-primary-500 text-background-50 hover:bg-primary-600"
        }`}
      >
        <i className={armed ? "ri-cursor-line" : "ri-add-line"} />
        {armed ? "Click the garment…" : "Add text"}
      </button>
      <ol className="text-xs text-foreground-600 font-label space-y-1.5 list-decimal list-inside">
        <li>Click <span className="font-semibold">Add text</span>.</li>
        <li>Click the garment — the text appears right there, ready to type.</li>
        <li>Drag it to move · scroll or pull a corner to resize.</li>
      </ol>
    </div>
  );
}

export function LogoPanel({ onUpload, armed }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Logo
      </h3>
      {armed && <ArmedNotice label="the logo" />}
      <label
        className={`flex flex-col items-center justify-center gap-2 w-full py-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-center mb-4 ${
          armed
            ? "border-primary-400 bg-primary-50/40"
            : "border-background-300 hover:border-primary-400"
        }`}
      >
        <i className="ri-image-add-line text-2xl text-foreground-400" />
        <span className="text-xs text-foreground-600 font-label px-4">
          Click to upload a transparent PNG or SVG
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </label>
      <ol className="text-xs text-foreground-600 font-label space-y-1.5 list-decimal list-inside mb-3">
        <li>Upload your file.</li>
        <li>Click the garment — the logo lands exactly there.</li>
        <li>Drag it to move · scroll or pull a corner to resize.</li>
      </ol>
      <p className="text-[11px] text-foreground-500 font-label">
        Transparent PNG or SVG prints cleanest — a white box behind the artwork will be printed
        too. Around 1000&nbsp;&times;&nbsp;1000px or larger keeps it sharp. Upload again or duplicate
        a selected layer to add as many logos and artwork elements as needed.
      </p>
    </div>
  );
}

const AI_STYLES = [
  "Modern & Bold",
  "Classic & Clean",
  "Minimal & Elegant",
  "Retro & Vintage",
  "Street & Edgy",
];

const AI_COLOR_LABELS = {
  body: "Shirt body",
  sleeve: "Sleeves",
  collar: "Collar",
  shorts: "Shorts",
  socks: "Socks",
  shirtStrip: "Shirt ends",
  sleeveStrip: "Sleeve ends",
  shortsStrip: "Shorts ends",
};

function prepareAIReferenceImage(file) {
  return new Promise((resolve, reject) => {
    if (file?.size > 10 * 1024 * 1024) {
      reject(new Error("Reference images must be 10 MB or smaller."));
      return;
    }
    if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("Choose a PNG, JPEG or WebP reference image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The reference image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The reference image could not be opened."));
      image.onload = () => {
        const maxDimension = 1536;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("The reference image could not be prepared."));
          return;
        }
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          src: canvas.toDataURL("image/jpeg", 0.86),
          name: file.name || "Uniform inspiration",
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function AIArtworkPanel({
  sport,
  colors,
  collar,
  sleeve,
  collarOptions = [],
  sleeveOptions = [],
  currentPatternKey = "none",
  uniformPlan,
  onUniformPlanChange,
  onReferenceChange,
  onModeChange,
  onPlace,
  onApplyUniform,
  onUndoUniform,
  canUndoUniform = false,
  hasExistingArtwork = false,
  composerVariant = "unified",
}) {
  const [mode, setMode] = useState("uniform");
  const [brandName, setBrandName] = useState("");
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState(AI_STYLES[0]);
  const [connection, setConnection] = useState("checking");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [reference, setReference] = useState(null);
  const [applied, setApplied] = useState(false);
  const [refinementBrief, setRefinementBrief] = useState("");
  const [locks, setLocks] = useState({ collar: false, sleeve: false, colors: false, pattern: false, artwork: hasExistingArtwork });
  const [promptHistory, setPromptHistory] = useState([]);
  const [archivedPrompts, setArchivedPrompts] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");
  const generationControllerRef = useRef(null);
  const allDesignControlsLocked = locks.collar && locks.sleeve && locks.colors && locks.pattern;
  const lockedControlCount = Object.values(locks).filter(Boolean).length;
  const activePrompt = mode === "uniform" && uniformPlan ? refinementBrief : brief;
  const promptHistoryKey = `connect767-ai-prompt-history:${sport || "uniform"}`;
  const promptArchiveKey = `connect767-ai-prompt-archive:${sport || "uniform"}`;

  useEffect(() => {
    if (hasExistingArtwork) {
      setLocks((current) => current.artwork ? current : { ...current, artwork: true });
    }
  }, [hasExistingArtwork]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(promptHistoryKey) || "[]");
      setPromptHistory(Array.isArray(saved) ? saved.slice(0, 30) : []);
    } catch {
      setPromptHistory([]);
    }
  }, [promptHistoryKey]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(promptArchiveKey) || "[]");
      setArchivedPrompts(Array.isArray(saved) ? saved.slice(0, 70) : []);
    } catch {
      setArchivedPrompts([]);
    }
  }, [promptArchiveKey]);

  const savePrompt = ({ prompt, promptMode, kind, name, promptStyle, response }) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt,
      mode: promptMode,
      kind,
      brandName: name,
      style: promptStyle,
      response,
      createdAt: new Date().toISOString(),
    };
    setPromptHistory((current) => {
      const next = [entry, ...current].slice(0, 30);
      try { window.sessionStorage.setItem(promptHistoryKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
    setHistoryOpen(true);
  };

  const clearPromptHistory = () => {
    setPromptHistory([]);
    setArchivedPrompts([]);
    try { window.sessionStorage.removeItem(promptHistoryKey); } catch { /* storage unavailable */ }
    try { window.localStorage.removeItem(promptArchiveKey); } catch { /* storage unavailable */ }
  };

  const reusePrompt = (entry) => {
    setMode(entry.mode);
    onModeChange?.(entry.mode);
    setBrandName(entry.brandName || "");
    setStyle(entry.style || AI_STYLES[0]);
    if (entry.mode === "uniform" && uniformPlan) setRefinementBrief(entry.prompt);
    else setBrief(entry.prompt);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/generate-design").then((response) => response.json()),
      fetch("/api/generate-uniform-design").then((response) => response.json()),
    ])
      .then(([artwork, uniform]) => active && setConnection(artwork.configured && uniform.configured ? "connected" : "setup"))
      .catch(() => active && setConnection("offline"));
    return () => { active = false; };
  }, []);

  const generateArtwork = async () => {
    if (!brief.trim()) return;
    const effectiveBrandName = brandName.trim() || "Team artwork";
    setGenerating(true);
    setError("");
    setPreview(null);
    generationControllerRef.current?.abort();
    generationControllerRef.current = new AbortController();
    try {
      const response = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: generationControllerRef.current.signal,
        body: JSON.stringify({
          productType: "Jersey",
          style,
          brandName: effectiveBrandName,
          primaryColor: colors.body,
          secondaryColor: colors.shirtStrip,
          notes: brief.trim(),
          generationMode: "artwork",
          sport,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.b64) throw new Error(data.error || "AI generation failed.");
      setPreview({
        src: `data:${data.mimeType || "image/png"};base64,${data.b64}`,
        name: `${effectiveBrandName} AI artwork`,
      });
      savePrompt({
        prompt: brief.trim(),
        promptMode: "artwork",
        kind: "Artwork",
        name: effectiveBrandName,
        promptStyle: style,
        response: "Your transparent artwork is ready to preview and place on the uniform.",
      });
    } catch (generationError) {
      if (generationError.name !== "AbortError") setError(generationError.message || "AI generation failed.");
    } finally {
      setGenerating(false);
      generationControllerRef.current = null;
    }
  };

  const generateUniform = async (revision = "") => {
    const refinement = typeof revision === "string" ? revision.trim() : "";
    const promptKind = refinement ? "Refinement" : uniformPlan ? "Variation" : "Initial";
    const effectiveBrandName = brandName.trim() || uniformPlan?.name || "Team uniform";
    const effectiveBrief = brief.trim() || uniformPlan?.summary || "Preserve the current uniform direction.";
    if (!effectiveBrandName || (!effectiveBrief && !refinement)) return;
    const existingConcept = refinement ? uniformPlan?.conceptImage?.src || "" : "";
    const currentDesign = uniformPlan || { collar, sleeve, colors, pattern: { key: currentPatternKey } };
    setGenerating(true);
    setError("");
    generationControllerRef.current?.abort();
    generationControllerRef.current = new AbortController();
    if (!refinement) onUniformPlanChange?.(null);
    setApplied(false);
    try {
      const response = await fetch("/api/generate-uniform-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: generationControllerRef.current.signal,
        body: JSON.stringify({
          sport,
          style,
          brandName: effectiveBrandName,
          brief: refinement
            ? `Revision request: ${refinement}\nPreserve every part of the current concept that is not explicitly changed. Original direction: ${effectiveBrief}`
            : effectiveBrief,
          collarOptions,
          sleeveOptions: sleeveOptions?.length ? sleeveOptions : ["Sleeveless"],
          current: {
            collar: currentDesign.collar || collar,
            sleeve: currentDesign.sleeve || sleeve,
            colors: currentDesign.colors || colors,
            patternKey: currentDesign.pattern?.key || currentPatternKey,
          },
          locks,
          referenceImage: existingConcept || reference?.src || "",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.plan) throw new Error(data.error || "AI uniform design failed.");
      const plan = data.plan;
      const artworkElement = plan.productionElements?.find((element) => element.kind === "artwork");
      const productionPlacementSummary = (plan.productionElements || []).length
        ? plan.productionElements.map((element) => (
            `${element.kind} ${JSON.stringify(element.content)} in ${element.layout || "single-line"} layout on ${element.view} at ${element.x}% x ${element.y}%`
          )).join("; ")
        : "No text, number, crest, logo or sponsor placements.";
      const conceptRequest = fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: generationControllerRef.current.signal,
        body: JSON.stringify({
          productType: "Jersey",
          style,
          brandName: effectiveBrandName,
          primaryColor: plan.colors.body,
          secondaryColor: plan.colors.shirtStrip,
          generationMode: "uniform",
          sport,
          notes: [
            refinement ? `Revise the supplied existing uniform image: ${refinement}` : brief.trim(),
            `Design plan: ${plan.summary}`,
            `Collar: ${plan.collar}. Sleeves: ${plan.sleeve}.`,
            `Exact zone colors: body ${plan.colors.body}, sleeves ${plan.colors.sleeve}, collar ${plan.colors.collar}, shorts ${plan.colors.shorts}, socks ${plan.colors.socks}, shirt trim ${plan.colors.shirtStrip}, sleeve trim ${plan.colors.sleeveStrip}, shorts trim ${plan.colors.shortsStrip}.`,
            plan.pattern?.enabled
              ? `Pattern: ${plan.pattern.key}, applied to ${plan.pattern.view}.`
              : "Pattern: clean solid-color design with no decorative pattern.",
            `Editable Front / Side / Back placement map: ${productionPlacementSummary}`,
          ].join(" "),
          referenceImage: existingConcept,
        }),
      });
      const artworkRequest = artworkElement
        ? fetch("/api/generate-design", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: generationControllerRef.current.signal,
            body: JSON.stringify({
              productType: "Jersey",
              style,
              brandName: effectiveBrandName,
              primaryColor: plan.colors.body,
              secondaryColor: plan.colors.shirtStrip,
              generationMode: "artwork",
              sport,
              notes: artworkElement.content,
            }),
          })
        : Promise.resolve(null);
      const [conceptResponse, artworkResponse] = await Promise.all([conceptRequest, artworkRequest]);
      const conceptData = await conceptResponse.json();
      if (!conceptResponse.ok || !conceptData.b64) {
        throw new Error(conceptData.error || "The editable design was created, but its full-uniform preview could not be rendered.");
      }
      let productionElements = plan.productionElements || [];
      if (artworkResponse) {
        const artworkData = await artworkResponse.json();
        if (!artworkResponse.ok || !artworkData.b64) {
          throw new Error(artworkData.error || "The uniform was created, but its editable crest could not be rendered.");
        }
        let artworkAttached = false;
        productionElements = productionElements.map((element) => {
          if (element.kind !== "artwork" || artworkAttached) return element;
          artworkAttached = true;
          return {
            ...element,
            src: `data:${artworkData.mimeType || "image/png"};base64,${artworkData.b64}`,
            name: `${effectiveBrandName} production artwork`,
          };
        });
      }
      onUniformPlanChange?.({
        ...plan,
        productionElements,
        conceptImage: {
          src: `data:${conceptData.mimeType || "image/png"};base64,${conceptData.b64}`,
          name: `${plan.name} full uniform concept`,
        },
      });
      savePrompt({
        prompt: refinement || effectiveBrief,
        promptMode: "uniform",
        kind: promptKind,
        name: effectiveBrandName,
        promptStyle: style,
        response: plan.summary || `${plan.name} is ready to review in the 2D view.`,
      });
      if (refinement) setRefinementBrief("");
    } catch (generationError) {
      if (generationError.name !== "AbortError") setError(generationError.message || "AI uniform design failed.");
    } finally {
      setGenerating(false);
      generationControllerRef.current = null;
    }
  };

  const generate = mode === "uniform" ? generateUniform : generateArtwork;
  const toggleLock = (key) => setLocks((current) => ({ ...current, [key]: !current[key] }));

  const applyUniform = () => {
    if (!uniformPlan) return;
    onApplyUniform?.(uniformPlan);
    setApplied(true);
  };

  const acceptReferenceFile = async (file) => {
    if (!file) return;
    setError("");
    try {
      const preparedReference = await prepareAIReferenceImage(file);
      setReference(preparedReference);
      onReferenceChange?.(preparedReference);
      onUniformPlanChange?.(null);
      setApplied(false);
    } catch (referenceError) {
      setError(referenceError.message || "The reference image could not be prepared.");
    }
  };

  const chooseReference = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await acceptReferenceFile(file);
  };

  const stopGenerating = () => {
    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    setGenerating(false);
  };

  const startNewChat = () => {
    stopGenerating();
    if (promptHistory.length) {
      setArchivedPrompts((current) => {
        const next = [...promptHistory, ...current].slice(0, 70);
        try { window.localStorage.setItem(promptArchiveKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
        return next;
      });
      setPromptHistory([]);
      try { window.sessionStorage.removeItem(promptHistoryKey); } catch { /* storage unavailable */ }
    }
    setBrandName("");
    setBrief("");
    setRefinementBrief("");
    setReference(null);
    setPreview(null);
    setApplied(false);
    setError("");
    onUniformPlanChange?.(null);
  };

  const clearCurrentDesign = () => {
    stopGenerating();
    setRefinementBrief("");
    setReference(null);
    setPreview(null);
    setApplied(false);
    setError("");
    onUniformPlanChange?.(null);
  };

  const preservationControls = mode === "uniform" ? (
    <details className="group overflow-hidden rounded-xl border border-background-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-100 text-foreground-600"><i className="ri-lock-line" /></span>
          <span className="min-w-0">
            <strong className="block text-[11px] text-foreground-800">Control what AI can change</strong>
            <span className="block text-[9px] text-foreground-400">{lockedControlCount} of 5 details preserved</span>
          </span>
        </span>
        <i className="ri-arrow-down-s-line text-foreground-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-background-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] leading-relaxed text-foreground-400">Check only what AI must preserve in the next result.</p>
          <button
            type="button"
            onClick={() => setLocks((current) => ({ ...current, collar: false, sleeve: false, colors: false, pattern: false }))}
            className="shrink-0 cursor-pointer text-[9px] font-bold text-primary-700 hover:text-primary-900"
          >
            Unlock all
          </button>
        </div>
        {allDesignControlsLocked && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
            <strong className="block">The complete design is locked.</strong>
            Unlock at least one visual setting to create a visible change.
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["collar", "Collar"],
            ["sleeve", "Sleeve length"],
            ["colors", "All colors"],
            ["pattern", "Pattern"],
            ["artwork", "Existing artwork"],
          ].map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg bg-background-100 px-2.5 py-2 text-[10px] font-semibold text-foreground-600">
              <input type="checkbox" checked={locks[key]} onChange={() => toggleLock(key)} className="accent-primary-700" />
              {label}
            </label>
          ))}
        </div>
      </div>
    </details>
  ) : null;

  if (composerVariant === "unified") {
    const isRefinement = mode === "uniform" && Boolean(uniformPlan);
    const canSend = connection === "connected"
      && Boolean(activePrompt.trim())
      && !(mode === "uniform" && allDesignControlsLocked);
    const changeMode = (nextMode) => {
      setMode(nextMode);
      onModeChange?.(nextMode);
      setError("");
    };
    const sendPrompt = () => {
      if (isRefinement) generateUniform(refinementBrief);
      else generate();
    };

    return (
      <AIUniformComposer
        sport={sport}
        mode={mode}
        onModeChange={changeMode}
        connection={connection}
        brandName={brandName}
        onBrandNameChange={setBrandName}
        prompt={activePrompt}
        onPromptChange={isRefinement ? setRefinementBrief : setBrief}
        isRefinement={isRefinement}
        generating={generating}
        canSend={canSend}
        onSend={sendPrompt}
        onStop={stopGenerating}
        style={style}
        styles={AI_STYLES}
        onStyleChange={setStyle}
        reference={reference}
        onReferenceFile={acceptReferenceFile}
        onRemoveReference={() => { setReference(null); onReferenceChange?.(null); onUniformPlanChange?.(null); }}
        promptHistory={promptHistory}
        historyEntries={[...promptHistory, ...archivedPrompts]}
        onReusePrompt={reusePrompt}
        onClearHistory={clearPromptHistory}
        error={error}
        onRetry={sendPrompt}
        uniformPlan={uniformPlan}
        applied={applied}
        onApplyUniform={applyUniform}
        artworkPreview={preview}
        onPlaceArtwork={onPlace}
        onClearArtwork={() => setPreview(null)}
        preservationControls={preservationControls}
        canUndo={canUndoUniform}
        onUndo={onUndoUniform}
        onNewChat={startNewChat}
        onClearCurrentDesign={clearCurrentDesign}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground-500">Create with AI</p>
          <p className="mt-0.5 text-[11px] text-foreground-500">Prompt, preview and refine in one workspace.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
          connection === "connected"
            ? "border-primary-200 bg-primary-50 text-primary-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connection === "connected" ? "bg-primary-500" : "bg-amber-500"}`} />
          {connection === "checking" ? "Checking" : connection === "connected" ? "Ready" : "Setup needed"}
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 rounded-xl bg-background-100 p-1">
          <button
            type="button"
            onClick={() => { setMode("uniform"); onModeChange?.("uniform"); setError(""); }}
            className={`cursor-pointer rounded-lg px-3 py-2.5 text-[11px] font-bold transition ${mode === "uniform" ? "bg-white text-foreground-950 shadow-sm ring-1 ring-black/5" : "text-foreground-500 hover:text-foreground-800"}`}
          >
            <i className="ri-shirt-line mr-1.5" /> Full uniform
          </button>
          <button
            type="button"
            onClick={() => { setMode("artwork"); onModeChange?.("artwork"); setError(""); }}
            className={`cursor-pointer rounded-lg px-3 py-2.5 text-[11px] font-bold transition ${mode === "artwork" ? "bg-white text-foreground-950 shadow-sm ring-1 ring-black/5" : "text-foreground-500 hover:text-foreground-800"}`}
          >
            <i className="ri-image-edit-line mr-1.5" /> Transparent artwork
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-500">Team or brand name</label>
          <input
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            placeholder="e.g. Riverside FC"
            maxLength={80}
            className="w-full rounded-xl border border-background-300 bg-white px-3.5 py-3 text-sm text-foreground-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-500">
              {mode === "uniform" && uniformPlan ? "Refine current design" : "Design brief"}
            </label>
            {mode === "uniform" && uniformPlan && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent-700">
                <i className="ri-image-line" /> Uses canvas image
              </span>
            )}
          </div>
          {mode === "uniform" && uniformPlan && (
            <p className="mb-2 text-[10px] leading-relaxed text-foreground-500">
              Describe only what should change. Everything else is preserved from the current design.
            </p>
          )}
          <textarea
            value={activePrompt}
            onChange={(event) => {
              if (mode === "uniform" && uniformPlan) setRefinementBrief(event.target.value);
              else setBrief(event.target.value);
            }}
            placeholder={mode === "uniform" && uniformPlan
              ? "e.g. Keep everything else, make the shorts black and add three red horizontal chest stripes."
              : mode === "uniform"
                ? "Describe the complete kit: colors, collar, sleeves, pattern and overall feeling…"
                : "Describe the crest, graphic, pattern or visual you want…"}
            maxLength={mode === "uniform" && uniformPlan ? 600 : mode === "uniform" ? 900 : 600}
            rows={4}
            className={`w-full resize-none rounded-t-xl border bg-white px-3.5 py-3 text-sm text-foreground-950 outline-none transition focus:ring-2 ${
              mode === "uniform" && uniformPlan
                ? "border-accent-200 focus:border-accent-500 focus:ring-accent-100"
                : "border-background-300 focus:border-primary-500 focus:ring-primary-100"
            }`}
          />
          <button
            type="button"
            disabled={generating || connection !== "connected" || !activePrompt.trim() || (!brandName.trim() && !(mode === "uniform" && uniformPlan)) || (mode === "uniform" && allDesignControlsLocked)}
            onClick={() => mode === "uniform" && uniformPlan ? generateUniform(refinementBrief) : generate()}
            className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-b-xl px-3 py-3 text-[11px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-45 ${
              mode === "uniform" && uniformPlan ? "bg-accent-500 hover:bg-accent-600" : "bg-primary-700 hover:bg-primary-800"
            }`}
          >
            <i className={generating ? "ri-loader-4-line animate-spin" : "ri-sparkling-2-fill"} />
            {generating
              ? mode === "uniform" && uniformPlan ? "Refining current image…" : mode === "uniform" ? "Designing complete kit…" : "Creating artwork…"
              : mode === "uniform" && uniformPlan ? "Refine current image" : mode === "uniform" ? "Generate full uniform" : "Generate artwork"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-background-200 bg-white">
          <button
            type="button"
            onClick={() => setHistoryOpen((current) => !current)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-3 text-left"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background-100 text-foreground-600"><i className="ri-history-line" /></span>
              <span>
                <strong className="block text-[11px] text-foreground-800">Prompt history</strong>
                <span className="block text-[9px] text-foreground-400">Saved for this design session · {promptHistory.length} {promptHistory.length === 1 ? "prompt" : "prompts"}</span>
              </span>
            </span>
            <i className={`ri-arrow-down-s-line text-foreground-400 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </button>
          {historyOpen && (
            <div className="border-t border-background-200">
              {promptHistory.length ? (
                <>
                  <div className="max-h-56 space-y-2 overflow-y-auto p-2.5">
                    {promptHistory.map((entry) => (
                      <div key={entry.id} className="rounded-lg bg-background-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-foreground-500 ring-1 ring-background-200">{entry.kind}</span>
                          <span className="text-[8px] text-foreground-400">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-relaxed text-foreground-700">{entry.prompt}</p>
                        <button type="button" onClick={() => reusePrompt(entry)} className="mt-2 cursor-pointer text-[9px] font-bold text-primary-700 hover:text-primary-900">
                          <i className="ri-corner-up-left-line mr-1" /> Use this prompt
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={clearPromptHistory} className="w-full cursor-pointer border-t border-background-200 px-3 py-2 text-[9px] font-semibold text-foreground-400 hover:bg-background-50 hover:text-red-600">
                    Clear session history
                  </button>
                </>
              ) : (
                <div className="px-3 py-4 text-center">
                  <i className="ri-chat-history-line text-lg text-foreground-300" />
                  <p className="mt-1 text-[10px] text-foreground-400">Successful prompts will appear here for review and reuse.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {preservationControls}

        <details className="group overflow-hidden rounded-xl border border-background-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background-100 text-foreground-600"><i className="ri-equalizer-2-line" /></span>
              <span>
                <strong className="block text-[11px] text-foreground-800">Creative settings</strong>
                <span className="block text-[9px] text-foreground-400">{style}{reference ? " · Reference added" : ""}</span>
              </span>
            </span>
            <i className="ri-arrow-down-s-line text-foreground-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-background-200 p-3">
            <div>
              <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-foreground-500">Style</label>
              <select value={style} onChange={(event) => setStyle(event.target.value)} className="w-full rounded-lg border border-background-300 bg-white px-3 py-2.5 text-[11px] text-foreground-950 outline-none focus:border-primary-500">
                {AI_STYLES.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>

            {mode === "uniform" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-[9px] font-bold uppercase tracking-[0.14em] text-foreground-500">Reference image <span className="font-medium normal-case tracking-normal text-foreground-400">(optional)</span></label>
                  {reference && <button type="button" onClick={() => { setReference(null); onReferenceChange?.(null); onUniformPlanChange?.(null); }} className="cursor-pointer text-[9px] font-bold text-foreground-500 hover:text-red-600">Remove</button>}
                </div>
                {reference ? (
                  <div className="relative overflow-hidden rounded-lg border border-primary-200 bg-background-100">
                    <img src={reference.src} alt="Uniform design reference" className="h-28 w-full object-contain" />
                    <div className="border-t border-primary-100 bg-white px-3 py-2 text-[9px] text-foreground-600">
                      <i className="ri-image-line mr-1 text-primary-700" /> {reference.name}
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-50 px-3 py-3 transition hover:border-primary-400 hover:bg-primary-50/40">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-foreground-500"><i className="ri-image-add-line" /></span>
                    <span className="min-w-0">
                      <strong className="block text-[10px] text-foreground-800">Add inspiration image</strong>
                      <span className="block text-[8px] leading-relaxed text-foreground-500">Guide the next AI result.</span>
                    </span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={chooseReference} />
                  </label>
                )}
              </div>
            )}
          </div>
        </details>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}

        {mode === "uniform" && uniformPlan && (
          <div className="space-y-3 rounded-2xl border border-primary-200 bg-white p-3.5 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary-700">Current AI design</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-primary-800"><i className="ri-layout-2-line" /> Shown on canvas</span>
              </div>
              <h4 className="mt-1 font-heading text-lg font-semibold text-foreground-950">{uniformPlan.name}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground-500">{uniformPlan.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={applyUniform} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2.5 text-[10px] font-bold text-white hover:bg-primary-800">
                  <i className={applied ? "ri-check-double-line" : "ri-check-line"} /> {applied ? "Applied" : "Apply design"}
                </button>
                <button type="button" disabled={generating} onClick={() => generateUniform()} className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-background-300 bg-white px-3 py-2.5 text-[10px] font-bold text-foreground-700 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <i className={generating ? "ri-loader-4-line animate-spin" : "ri-refresh-line"} /> {generating ? "Designing…" : "New direction"}
                </button>
              </div>
            </div>
            <details className="group rounded-xl border border-background-200 bg-background-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[10px] font-bold text-foreground-700">
                Production mapping details
                <i className="ri-arrow-down-s-line transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-background-200 p-3">
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-lg bg-background-100 px-3 py-2"><span className="text-foreground-400">Collar</span><strong className="mt-0.5 block text-foreground-800">{uniformPlan.collar}</strong></div>
                  <div className="rounded-lg bg-background-100 px-3 py-2"><span className="text-foreground-400">Sleeves</span><strong className="mt-0.5 block text-foreground-800">{uniformPlan.sleeve}</strong></div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(uniformPlan.colors).map(([key, value]) => (
                    <div key={key} title={`${AI_COLOR_LABELS[key]}: ${value}`} className="text-center">
                      <span className="mx-auto block h-8 w-8 rounded-full border border-black/10 shadow-sm" style={{ background: value }} />
                      <span className="mt-1 block truncate text-[8px] text-foreground-500">{AI_COLOR_LABELS[key]}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-background-200 px-3 py-2 text-[10px] text-foreground-600">
                  <strong className="text-foreground-800">Pattern:</strong> {uniformPlan.pattern.enabled ? `${uniformPlan.pattern.key} · ${uniformPlan.pattern.view}` : "Clean / none"}
                </div>
              </div>
            </details>
            {uniformPlan.crestSuggestion && (
              <button
                type="button"
                onClick={() => { setMode("artwork"); onModeChange?.("artwork"); setBrief(uniformPlan.crestSuggestion); setPreview(null); }}
                className="w-full cursor-pointer rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-[10px] text-primary-800 hover:bg-primary-100"
              >
                <strong className="block">Optional matching crest</strong>
                <span>{uniformPlan.crestSuggestion}</span>
                <span className="mt-1 block font-bold">Open in Transparent artwork →</span>
              </button>
            )}
          </div>
        )}

        {mode === "artwork" && preview && (
          <div className="rounded-2xl border border-primary-200 bg-[linear-gradient(45deg,#f1efe8_25%,transparent_25%),linear-gradient(-45deg,#f1efe8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1efe8_75%),linear-gradient(-45deg,transparent_75%,#f1efe8_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-3">
            <img src={preview.src} alt="Generated transparent uniform artwork" className="mx-auto aspect-square max-h-64 w-full object-contain" />
          </div>
        )}

        {mode === "artwork" && preview && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => onPlace(preview)} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-800">
              <i className="ri-add-circle-line" /> Place on uniform
            </button>
            <button type="button" aria-label="Clear AI preview" onClick={() => setPreview(null)} className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-background-300 bg-white px-3 text-foreground-600 hover:bg-background-100">
              <i className="ri-delete-bin-line" />
            </button>
          </div>
        )}

        {canUndoUniform && mode === "uniform" && (
          <button type="button" onClick={onUndoUniform} className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-background-300 bg-white px-4 py-2.5 text-xs font-bold text-foreground-700 hover:bg-background-100">
            <i className="ri-arrow-go-back-line" /> Undo last AI design
          </button>
        )}
        <p className="text-[10px] leading-relaxed text-foreground-500">AI creates an editable design direction—not a manufacturing cut file. Confirm colors, spelling and production suitability before ordering.</p>
      </div>
    </div>
  );
}

/**
 * Placeable graphics library. Each swatch previews with the customer's own
 * two colours, so what they click is what lands on the garment — a library of
 * fixed-colour thumbnails would mean every choice arrives in the wrong
 * palette and needs recolouring.
 */
export function SkinsPanel({ colorA, colorB, onAdd, onUpload }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-3">
        Patterns
      </h3>
      <p className="text-xs text-foreground-600 font-label mb-4">
        Click one to drop it on the kit, then drag it anywhere and resize it.
      </p>

      {/* Own artwork sits above the library: a club arriving with its own
          pattern shouldn't have to scroll past a dozen generic ones first. */}
      <label className="flex flex-col items-center justify-center gap-1.5 w-full py-5 rounded-lg border-2 border-dashed border-background-300 hover:border-primary-400 hover:bg-primary-50/20 cursor-pointer transition-colors text-center mb-2">
        <i className="ri-upload-cloud-2-line text-xl text-foreground-400" />
        <span className="text-xs font-semibold text-foreground-700">Upload pattern</span>
        <span className="text-[10px] text-foreground-500 font-label px-3">
          PNG, JPG or SVG — tileable artwork works best
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </label>
      <p className="text-[10px] text-foreground-500 font-label mb-5">
        Uploaded patterns keep their own colours — they aren't re-tinted to your kit palette.
      </p>

      {skinGroups.map((group) => (
        <div key={group} className="mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400 block mb-2">
            {group}
          </span>
          <div className="grid grid-cols-4 gap-2">
            {skinLibrary
              .filter((s) => s.group === group)
              .map((s) => (
                <button
                  key={s.key}
                  type="button"
                  title={s.label}
                  aria-label={s.label}
                  onClick={() => onAdd(s.key)}
                  className="aspect-square rounded-lg overflow-hidden border border-background-200/70 hover:border-primary-400 hover:ring-2 hover:ring-primary-200 transition-all cursor-pointer"
                >
                  <img
                    src={skinDataUri(s.key, colorA, colorB)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
          </div>
        </div>
      ))}

      <p className="text-[11px] text-foreground-500 font-label pt-2 border-t border-background-200/70">
        Skins follow your two garment colours. Change the shirt or trim colour in
        <span className="font-semibold"> Design</span> and every skin updates with it.
      </p>
    </div>
  );
}

/**
 * PLACEHOLDER CONTENT — dummy colourways and starter layouts so the Layers
 * panel isn't an empty box on a fresh design. Swap the palettes for the
 * client's real club colourways, and wire `presetLayouts` to actual saved
 * designs once those exist; nothing else depends on these values.
 */
const presetColourways = [
  { key: "club-red", label: "Club Red", colors: ["#c0392b", "#ffffff", "#1b1a16"] },
  { key: "navy-gold", label: "Navy & Gold", colors: ["#0c2340", "#e4a11b", "#ffffff"] },
  { key: "forest", label: "Forest", colors: ["#0c8a57", "#f6f1e7", "#086b44"] },
  { key: "blackout", label: "Blackout", colors: ["#1b1a16", "#3d3d3d", "#9b9b9b"] },
  { key: "sky", label: "Sky", colors: ["#1f5c7a", "#ffffff", "#e4583a"] },
  { key: "sand", label: "Sand", colors: ["#d9c7b8", "#7a6a53", "#ffffff"] },
];

const presetLayouts = [
  { key: "chest-crest", label: "Chest crest", icon: "ri-shield-star-line" },
  { key: "name-number", label: "Name + number", icon: "ri-t-shirt-line" },
  { key: "sponsor-bar", label: "Sponsor bar", icon: "ri-layout-row-line" },
  { key: "sleeve-badge", label: "Sleeve badge", icon: "ri-award-line" },
];

export function LayersPanel({
  layers,
  view,
  selectedId,
  onSelect,
  onRemove,
  onReorder,
  onApplyColourway,
}) {
  const viewLayers = layers.filter((l) => l.view === view);

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-3">
        Quick colourways
      </h3>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {presetColourways.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.label}
            onClick={() => onApplyColourway?.(p.colors)}
            className="rounded-lg border border-background-200/70 hover:border-primary-400 hover:ring-2 hover:ring-primary-100 transition-all cursor-pointer overflow-hidden"
          >
            <span className="flex h-8">
              {p.colors.map((c) => (
                <span key={c} className="flex-1" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="block text-[10px] font-label text-foreground-600 py-1 px-1 truncate">
              {p.label}
            </span>
          </button>
        ))}
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-3">
        Starter layouts
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {presetLayouts.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled
            title="Coming soon"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-background-200/70 bg-background-100/40 text-left opacity-60 cursor-not-allowed"
          >
            <i className={`${p.icon} text-foreground-400`} />
            <span className="text-[11px] font-label text-foreground-600 truncate">{p.label}</span>
          </button>
        ))}
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4 pt-2 border-t border-background-200/70">
        On this design — {view === "front" ? "Front" : view === "side" ? "Side" : "Back"}
      </h3>
      {viewLayers.length === 0 ? (
        <p className="text-xs text-foreground-500 font-label">
          Nothing here yet. Add text or a logo, and it'll show up in this list.
        </p>
      ) : (
        <div className="space-y-2">
          {[...viewLayers].reverse().map((layer, i) => (
            <div
              key={layer.id}
              onClick={() => onSelect(layer.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                selectedId === layer.id
                  ? "border-primary-400 bg-primary-50/50"
                  : "border-background-200/70 hover:bg-background-100"
              }`}
            >
              <i
                className={`text-sm flex-shrink-0 text-foreground-500 ${
                  layer.type === "text"
                    ? "ri-font-size"
                    : layer.type === "skin"
                    ? "ri-shapes-line"
                    : "ri-image-line"
                }`}
              />
              <span className="text-xs font-medium text-foreground-800 truncate flex-1">
                {layer.type === "text"
                  ? layer.text || "Text"
                  : layer.type === "skin"
                  ? findSkin(layer.skinKey)?.label || "Skin"
                  : "Logo"}
              </span>
              <button
                type="button"
                aria-label="Move up"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onReorder(layer.id, "up");
                }}
                className="w-6 h-6 flex items-center justify-center text-foreground-400 hover:text-foreground-800 disabled:opacity-30 cursor-pointer"
              >
                <i className="ri-arrow-up-s-line" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={i === viewLayers.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onReorder(layer.id, "down");
                }}
                className="w-6 h-6 flex items-center justify-center text-foreground-400 hover:text-foreground-800 disabled:opacity-30 cursor-pointer"
              >
                <i className="ri-arrow-down-s-line" />
              </button>
              <button
                type="button"
                aria-label="Delete layer"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(layer.id);
                }}
                className="w-6 h-6 flex items-center justify-center text-foreground-400 hover:text-accent-500 cursor-pointer"
              >
                <i className="ri-delete-bin-line" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
