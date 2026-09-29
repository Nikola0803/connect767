import { useState } from "react";

/**
 * Enhanced upload section with thumbnail previews, zoom controls,
 * and recommended image size guidance.
 */
export default function EnhancedUploadSection({
  uploads,
  onUploadNew,
  onAddFromLibrary,
  recommendedSize = "800x800px",
}) {
  const [zoomedImageId, setZoomedImageId] = useState(null);

  return (
    <div className="space-y-3">
      <label className="flex flex-col items-center justify-center gap-2 w-full py-6 rounded-xl border-2 border-dashed border-background-300 hover:border-primary-400 hover:bg-primary-50/20 cursor-pointer transition-colors text-center">
        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <i className="ri-upload-cloud-2-line text-base" />
        </div>
        <span className="text-xs text-foreground-600 font-label px-4">Upload a logo (PNG or SVG)</span>
        <input type="file" accept="image/*" className="hidden" onChange={onUploadNew} />
      </label>

      <p className="text-[10px] text-foreground-500 font-label">
        Recommended size: <span className="font-semibold text-foreground-700">{recommendedSize}</span>
      </p>

      {uploads.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide mb-2">
            Your uploads
          </p>
          <div className="grid grid-cols-5 gap-2">
            {uploads.map((u) => (
              <div key={u.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onAddFromLibrary(u)}
                  title="Add to design"
                  className="aspect-square w-full rounded-lg border border-background-200/70 bg-background-100/40 hover:border-primary-400 hover:bg-primary-50/40 transition-colors cursor-pointer overflow-hidden p-1.5"
                >
                  <img src={u.src} alt="Upload" className="w-full h-full object-contain" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoomedImageId(zoomedImageId === u.id ? null : u.id)
                  }
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary-500 text-background-50 rounded-full p-1.5 text-xs hover:bg-primary-600"
                  title="Zoom"
                >
                  <i className="ri-zoom-in-line" />
                </button>

                {zoomedImageId === u.id && (
                  <div className="absolute top-0 right-0 z-50 bg-background-50 rounded-lg border border-background-200 shadow-lg p-4 min-w-[200px]">
                    <img
                      src={u.src}
                      alt="Zoomed preview"
                      className="w-full h-48 object-contain rounded mb-2"
                    />
                    <button
                      type="button"
                      onClick={() => setZoomedImageId(null)}
                      className="w-full text-xs font-semibold text-foreground-600 hover:text-foreground-900"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
