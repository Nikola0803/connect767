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

  if (compact) {
    return (
      <section className="rounded-lg border border-primary-200 bg-primary-50/75 px-2.5 py-1.5" aria-label="Detected garment capabilities">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs ${capabilities.previewOnly ? "bg-amber-100 text-amber-700" : "bg-primary-600 text-white"}`}>
            <i className={capabilities.previewOnly ? "ri-eye-line" : "ri-scan-2-line"} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-foreground-950">{capabilities.garment}</p>
            <p className="truncate text-[10px] leading-tight text-foreground-500">
              {capabilities.previewOnly ? capabilities.status : `${capabilities.zones.length} zones · ${enabled.length} tools ready`}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary-200 bg-primary-50/75 p-3" aria-label="Detected garment capabilities">
      <div className="flex items-start gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${capabilities.previewOnly ? "bg-amber-100 text-amber-700" : "bg-primary-600 text-white"}`}>
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
          <p className="mt-2 text-[10px] text-foreground-500">
            {capabilities.zones.map((item) => item.label).join(" · ")}
          </p>
        </>
      )}
    </section>
  );
}

