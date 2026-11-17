const toolLabels = {
  design: "Colour",
  zones: "Zone correction",
  text: "Text",
  logo: "Logo",
  skins: "Pattern",
  layers: "Layers",
};

export default function GarmentCapabilitySummary({ capabilities, compact = false }) {
  const enabled = Object.keys(toolLabels).filter((key) => capabilities.canUse(key));

  return (
    <section className={`border border-primary-200 bg-primary-50/75 ${compact ? "rounded-xl px-3 py-2" : "rounded-2xl p-3"}`} aria-label="Detected garment capabilities">
      <div className="flex items-start gap-2.5">
        <span className={`flex shrink-0 items-center justify-center rounded-lg ${capabilities.previewOnly ? "bg-amber-100 text-amber-700" : "bg-primary-600 text-white"} ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
          <i className={capabilities.previewOnly ? "ri-eye-line" : "ri-scan-2-line"} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary-700">Detected garment</p>
          <p className="truncate text-sm font-semibold text-foreground-950">{capabilities.garment}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-600">{capabilities.status}</p>
        </div>
      </div>
      {!capabilities.previewOnly && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Verified editing tools">
            {enabled.map((key) => (
              <span key={key} className="rounded-full border border-primary-200 bg-background-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-primary-800">
                {toolLabels[key]}
              </span>
            ))}
          </div>
          {!compact && (
            <p className="mt-2 text-[10px] text-foreground-500">
              {capabilities.zones.map((item) => item.label).join(" · ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}

