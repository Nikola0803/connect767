import { useMemo, useState } from "react";
import { sports } from "../../data/uniforms";
import { TEMPLATE_MODES } from "../../data/uniformTemplates";

const ALL = "all";

function TemplateCard({ template, onCustomize }) {
  const [view, setView] = useState("front");
  const image = view === "back" && template.backAsset ? template.backAsset : template.frontAsset;
  const editable = template.templateMode === TEMPLATE_MODES.EDITABLE;
  return (
    <article className="group overflow-hidden rounded-2xl border border-background-300 bg-white shadow-[0_12px_34px_rgba(44,35,24,.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(44,35,24,.12)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f4f1e9]">
        <img src={image} alt={`${template.name} ${view} preview`} className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.02]" />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] ${editable ? "bg-primary-700 text-white" : "bg-[#171914] text-white"}`}>
          {editable ? "Editable" : "AI Preview"}
        </span>
        {template.featured && <span className="absolute right-3 top-3 rounded-full bg-accent-500 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-white">Featured</span>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-heading text-lg font-semibold">{template.name}</h3><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.12em] text-primary-700">{template.garmentType}</p></div>
          <div className="inline-flex rounded-lg border border-background-300 bg-background-50 p-0.5" aria-label={`${template.name} views`}>
            {template.availableViews.map((availableView) => <button key={availableView} type="button" aria-pressed={view === availableView} onClick={() => setView(availableView)} className={`rounded-md px-2 py-1 text-[9px] font-bold capitalize ${view === availableView ? "bg-primary-700 text-white" : "text-foreground-600"}`}>{availableView}</button>)}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-relaxed text-foreground-600">{template.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{template.variations.map((item) => <span key={item} className="rounded-full bg-background-100 px-2 py-1 text-[9px] text-foreground-600">{item}</span>)}</div>
        <button type="button" onClick={() => onCustomize(template)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 text-xs font-bold text-white transition hover:bg-primary-600">Customize Design <i className="ri-arrow-right-line" /></button>
      </div>
    </article>
  );
}

export default function ReadyMadeGallery({ templates, onCustomize, onBack }) {
  const [sport, setSport] = useState(ALL);
  const [style, setStyle] = useState(ALL);
  const [color, setColor] = useState(ALL);
  const [query, setQuery] = useState("");
  const styles = [...new Set(templates.flatMap((template) => template.styleTags))];
  const colors = [...new Set(templates.flatMap((template) => template.supportedColors))];
  const visible = useMemo(() => templates.filter((template) => (
    (sport === ALL || template.sportSlug === sport)
    && (style === ALL || template.styleTags.includes(style))
    && (color === ALL || template.supportedColors.includes(color))
    && `${template.name} ${template.description} ${template.garmentType}`.toLowerCase().includes(query.toLowerCase())
  )), [templates, sport, style, color, query]);
  const featured = visible.filter((template) => template.featured);
  const recent = [...visible].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const configuredSports = sports.filter((item) => templates.some((template) => template.sportSlug === item.slug));
  return (
    <section aria-labelledby="ready-made-title" className="rounded-[26px] border border-background-300 bg-[#fbfaf6] p-4 shadow-[0_18px_50px_rgba(49,38,25,.08)] md:p-6">
      <div className="flex flex-col gap-4 border-b border-background-300 pb-5 md:flex-row md:items-end md:justify-between">
        <div><button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700"><i className="ri-arrow-left-line" /> Studio options</button><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary-700">Connect767 Design Library</p><h1 id="ready-made-title" className="mt-1 font-heading text-3xl font-semibold md:text-4xl">Ready-Made Uniform Designs</h1><p className="mt-2 max-w-2xl text-sm text-foreground-600">Choose a professionally prepared design, then personalize only the elements that template supports.</p></div>
        <label className="relative block w-full md:max-w-sm"><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><span className="sr-only">Search templates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search designs" className="w-full rounded-xl border border-background-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-primary-500" /></label>
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-background-300 bg-white p-3 sm:grid-cols-3">
        <label className="text-[10px] font-bold uppercase tracking-[.12em] text-foreground-500">Sport<select aria-label="Filter by sport" value={sport} onChange={(e) => setSport(e.target.value)} className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2.5 text-xs normal-case text-foreground-900"><option value={ALL}>All sports</option>{configuredSports.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase tracking-[.12em] text-foreground-500">Style<select aria-label="Filter by style" value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2.5 text-xs normal-case text-foreground-900"><option value={ALL}>All styles</option>{styles.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase tracking-[.12em] text-foreground-500">Color<select aria-label="Filter by color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block w-full rounded-lg border border-background-300 bg-background-50 p-2.5 text-xs normal-case text-foreground-900"><option value={ALL}>All colors</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      {featured.length > 0 && <><div className="mt-6 flex items-center justify-between"><h2 className="font-heading text-xl font-semibold">Featured Designs</h2><span className="text-xs text-foreground-500">Editor selected</span></div><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featured.map((template) => <TemplateCard key={`featured-${template.id}`} template={template} onCustomize={onCustomize} />)}</div></>}
      <div className="mt-8 flex items-center justify-between"><h2 className="font-heading text-xl font-semibold">Recently Added</h2><span className="text-xs text-foreground-500">{visible.length} design{visible.length === 1 ? "" : "s"}</span></div>
      {visible.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.map((template) => <TemplateCard key={template.id} template={template} onCustomize={onCustomize} />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-background-300 p-10 text-center text-sm text-foreground-500">No published templates match those filters.</div>}
    </section>
  );
}
