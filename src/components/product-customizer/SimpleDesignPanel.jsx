import { clipartLibrary } from "../../data/customizer";

/**
 * Everything for step 2, in one flat panel — no tabs. Replaces the old
 * Product/Text/Art/Order icon-rail split: for a tool whose entire job is
 * "recolor it, add a logo, add some text," switching tabs to reach each
 * one was overhead the actual task didn't need. Color, Add text, and Add
 * logo/art are all visible at the same time; `allowText`/`allowLogo` (the
 * admin's per-placement rules — see connect767-cms's product_type CPT)
 * just disable the relevant button with a short explanation instead of
 * hiding an entire tab.
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
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-3">
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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-3">
          Text
        </h3>
        <button
          type="button"
          onClick={onAddText}
          disabled={!allowText}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/40 text-sm font-semibold text-primary-700 hover:bg-primary-50 hover:border-primary-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary-50/40"
        >
          <i className="ri-add-line" />
          Add text
        </button>
        {allowText && (
          <p className="text-xs text-foreground-400 font-label mt-2">
            Double-click the text on the design to edit it.
          </p>
        )}
        {!allowText && (
          <p className="text-xs text-accent-600 font-label mt-2 flex items-start gap-1.5">
            <i className="ri-lock-line mt-0.5 flex-shrink-0" />
            Text isn't enabled for this placement.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-3">
          Logo &amp; art
        </h3>
        {!allowLogo ? (
          <p className="text-xs text-accent-600 font-label flex items-start gap-1.5">
            <i className="ri-lock-line mt-0.5 flex-shrink-0" />
            Logos and artwork aren't enabled for this placement.
          </p>
        ) : (
          <>
            <label className="flex flex-col items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed border-background-300 hover:border-primary-400 hover:bg-primary-50/20 cursor-pointer transition-colors text-center mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <i className="ri-upload-cloud-2-line text-base" />
              </div>
              <span className="text-xs text-foreground-600 font-label px-4">Upload a logo (PNG or SVG)</span>
              <input type="file" accept="image/*" className="hidden" onChange={onUploadNew} />
            </label>

            {uploads.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-3">
                {uploads.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onAddFromLibrary(u)}
                    title="Add to design"
                    className="aspect-square rounded-lg border border-background-200/70 bg-background-100/40 hover:border-primary-400 hover:bg-primary-50/40 transition-colors cursor-pointer overflow-hidden p-1.5"
                  >
                    <img src={u.src} alt="Upload" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            <span className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide block mb-2">
              Or pick an icon
            </span>
            <div className="grid grid-cols-8 gap-1.5">
              {clipartLibrary.slice(0, 8).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  onClick={() => onAddClipart(c)}
                  className="aspect-square flex items-center justify-center rounded-lg border border-background-200/70 bg-background-50 text-foreground-700 hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-600 transition-all cursor-pointer"
                >
                  <i className={`${c.icon} text-base`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
