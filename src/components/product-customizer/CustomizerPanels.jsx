import { clipartLibrary } from "../../data/customizer";

/**
 * `productTypes`, `colorPalette`, and `techniques` are passed in from
 * ProductCustomizerPage rather than imported here directly — they come
 * from the live product-type config (admin-managed in wp-admin) when a
 * backend is connected, and from data/customizer.js as a local fallback
 * otherwise. See repository.js's getProductTypes().
 */
export function ProductPanel({
  productTypes,
  productType,
  setProductType,
  color,
  setColor,
  colorPalette,
  technique,
  setTechnique,
  techniques,
}) {
  const groups = [...new Set(techniques.map((t) => t.group))];

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-4">
        Product
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {productTypes.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setProductType(p.slug)}
            className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl border cursor-pointer transition-all ${
              productType === p.slug
                ? "bg-primary-500 text-background-50 border-primary-500 shadow-md shadow-primary-500/20 scale-[1.02]"
                : "bg-background-50 text-foreground-700 border-background-200/70 hover:border-primary-300 hover:bg-primary-50/30"
            }`}
          >
            <i className={`${p.icon} text-lg`} />
            <span className="text-xs font-semibold">{p.label}</span>
          </button>
        ))}
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-3 pt-4 border-t border-background-200/70">
        Technique
      </h3>
      {groups.map((group) => (
        <div key={group} className="mb-3">
          <span className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide block mb-1.5">
            {group}
          </span>
          <div className="space-y-1.5">
            {techniques
              .filter((t) => t.group === group)
              .map((t) => (
                <label
                  key={t.key}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    technique === t.key
                      ? "border-primary-400 bg-primary-50/50"
                      : "border-background-200/70 hover:bg-background-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="technique"
                    checked={technique === t.key}
                    onChange={() => setTechnique(t.key)}
                    className="accent-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground-800">{t.label}</span>
                      {t.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent-500 text-background-50">
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-500 font-label truncate">
                      {t.description}
                    </p>
                  </div>
                </label>
              ))}
          </div>
        </div>
      ))}

      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-3 pt-3 border-t border-background-200/70">
        Color
      </h3>
      <div className="grid grid-cols-8 gap-1.5">
        {colorPalette.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => setColor(c)}
            className={`aspect-square rounded-full border-2 cursor-pointer transition-all ${
              color === c
                ? "border-primary-500 scale-110 shadow-md"
                : "border-background-200 hover:scale-105 shadow-sm"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * `allowed` reflects the current placement's admin-configured
 * `allow_text`/`allow_logo` zone flags (see connect767-cms's product_type
 * CPT). When an admin has turned a zone off for a given kind of
 * customization — e.g. no text on an inside label, no logos on a sleeve —
 * the add action here is disabled with an explanation instead of silently
 * still working.
 */
export function CustomizerTextPanel({ onAdd, allowed = true }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-4">
        Text
      </h3>
      <button
        type="button"
        onClick={onAdd}
        disabled={!allowed}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/40 text-sm font-semibold text-primary-700 hover:bg-primary-50 hover:border-primary-400 transition-colors cursor-pointer mb-5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary-50/40"
      >
        <i className="ri-add-line" />
        Add text layer
      </button>
      {!allowed && (
        <p className="text-xs text-accent-600 font-label leading-relaxed mb-4 flex items-start gap-1.5">
          <i className="ri-lock-line mt-0.5 flex-shrink-0" />
          Text isn't enabled for this placement.
        </p>
      )}
      <p className="text-xs text-foreground-500 font-label leading-relaxed">
        Click a text layer to edit its content. Select it and use the toolbar above the canvas
        for font, bold/italic, outline, drop shadow, curve, color, size, and rotation.
      </p>
    </div>
  );
}

/**
 * Uploads + Clipart merged into one "Art" panel — in the original build
 * these were two separate top-level tabs (plus a "Premium" third tier of
 * clipart). For Connect767's actual catalog, every one of those is just
 * "artwork you drop onto the design," so they're one tool now: fewer tabs,
 * nothing lost. See ProductCustomizerPage.jsx for the removed tabs
 * (Premium/Quick Designs/Saved/Fill) and why.
 */
export function ArtPanel({ uploads, onUploadNew, onAddFromLibrary, onAddClipart, allowed = true }) {
  if (!allowed) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-4">
          Art
        </h3>
        <p className="text-xs text-accent-600 font-label leading-relaxed flex items-start gap-1.5">
          <i className="ri-lock-line mt-0.5 flex-shrink-0" />
          Logos and artwork aren't enabled for this placement.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-4">
        Art
      </h3>
      <label className="flex flex-col items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed border-background-300 hover:border-primary-400 hover:bg-primary-50/20 cursor-pointer transition-colors text-center mb-4">
        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <i className="ri-upload-cloud-2-line text-base" />
        </div>
        <span className="text-xs text-foreground-600 font-label px-4">
          Upload a transparent PNG or SVG
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onUploadNew} />
      </label>

      {uploads.length > 0 && (
        <>
          <span className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide block mb-2">
            Your uploads — click to place
          </span>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {uploads.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onAddFromLibrary(u)}
                title="Add to canvas"
                className="aspect-square rounded-lg border border-background-200/70 bg-background-100/40 hover:border-primary-400 hover:bg-primary-50/40 transition-colors cursor-pointer overflow-hidden p-1.5"
              >
                <img src={u.src} alt="Upload" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </>
      )}

      <span className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide block mb-2 pt-1 border-t border-background-200/70">
        Clipart — tap to place
      </span>
      <div className="grid grid-cols-4 gap-2">
        {clipartLibrary.map((c) => (
          <button
            key={c.key}
            type="button"
            title={c.label}
            onClick={() => onAddClipart(c)}
            className="aspect-square flex items-center justify-center rounded-xl border border-background-200/70 bg-background-50 text-foreground-700 hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600 hover:scale-105 transition-all cursor-pointer"
          >
            <i className={`${c.icon} text-xl`} />
          </button>
        ))}
      </div>
    </div>
  );
}
