import { POSITION_CHOICES, ZOOM_MIN, ZOOM_MAX } from "../../lib/imagePosition";

/**
 * Crop anchor (3x3 grid) + zoom slider for the logo/cover photo uploads in
 * AddListingPage.jsx. Deliberately a closed set (9 anchors, clamped zoom)
 * rather than free-form drag-to-reposition — see src/lib/imagePosition.js
 * and class-rest-listings.php's sanitize_position()/sanitize_zoom() for the
 * matching whitelist this mirrors server-side.
 */
export default function PositionPicker({ position, zoom, onPositionChange, onZoomChange, label }) {
  return (
    <div className="mt-3 flex items-start gap-4">
      <div>
        {label && (
          <p className="text-[11px] font-label text-foreground-500 mb-1.5">{label}</p>
        )}
        <div className="grid grid-cols-3 gap-1 w-[84px]">
          {POSITION_CHOICES.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.title}
              aria-label={p.title}
              onClick={() => onPositionChange(p.value)}
              className={`w-6 h-6 flex items-center justify-center rounded-md border text-xs cursor-pointer transition-colors ${
                position === p.value
                  ? "bg-primary-500 text-background-50 border-primary-500"
                  : "bg-background-50 text-foreground-500 border-background-200/70 hover:border-background-300 hover:bg-background-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-label text-foreground-500">Zoom</span>
          <span className="text-[11px] font-label text-foreground-500">
            {Math.round((zoom || 1) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={zoom || 1}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-full cursor-pointer accent-primary-500"
        />
      </div>
    </div>
  );
}
