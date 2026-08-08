import {
  zoneColorPalette,
  fitTypeOptions,
  kitTypeOptions,
  logoApplicationOptions,
  ADD_ON_PRICES,
  sportConfigFor,
} from "../../data/uniforms";

function ColorRow({ label, value, onChange, zone, onHoverZone }) {
  const hoverable = Boolean(zone && onHoverZone);
  return (
    <div
      className={`mb-6 -mx-2 px-2 py-1.5 rounded-lg transition-colors ${hoverable ? "hover:bg-primary-50/60" : ""}`}
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
        <span
          className="w-6 h-6 rounded-full ring-1 ring-background-300 shadow-sm"
          style={{ backgroundColor: value }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {zoneColorPalette.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => onChange(c)}
            className="relative w-7 h-7 rounded-full cursor-pointer shadow-sm ring-1 ring-black/5 transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
          >
            {value === c && (
              <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-primary-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DesignPanel({ sport, collar, setCollar, sleeve, setSleeve, colors, setColors, onHoverZone }) {
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
          Inside shirt collar message
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

export function TextPanel({ onAdd }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Text
      </h3>
      <button
        type="button"
        onClick={onAdd}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-background-300 text-sm font-semibold text-foreground-800 hover:bg-background-100 cursor-pointer mb-5"
      >
        <i className="ri-add-line" />
        Add text layer
      </button>
      <p className="text-xs text-foreground-500 font-label">
        Click a text layer on the jersey to edit its content, font, color, size, and rotation from
        the toolbar above the canvas.
      </p>
    </div>
  );
}

export function LogoPanel({ onUpload }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Logo
      </h3>
      <label className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-lg border-2 border-dashed border-background-300 hover:border-primary-400 cursor-pointer transition-colors text-center mb-5">
        <i className="ri-image-add-line text-2xl text-foreground-400" />
        <span className="text-xs text-foreground-600 font-label px-4">
          Click to upload a transparent PNG or SVG
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </label>
      <p className="text-xs text-foreground-500 font-label">
        Click a logo on the jersey to resize, rotate, or reorder it from the toolbar above the
        canvas.
      </p>
    </div>
  );
}

export function LayersPanel({ layers, view, selectedId, onSelect, onRemove, onReorder }) {
  const viewLayers = layers.filter((l) => l.view === view);

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground-400 mb-4">
        Layers — {view === "front" ? "Front" : "Back"}
      </h3>
      {viewLayers.length === 0 ? (
        <p className="text-xs text-foreground-500 font-label">
          Nothing on this side yet. Add text or a logo, and it'll show up here.
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
                className={`text-sm flex-shrink-0 ${
                  layer.type === "text" ? "ri-font-size" : "ri-image-line"
                } text-foreground-500`}
              />
              <span className="text-xs font-medium text-foreground-800 truncate flex-1">
                {layer.type === "text" ? layer.text || "Text" : "Logo"}
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
