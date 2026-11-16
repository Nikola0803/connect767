import { useEffect, useState } from "react";
import { skinLibrary, skinGroups, skinDataUri, findSkin } from "../../data/skins";
import {
  zoneColorPalette,
  fitTypeOptions,
  kitTypeOptions,
  logoApplicationOptions,
  ADD_ON_PRICES,
  sportConfigFor,
} from "../../data/uniforms";
import { NO_DETECTED_SOURCE_ELEMENTS, zoneOverlapWarnings, zoneValidation } from "./uniformZoneModel";
import {
  DEFAULT_STUDIO_BACKGROUND,
  STUDIO_BACKGROUND_PRESETS,
  isStudioHex,
} from "./studioBackgrounds";

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
              aria-label={c}
              onClick={() => {
                setBase(c);
                setShade(0);
                onChange(c);
              }}
              className="relative w-7 h-7 rounded-full cursor-pointer shadow-sm ring-1 ring-black/5 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
            >
              {value === c && (
                <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-primary-500" />
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
  const setLowerColour = (color) => {
    setTwoTone((current) => ({ ...current, enabled: true, colorB: color, splitAt: 0.5, softness: 0.005 }));
    setColors((current) => ({ ...current, shorts: color }));
  };
  const config = sportConfigFor(sport);

  return (
    <div>
      <p className="text-xs text-foreground-500 font-label mb-5 -mt-1">
        Hover any color below to see exactly which part of the shirt it changes.
      </p>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Shape
      </h3>
      <div className="mb-6">
        <span className="text-xs font-semibold text-foreground-800 block mb-2">Collar type</span>
        <div className="flex gap-2 flex-wrap">
          {config.collarOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCollar(c)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                collar === c
                  ? "bg-primary-500 text-background-50 border-primary-500 shadow-sm shadow-primary-500/20"
                  : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
              }`}
            >
              {c}
              {c === "Polo" && (
                <span className="ml-1 font-normal opacity-80">
                  (+${ADD_ON_PRICES.collarPolo.toFixed(2)}/kit)
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {config.sleeveOptions && (
        <div className="mb-6">
          <span className="text-xs font-semibold text-foreground-800 block mb-2">
            Sleeve length
          </span>
          <div className="flex gap-2 flex-wrap">
            {config.sleeveOptions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSleeve(s)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                  sleeve === s
                    ? "bg-primary-500 text-background-50 border-primary-500 shadow-sm shadow-primary-500/20"
                    : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
                }`}
              >
                {s}
                {(s === "Long" || s === "Mixed") && (
                  <span className="ml-1 font-normal opacity-80">
                    (+${ADD_ON_PRICES.sleeveLong.toFixed(2)}/kit)
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {twoTone && (
        <>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-3 pt-2 border-t border-background-200/70">
            Two-tone garment
          </h3>
          <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-background-300 cursor-pointer"
              checked={twoTone.enabled}
              onChange={(e) => toggleTwoTone(e.target.checked)}
            />
            <span className="text-xs text-foreground-700 font-label">
              Use a separate lower colour for the shorts or trousers. The split follows the actual
              waist seam in both the 2D editor and 3D preview.
            </span>
          </label>

          {twoTone.enabled && (
            <div className="mb-6 pl-1">
              <span className="block text-xs font-semibold text-foreground-800 mb-2">
                Shorts / lower colour
              </span>
              <div className="flex flex-wrap gap-2 mb-4">
                {zoneColorPalette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Shorts or lower colour ${c}`}
                    onClick={() => setLowerColour(c)}
                    className={`relative w-7 h-7 rounded-full cursor-pointer shadow-sm ring-1 ring-black/5 transition-transform hover:scale-110 ${
                      twoTone.colorB === c ? "ring-2 ring-offset-2 ring-primary-500" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-[11px] leading-relaxed text-primary-900">
                Shirt: <strong>{colors.body.toUpperCase()}</strong> · {config.bottomLabel}: <strong>{colors.shorts.toUpperCase()}</strong>
              </p>
            </div>
          )}
        </>
      )}

      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4 pt-2 border-t border-background-200/70">
        Garment colors
      </h3>
      <ColorRow
        label="Collar"
        value={colors.collar}
        onChange={setZone("collar")}
        zone="collar"
        onHoverZone={onHoverZone}
      />
      <ColorRow
        label="Shirt (body)"
        value={colors.body}
        onChange={setZone("body")}
        zone="body"
        onHoverZone={onHoverZone}
      />
      {config.sleeveOptions && (
        <ColorRow
          label="Sleeve"
          value={colors.sleeve}
          onChange={setZone("sleeve")}
          zone="sleeve"
          onHoverZone={onHoverZone}
        />
      )}
      <ColorRow
        label={config.bottomLabel}
        value={colors.shorts}
        onChange={setZone("shorts")}
        zone="shorts"
        onHoverZone={onHoverZone}
      />
      {config.hasSocks && (
        <>
          <ColorRow
            label="Socks"
            value={colors.socks}
            onChange={setZone("socks")}
            zone="socks"
            onHoverZone={onHoverZone}
          />
        </>
      )}

      <ColorRow
        label="Shirt ends"
        value={colors.shirtStrip}
        onChange={setZone("shirtStrip")}
        zone="shirtStrip"
        onHoverZone={onHoverZone}
      />
      {config.sleeveOptions && (
        <ColorRow
          label="Sleeve ends"
          value={colors.sleeveStrip}
          onChange={setZone("sleeveStrip")}
          zone="sleeveStrip"
          onHoverZone={onHoverZone}
        />
      )}
      <ColorRow
        label={`${config.bottomLabel} ends`}
        value={colors.shortsStrip}
        onChange={setZone("shortsStrip")}
        zone="shortsStrip"
        onHoverZone={onHoverZone}
      />
      <p className="text-[11px] text-foreground-500 font-label -mt-3">
        Each color maps to one named garment part. No hidden side-panel color is applied.
      </p>
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
export function OptionsPanel({
  fitType,
  setFitType,
  kitType,
  setKitType,
  logoApplication,
  setLogoApplication,
  insideCollarMessage,
  setInsideCollarMessage,
  insideCollarText,
  setInsideCollarText,
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
        Saved with this design and used in both 2D and 3D preview.
      </p>

      <p className="text-xs text-foreground-500 font-label mb-5 -mt-1">
        These choices don't change the shirt's colors or shape, but every one that adds a cost is
        marked right on the button.
      </p>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Fit &amp; kit type
      </h3>
      <div className="mb-6">
        <span className="text-xs font-semibold text-foreground-800 block mb-2">Fit type</span>
        <div className="flex gap-2 flex-wrap">
          {fitTypeOptions.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFitType(f)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
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
      <div className="mb-6">
        <span className="text-xs font-semibold text-foreground-800 block mb-2">Kit type</span>
        <div className="flex gap-2 flex-wrap">
          {kitTypeOptions.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKitType(k)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                kitType === k
                  ? "bg-primary-500 text-background-50 border-primary-500 shadow-sm shadow-primary-500/20"
                  : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4 pt-2 border-t border-background-200/70">
        Priced add-ons
      </h3>
      <div className="mb-6">
        <span className="text-xs font-semibold text-foreground-800 block mb-2">
          Team logo application
        </span>
        <div className="flex gap-2 flex-wrap">
          {logoApplicationOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setLogoApplication(opt)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
                logoApplication === opt
                  ? "bg-primary-500 text-background-50 border-primary-500 shadow-sm shadow-primary-500/20"
                  : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
              }`}
            >
              {opt}
              {opt === "Embroidery" && (
                <span className="ml-1 font-normal opacity-80">
                  (+${ADD_ON_PRICES.logoEmbroidery.toFixed(2)}/kit)
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2">
        <span className="text-xs font-semibold text-foreground-800 block mb-2">
          Custom Logo/Message in Collar
          <span className="ml-1 font-normal text-foreground-500">
            (+${ADD_ON_PRICES.insideCollarMessage.toFixed(2)}/kit if added)
          </span>
        </span>
        <div className="flex gap-2 flex-wrap mb-3">
          {["No", "Yes"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setInsideCollarMessage(opt === "Yes")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-all ${
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
          <input
            type="text"
            placeholder="Message for the inside collar"
            value={insideCollarText}
            onChange={(e) => setInsideCollarText(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label"
          />
        )}
      </div>
      <p className="text-[11px] text-foreground-500 font-label pt-2">
        Sleeve length and collar type also affect price — see the Shape section for those.
      </p>
    </div>
  );
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
        too. Around 1000&nbsp;&times;&nbsp;1000px or larger keeps it sharp.
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

export function AIArtworkPanel({ sport, colors, onPlace }) {
  const [brandName, setBrandName] = useState("");
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState(AI_STYLES[0]);
  const [connection, setConnection] = useState("checking");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/generate-design")
      .then((response) => response.json())
      .then((data) => active && setConnection(data.configured ? "connected" : "setup"))
      .catch(() => active && setConnection("offline"));
    return () => { active = false; };
  }, []);

  const generate = async () => {
    if (!brandName.trim() || !brief.trim()) return;
    setGenerating(true);
    setError("");
    setPreview(null);
    try {
      const response = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "Jersey",
          style,
          brandName: brandName.trim(),
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
        name: `${brandName.trim()} AI artwork`,
      });
    } catch (generationError) {
      setError(generationError.message || "AI generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-lg text-white shadow-sm">
              <i className="ri-sparkling-2-fill" />
            </span>
            <div>
              <h3 className="font-heading text-lg font-semibold text-foreground-950">AI Designer</h3>
              <p className="text-[11px] text-foreground-500">Create transparent artwork for this {sport.toLowerCase()} uniform.</p>
            </div>
          </div>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
            connection === "connected" ? "bg-primary-100 text-primary-800" : "bg-amber-100 text-amber-800"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connection === "connected" ? "bg-primary-500" : "bg-amber-500"}`} />
            {connection === "checking" ? "Checking" : connection === "connected" ? "Connected" : "Setup needed"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
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
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-500">Design brief</label>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="Describe the crest, graphic, pattern or visual you want…"
            maxLength={600}
            rows={4}
            className="w-full resize-none rounded-xl border border-background-300 bg-white px-3.5 py-3 text-sm text-foreground-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-500">Style</label>
          <select value={style} onChange={(event) => setStyle(event.target.value)} className="w-full rounded-xl border border-background-300 bg-white px-3.5 py-3 text-sm text-foreground-950 outline-none focus:border-primary-500">
            {AI_STYLES.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-background-200 bg-background-100 px-3 py-2.5">
          <span className="text-[11px] font-semibold text-foreground-600">Uses current uniform colors</span>
          <div className="flex items-center gap-1.5">
            <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: colors.body }} />
            <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: colors.shirtStrip }} />
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}

        {preview && (
          <div className="rounded-2xl border border-primary-200 bg-[linear-gradient(45deg,#f1efe8_25%,transparent_25%),linear-gradient(-45deg,#f1efe8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1efe8_75%),linear-gradient(-45deg,transparent_75%,#f1efe8_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-3">
            <img src={preview.src} alt="Generated transparent uniform artwork" className="mx-auto aspect-square max-h-64 w-full object-contain" />
          </div>
        )}

        {preview ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => onPlace(preview)} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-800">
              <i className="ri-add-circle-line" /> Place on uniform
            </button>
            <button type="button" aria-label="Clear AI preview" onClick={() => setPreview(null)} className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-background-300 bg-white px-3 text-foreground-600 hover:bg-background-100">
              <i className="ri-delete-bin-line" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={generating || connection !== "connected" || !brandName.trim() || !brief.trim()}
            onClick={generate}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,116,73,0.18)] transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <i className={generating ? "ri-loader-4-line animate-spin" : "ri-sparkling-2-fill"} />
            {generating ? "Creating artwork…" : "Generate AI artwork"}
          </button>
        )}
        <p className="text-[10px] leading-relaxed text-foreground-500">AI output is a design concept. Confirm final print quality, spelling and production suitability before ordering.</p>
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
        On this design — {view === "front" ? "Front" : "Back"}
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
