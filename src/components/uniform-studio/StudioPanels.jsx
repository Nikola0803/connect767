import { useState } from "react";
import { skinLibrary, skinGroups, skinDataUri, findSkin } from "../../data/skins";
import {
  zoneColorPalette,
  fitTypeOptions,
  kitTypeOptions,
  logoApplicationOptions,
  ADD_ON_PRICES,
  sportConfigFor,
} from "../../data/uniforms";

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
  const setZone = (zone) => (color) => setColors((c) => ({ ...c, [zone]: color }));
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
              onChange={(e) => setTwoTone((t) => ({ ...t, enabled: e.target.checked }))}
            />
            <span className="text-xs text-foreground-700 font-label">
              Split the kit into two colours — a hard seam for shirt vs shorts, or a soft fade for
              a gradient.
            </span>
          </label>

          {twoTone.enabled && (
            <div className="mb-6 pl-1">
              <span className="block text-xs font-semibold text-foreground-800 mb-2">
                Lower colour
              </span>
              <div className="flex flex-wrap gap-2 mb-4">
                {zoneColorPalette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Lower colour ${c}`}
                    onClick={() => setTwoTone((t) => ({ ...t, colorB: c }))}
                    className={`relative w-7 h-7 rounded-full cursor-pointer shadow-sm ring-1 ring-black/5 transition-transform hover:scale-110 ${
                      twoTone.colorB === c ? "ring-2 ring-offset-2 ring-primary-500" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground-800" htmlFor="tt-split">
                  Split height
                </label>
                <span className="text-[11px] text-foreground-500 font-label">
                  {Math.round(twoTone.splitAt * 100)}%
                </span>
              </div>
              <input
                id="tt-split"
                type="range"
                min="0.1"
                max="0.9"
                step="0.01"
                value={twoTone.splitAt}
                onChange={(e) =>
                  setTwoTone((t) => ({ ...t, splitAt: Number(e.target.value) }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-background-200 accent-primary-500 mb-4"
              />

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground-800" htmlFor="tt-soft">
                  Blend
                </label>
                <span className="text-[11px] text-foreground-500 font-label">
                  {twoTone.softness <= 0.05 ? "Hard seam" : "Gradient"}
                </span>
              </div>
              <input
                id="tt-soft"
                type="range"
                min="0.005"
                max="0.5"
                step="0.005"
                value={twoTone.softness}
                onChange={(e) =>
                  setTwoTone((t) => ({ ...t, softness: Number(e.target.value) }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-background-200 accent-primary-500"
              />
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
      <ColorRow label={config.bottomLabel} value={colors.shorts} onChange={setZone("shorts")} />
      {config.hasSocks && (
        <>
          <ColorRow label="Socks" value={colors.socks} onChange={setZone("socks")} />
          <p className="text-[11px] text-foreground-500 font-label -mt-3 mb-5">
            Socks color is saved with your quote and shown on the production proof — the live
            preview shows it in the full kit strip above the canvas.
          </p>
        </>
      )}

      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4 pt-2 border-t border-background-200/70">
        Strip / trim colors
      </h3>
      <ColorRow
        label="Trim (hem &amp; cuffs)"
        value={colors.trim}
        onChange={setZone("trim")}
        zone="trim"
        onHoverZone={onHoverZone}
      />
      {config.sleeveOptions && (
        <ColorRow label="Sleeve strip" value={colors.sleeveStrip} onChange={setZone("sleeveStrip")} />
      )}
      <ColorRow
        label={`${config.bottomLabel} strip`}
        value={colors.shortsStrip}
        onChange={setZone("shortsStrip")}
      />
      <ColorRow
        label="Side panels"
        value={colors.panel}
        onChange={setZone("panel")}
        zone="panel"
        onHoverZone={onHoverZone}
      />
      <p className="text-[11px] text-foreground-500 font-label -mt-3">
        Sleeve strip and {config.bottomLabel.toLowerCase()} strip are saved with your quote for the
        production proof — they don't have a matching zone on the live shirt preview.
      </p>
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
}) {
  return (
    <div>
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
