import { useState } from "react";
import { readyMadeArtworkIssue, readReadyMadeArtwork } from "../lib/readyMadeArtwork";

export default function ReadyMadeArtworkFiles({ items, files, setFiles, ready, reading, setReading, storageError }) {
  const [error, setError] = useState("");
  const choose = async (event, kind) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || reading || !ready) return;
    const problem = readyMadeArtworkIssue([...files, ...selected]);
    setError(problem);
    if (problem) return;
    setReading(true);
    try {
      const attachments = await Promise.all(selected.map((file) => readReadyMadeArtwork(file, kind)));
      setFiles((current) => [...current, ...attachments]);
    } catch (failure) { setError(failure.message); }
    finally { setReading(false); }
  };
  const update = (id, field, value) => setFiles((current) => current.map((file) => file.id === id ? { ...file, [field]: value } : file));
  return <section aria-labelledby="ready-made-artwork-title" className="mt-5 rounded-2xl border border-primary-200 bg-white p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-image-add-line text-lg" aria-hidden="true" /></span>
      <div className="min-w-0"><h3 id="ready-made-artwork-title" className="font-heading text-base font-bold text-foreground-950">Team Logos &amp; Sponsors</h3><p className="mt-0.5 text-xs leading-relaxed text-foreground-600">Optional artwork for your uniforms. Add placement notes below each file.</p></div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {[["team", "Add team logos"], ["sponsor", "Add sponsor files"]].map(([kind, label]) => <label key={kind} className={`relative flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-primary-300 bg-primary-50/50 px-3 py-2 text-xs font-bold text-primary-800 ${reading || !ready ? "opacity-50" : "cursor-pointer hover:bg-primary-50"}`}>
        <i className="ri-add-line text-base" aria-hidden="true" />{label}
        <input aria-label={label} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" disabled={reading || !ready} onChange={(event) => choose(event, kind)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>)}
    </div>
    <p className="mt-2 text-[10px] leading-relaxed text-foreground-500">PNG, JPG, WebP or PDF · up to 10 files · 2 MB each · 3 MB combined.</p>
    {(!ready || reading) && <p role="status" className="mt-2 text-xs text-primary-800">{reading ? "Attaching artwork…" : "Loading attached artwork…"}</p>}
    {(error || storageError) && <p role="alert" className="mt-2 text-xs text-accent-800">{error || storageError}</p>}
    {files.length > 0 && <ul className="mt-3 space-y-3">
      {files.map((file) => <li key={file.id} className="min-w-0 rounded-xl border border-background-200 bg-background-50/60 p-3">
        <div className="flex items-center gap-3">
          {file.type.startsWith("image/") ? <img src={file.src} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-background-200 bg-white object-contain" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-primary-700"><i className="ri-file-pdf-2-line text-xl" aria-hidden="true" /></span>}
          <span className="min-w-0 flex-1"><span className="block text-[9px] font-bold uppercase tracking-wider text-primary-700">{file.kind === "sponsor" ? "Sponsor file" : "Team logo"}</span><strong className="mt-0.5 block break-all text-xs font-semibold text-foreground-900">{file.name}</strong></span>
          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((entry) => entry.id !== file.id))} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-500 hover:bg-red-50 hover:text-red-700"><i className="ri-delete-bin-line" aria-hidden="true" /></button>
        </div>
        {(items.length > 1 || file.productSlug) && <label className="mt-3 block text-[11px] font-semibold text-foreground-700">Applies to<select aria-label={`Design for ${file.name}`} value={file.productSlug || ""} onChange={(event) => update(file.id, "productSlug", event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-background-300 bg-white px-2 text-xs"><option value="">All designs in this order</option>{file.productSlug && !items.some((item) => item.slug === file.productSlug) && <option value={file.productSlug} disabled>Choose a current design</option>}{items.map((item) => <option key={item.key} value={item.slug}>{item.title}</option>)}</select></label>}
        <label className="mt-3 block text-[11px] font-semibold text-foreground-700">Placement notes <span className="font-normal text-foreground-500">(optional)</span><input aria-label={`Placement notes for ${file.name}`} value={file.notes || ""} maxLength={500} onChange={(event) => update(file.id, "notes", event.target.value)} placeholder="e.g. Team crest on left chest; sponsor on back" className="mt-1 block min-h-10 w-full rounded-lg border border-background-300 bg-white px-3 text-xs font-normal text-foreground-900" /></label>
      </li>)}
    </ul>}
  </section>;
}
