/**
 * Always visible above the canvas, regardless of which tool tab is
 * active — the single biggest usability fix over v1, where seeing or
 * managing your layers meant tabbing away from whatever you were doing
 * (adding text, uploading art) to a separate "Layers" destination and
 * losing your place. Now you can always see what's on your design and
 * select/remove it in one click without leaving the tool you're using.
 */
export default function LayerStrip({ layers, view, selectedId, onSelect, onRemove }) {
  const viewLayers = layers.filter((l) => l.view === view);
  const typeIcon = { text: "ri-font-size", clipart: "ri-shapes-line", logo: "ri-image-line" };

  if (viewLayers.length === 0) {
    return (
      <div className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background-100/60 border border-dashed border-background-300 text-xs text-foreground-500 font-label">
        <i className="ri-cursor-line" />
        Nothing on this side yet — add text, artwork, or clipart from the left to get started.
      </div>
    );
  }

  return (
    <div className="w-full flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400 flex-shrink-0">
        On this side
      </span>
      {viewLayers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          onClick={() => onSelect(layer.id)}
          className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer whitespace-nowrap transition-colors flex-shrink-0 ${
            selectedId === layer.id
              ? "bg-primary-500 text-background-50 border-primary-500"
              : "bg-background-50 text-foreground-700 border-background-200/70 hover:border-primary-300"
          }`}
        >
          <i className={`${typeIcon[layer.type] || "ri-image-line"} text-xs`} />
          <span className="max-w-[80px] truncate">
            {layer.type === "text" ? layer.text || "Text" : layer.type === "clipart" ? "Icon" : "Artwork"}
          </span>
          <span
            role="button"
            tabIndex={-1}
            aria-label="Remove layer"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(layer.id);
            }}
            className={`w-4 h-4 flex items-center justify-center rounded-full cursor-pointer ${
              selectedId === layer.id
                ? "hover:bg-background-50/25"
                : "hover:bg-accent-100 hover:text-accent-600"
            }`}
          >
            <i className="ri-close-line text-[11px]" />
          </span>
        </button>
      ))}
    </div>
  );
}
