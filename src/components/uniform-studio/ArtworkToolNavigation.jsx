function ArtworkToolIcon({ tool }) {
  if (tool.key === "ai") {
    return (
      <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
        <i className="ri-sparkling-2-fill text-sm" />
      </span>
    );
  }

  return <i className={`${tool.icon} text-sm`} aria-hidden="true" />;
}

/**
 * Presents every tool in the combined Step 1 Design workspace. The
 * caller passes its capability-filtered tools so unavailable editing actions
 * never appear for preview-only or unsupported garment surfaces.
 */
export default function ArtworkToolNavigation({ tools, activeTool, onSelect }) {
  const active = tools.find((tool) => tool.key === activeTool) || tools[0];

  return (
    <div className="flex-shrink-0 border-b border-black/[0.07] bg-[#f7f5ef]/95 px-3 pb-2.5 pt-2 backdrop-blur-xl">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary-700">
        Step 1 · Design
      </p>
      <nav className="mt-2 grid grid-cols-4 gap-1" aria-label="Design tools">
        {tools.map((tool) => {
          const selected = tool.key === activeTool;
          return (
            <button
              key={tool.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(tool.key)}
              className={`flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition ${
                selected
                  ? "border-primary-700 bg-primary-700 text-white shadow-[0_7px_18px_rgba(0,117,76,0.16)]"
                  : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
              }`}
            >
              <ArtworkToolIcon tool={tool} />
              <span className="text-[8px] font-bold leading-none">{tool.label}</span>
            </button>
          );
        })}
      </nav>
      {active && (
        <div className="mt-2">
          <h2 className="font-heading text-base font-medium text-foreground-950">{active.label}</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground-500">{active.hint}</p>
        </div>
      )}
    </div>
  );
}
