import { useEffect, useMemo, useState } from "react";
import Button from "./ui/Button";
import { Input, Select } from "./ui/FormField";
import CollarAttachment from "./uniform-studio/CollarAttachment";
import ReadyMadeArtworkFiles from "./ReadyMadeArtworkFiles";
import { readyMadeArtworkIssue } from "../lib/readyMadeArtwork";

const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const fitTypes = ["Men", "Women", "Youth"];
const sockCategories = new Set(["soccer", "goalkeeper"]);
export const SUPPORTER_JERSEY_PRICE = 15;
export const EXTRA_SOCK_PRICE = 5;
export const POLO_COLLAR_PRICE = 2;
export const LONG_SLEEVE_PRICE = 2;
export const EMBROIDERED_LOGO_PRICE = 1.5;
export const INSIDE_COLLAR_PRICE = 1;

export function readyMadeExtrasStatus(items = [], extras = {}, roster = []) {
  const kitQuantity = items
    .filter((item) => item.readyMade)
    .reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)), 0);
  const requiredSocks = items
    .filter((item) => item.readyMade && sockCategories.has(String(item.uniformCategory || "").toLowerCase()))
    .reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)), 0);
  const socksQuantity = requiredSocks
    ? Math.max(0, Math.floor(Number(extras.socksQuantity) || 0))
    : 0;
  const supporterJerseys = extras.supporterEnabled
    ? (Array.isArray(extras.supporterJerseys) ? extras.supporterJerseys : [])
        .map((row) => ({
          size: sizes.includes(String(row.size || "")) ? String(row.size) : "M",
          sleeve: extras.mixedSleeves && row.sleeve === "Long" ? "Long" : "Short",
          quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
        }))
        .filter((row) => row.quantity > 0)
    : [];
  const supporterQuantity = supporterJerseys.reduce((sum, row) => sum + row.quantity, 0);
  const extraSocks = Math.max(0, socksQuantity - requiredSocks);
  const rosterLongSleeveQuantity = extras.mixedSleeves
    ? roster.reduce((sum, row) => sum + (row.sleeve === "Long" ? Math.max(0, Math.floor(Number(row.quantity) || 0)) : 0), 0)
    : 0;
  const supporterLongSleeveQuantity = extras.mixedSleeves
    ? supporterJerseys.reduce((sum, row) => sum + (row.sleeve === "Long" ? row.quantity : 0), 0)
    : 0;
  const longSleeveQuantity = rosterLongSleeveQuantity + supporterLongSleeveQuantity;
  const insideCollarEnabled = Boolean(extras.insideCollarEnabled);
  const fitValid = fitTypes.includes(extras.fitType);
  const insideCollarValid = !insideCollarEnabled || Boolean(
    String(extras.insideCollarMessage || "").trim() || extras.insideCollarAttachment?.src,
  );
  const poloCollarTotal = extras.poloCollar ? kitQuantity * POLO_COLLAR_PRICE : 0;
  const longSleeveTotal = longSleeveQuantity * LONG_SLEEVE_PRICE;
  const embroideryTotal = extras.embroideredLogo ? kitQuantity * EMBROIDERED_LOGO_PRICE : 0;
  const insideCollarTotal = insideCollarEnabled ? kitQuantity * INSIDE_COLLAR_PRICE : 0;
  return {
    kitQuantity,
    fitValid,
    requiredSocks,
    socksQuantity,
    extraSocks,
    socksValid: requiredSocks === 0 || socksQuantity >= requiredSocks,
    supporterJerseys,
    supporterQuantity,
    supporterTotal: supporterQuantity * SUPPORTER_JERSEY_PRICE,
    extraSocksTotal: extraSocks * EXTRA_SOCK_PRICE,
    longSleeveQuantity,
    rosterLongSleeveQuantity,
    supporterLongSleeveQuantity,
    insideCollarValid,
    poloCollarTotal,
    longSleeveTotal,
    embroideryTotal,
    insideCollarTotal,
    productionTotal: poloCollarTotal + longSleeveTotal + embroideryTotal + insideCollarTotal,
  };
}

export function readyMadeRosterStatus(items = [], roster = []) {
  const readyMadeItems = items.filter((item) => item.readyMade);
  const requirements = readyMadeItems.map((item) => {
    const required = Math.max(1, Math.floor(Number(item.qty) || 1));
    const assigned = roster
      .filter((row) => row.productKey === item.key)
      .reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)), 0);
    return { key: item.key, title: item.title, required, assigned, valid: assigned === required };
  });
  return { requirements, valid: requirements.length === 0 || requirements.every((item) => item.valid) };
}

const emptyEntry = (productKey = "") => ({
  productKey,
  name: "",
  number: "",
  shirtSize: "M",
  bottomSize: "M",
  sleeve: "Short",
  quantity: 1,
  notes: "",
});

export default function ReadyMadeCheckoutRoster({ items, roster, setRoster, extras, setExtras, artwork = [], setArtwork, artworkReady = true, artworkStorageError = "", onContinue }) {
  const readyMadeItems = useMemo(() => items.filter((item) => item.readyMade), [items]);
  const [entry, setEntry] = useState(() => emptyEntry(readyMadeItems[0]?.key));
  const [attempted, setAttempted] = useState(false);
  const [artworkReading, setArtworkReading] = useState(false);
  const status = readyMadeRosterStatus(items, roster);
  const extrasStatus = readyMadeExtrasStatus(items, extras, roster);
  const artworkError = readyMadeArtworkIssue(artwork, readyMadeItems);

  useEffect(() => {
    if (!extrasStatus.requiredSocks || extrasStatus.socksQuantity >= extrasStatus.requiredSocks) return;
    setExtras((current) => ({ ...current, socksQuantity: extrasStatus.requiredSocks }));
  }, [extrasStatus.requiredSocks, extrasStatus.socksQuantity, setExtras]);

  const addPlayer = () => {
    setAttempted(true);
    if (!entry.productKey || !entry.name.trim() || Number(entry.quantity) < 1) return;
    const requirement = status.requirements.find((item) => item.key === entry.productKey);
    const remaining = Math.max(0, (requirement?.required || 0) - (requirement?.assigned || 0));
    if (!remaining) return;
    const quantity = Math.min(remaining, Math.max(1, Math.floor(Number(entry.quantity) || 1)));
    const selectedProduct = readyMadeItems.find((item) => item.key === entry.productKey);
    setRoster((current) => [...current, { ...entry, productSlug: selectedProduct?.slug || "", productTitle: selectedProduct?.title || "", id: crypto.randomUUID?.() || `${Date.now()}-${current.length}`, quantity }]);
    setEntry((current) => ({ ...emptyEntry(current.productKey), shirtSize: current.shirtSize, bottomSize: current.bottomSize }));
    setAttempted(false);
  };

  const continueToReview = () => {
    setAttempted(true);
    if (status.valid && extrasStatus.fitValid && extrasStatus.socksValid && extrasStatus.insideCollarValid && artworkReady && !artworkReading && !artworkError) onContinue();
  };

  const updateSupporterRow = (index, field, value) => setExtras((current) => ({
    ...current,
    supporterJerseys: (current.supporterJerseys || []).map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
  }));

  return (
    <section aria-labelledby="ready-made-roster-title" className="rounded-2xl border border-background-200 bg-background-50 p-5 shadow-sm">
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Step 2</p>
      <h2 id="ready-made-roster-title" className="mt-1 font-heading text-2xl font-semibold text-foreground-950">Team Roster</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground-600">Add names, numbers and sizes for every ready-made uniform in the cart. Quantities must match before review.</p>

      <div className="mt-5 space-y-2">
        {status.requirements.map((requirement) => (
          <div key={requirement.key} role="status" className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${requirement.valid ? "border-primary-200 bg-primary-50" : attempted ? "border-accent-400 bg-accent-50 ring-2 ring-accent-100" : "border-background-200 bg-background-100/60"}`}>
            <span className="font-semibold text-foreground-900">{requirement.title}</span>
            <span className={requirement.valid ? "font-bold text-primary-700" : "font-semibold text-foreground-600"}>{requirement.assigned} / {requirement.required}</span>
          </div>
        ))}
      </div>

      <div className={`mt-5 rounded-2xl border bg-white p-4 ${attempted && !extrasStatus.fitValid ? "border-accent-400 ring-2 ring-accent-100" : "border-background-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground-900">Fit Type <span className="rounded-full bg-accent-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-accent-700">Required</span></span>
          <div role="group" aria-label="Fit type (required)" className="flex flex-wrap gap-2">
            {fitTypes.map((fitType) => <button key={fitType} type="button" aria-pressed={extras.fitType === fitType} onClick={() => setExtras((current) => ({ ...current, fitType }))} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${extras.fitType === fitType ? "border-primary-600 bg-primary-600 text-white" : "border-background-300 bg-background-50 text-foreground-800"}`}>{fitType}</button>)}
          </div>
        </div>
        {attempted && !extrasStatus.fitValid && <p role="alert" className="mt-2 text-xs font-semibold text-accent-800">Select a fit type before continuing.</p>}
      </div>

      <section aria-labelledby="ready-made-production-extras" className="mt-5 overflow-hidden rounded-2xl border-2 border-primary-500 bg-white">
        <header className="flex items-center justify-between gap-3 bg-primary-700 px-4 py-3 text-white">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"><i className="ri-settings-4-line" aria-hidden="true" /></span>
            <span><h3 id="ready-made-production-extras" className="font-heading text-base font-bold leading-tight">Production Extras</h3><span className="block text-[10px] text-white/75">Collar, sleeve and logo customization</span></span>
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide">Sublimation</span>
        </header>
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 font-heading text-xs font-bold uppercase tracking-wide text-foreground-500">Collar &amp; Sleeves</p>
            <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-3 text-sm ${extras.poloCollar ? "border-primary-500 bg-primary-50" : "border-background-300 bg-background-50"}`}>
              <span className="font-semibold text-foreground-900">Polo Style Collar <span className="font-normal text-foreground-600">(+${POLO_COLLAR_PRICE.toFixed(2)}/kit)</span></span>
              <input type="checkbox" aria-label="Polo Style Collar" className="h-4 w-4 accent-primary-700" checked={Boolean(extras.poloCollar)} onChange={(event) => setExtras((current) => ({ ...current, poloCollar: event.target.checked }))} />
            </label>
            <p className="mt-2 text-xs text-foreground-600">Crew, V-Neck and short sleeves included in base price.</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-semibold text-foreground-900">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-700" checked={Boolean(extras.mixedSleeves)} onChange={(event) => { const checked = event.target.checked; setExtras((current) => ({ ...current, mixedSleeves: checked, supporterJerseys: !checked ? (current.supporterJerseys || []).map((row) => ({ ...row, sleeve: "Short" })) : current.supporterJerseys })); if (!checked) { setRoster((current) => current.map((row) => ({ ...row, sleeve: "Short" }))); setEntry((current) => ({ ...current, sleeve: "Short" })); } }} />
              <span>Mixed Sleeve Team Order<span className="mt-0.5 block text-xs font-normal text-foreground-500">Choose each player and supporter jersey sleeve. Long sleeves +${LONG_SLEEVE_PRICE.toFixed(2)}/kit.</span></span>
            </label>
          </div>
          <div className="border-t border-background-200 pt-4">
            <p className="mb-2 text-xs text-foreground-600">All prints and logos are sublimated and included.</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-foreground-900">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary-700" checked={Boolean(extras.embroideredLogo)} onChange={(event) => setExtras((current) => ({ ...current, embroideredLogo: event.target.checked }))} />
              <span>Embroidered Team Logo <span className="font-normal text-foreground-600">(+${EMBROIDERED_LOGO_PRICE.toFixed(2)}/kit)</span></span>
            </label>
            <div className="mt-4">
              <span className="block text-sm font-semibold text-foreground-900">Inside-Collar Logo or Message <span className="font-normal text-foreground-600">(+${INSIDE_COLLAR_PRICE.toFixed(2)}/kit)</span></span>
              <div className="mt-2 flex gap-2">
                {[false, true].map((enabled) => <button key={String(enabled)} type="button" onClick={() => setExtras((current) => ({ ...current, insideCollarEnabled: enabled, ...(!enabled ? { insideCollarMessage: "", insideCollarAttachment: null } : {}) }))} className={`rounded-lg border px-3 py-2 text-xs font-bold ${Boolean(extras.insideCollarEnabled) === enabled ? "border-primary-600 bg-primary-600 text-white" : "border-background-300 bg-background-50 text-foreground-800"}`}>{enabled ? "Yes" : "No"}</button>)}
              </div>
              {extras.insideCollarEnabled && <div className="mt-3">
                <label className="block text-xs font-semibold text-foreground-800">Inside-Collar Message <span className="text-red-600">*</span><Input className="mt-1.5" aria-label="Inside-collar message" placeholder="Message for the inside collar" value={extras.insideCollarMessage || ""} onChange={(event) => setExtras((current) => ({ ...current, insideCollarMessage: event.target.value }))} /></label>
                <CollarAttachment attachment={extras.insideCollarAttachment || null} onChange={(attachment) => setExtras((current) => ({ ...current, insideCollarAttachment: attachment }))} />
                {attempted && !extrasStatus.insideCollarValid && <p role="alert" className="mt-2 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-900">Enter an inside-collar message or attach a logo/artwork file.</p>}
              </div>}
            </div>
          </div>
        </div>
      </section>

      <ReadyMadeArtworkFiles items={readyMadeItems} files={artwork} setFiles={setArtwork} ready={artworkReady} reading={artworkReading} setReading={setArtworkReading} storageError={artworkStorageError} />
      {artworkError && <p role="alert" className="mt-2 text-xs font-semibold text-accent-800">{artworkError}</p>}

      <div className="mt-5 grid gap-3 rounded-xl border border-background-200 bg-white p-4 sm:grid-cols-2">
        {readyMadeItems.length > 1 && (
          <label className="sm:col-span-2 text-xs font-semibold text-foreground-700">Design
            <Select className="mt-1" value={entry.productKey} onChange={(event) => setEntry((current) => ({ ...current, productKey: event.target.value }))}>
              {readyMadeItems.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
            </Select>
          </label>
        )}
        <Input aria-label="Player or team name" placeholder="Player or Team Name *" value={entry.name} error={attempted && !entry.name.trim()} onChange={(event) => setEntry((current) => ({ ...current, name: event.target.value }))} />
        <Input aria-label="Jersey number" placeholder="Jersey number" value={entry.number} onChange={(event) => setEntry((current) => ({ ...current, number: event.target.value }))} />
        <label className="text-xs font-semibold text-foreground-700">Top Size
          <Select className="mt-1" value={entry.shirtSize} onChange={(event) => setEntry((current) => ({ ...current, shirtSize: event.target.value }))}>{sizes.map((size) => <option key={size}>{size}</option>)}</Select>
        </label>
        <label className="text-xs font-semibold text-foreground-700">Bottom Size
          <Select className="mt-1" value={entry.bottomSize} onChange={(event) => setEntry((current) => ({ ...current, bottomSize: event.target.value }))}>{sizes.map((size) => <option key={size}>{size}</option>)}</Select>
        </label>
        {extras.mixedSleeves && <label className="text-xs font-semibold text-foreground-700">Sleeve
          <Select className="mt-1" value={entry.sleeve} onChange={(event) => setEntry((current) => ({ ...current, sleeve: event.target.value }))}><option>Short</option><option>Long</option></Select>
        </label>}
        <label className="text-xs font-semibold text-foreground-700">Quantity
          <Input className="mt-1" type="number" min="1" max="99" value={entry.quantity} onChange={(event) => setEntry((current) => ({ ...current, quantity: event.target.value }))} />
        </label>
        <Input className="sm:col-span-2" aria-label="Player notes" placeholder="Player notes (optional)" value={entry.notes} onChange={(event) => setEntry((current) => ({ ...current, notes: event.target.value }))} />
        <Button type="button" variant="secondary" className="sm:col-span-2" onClick={addPlayer} icon="ri-add-line">Add Player</Button>
      </div>

      {roster.length > 0 && (
        <div className="mt-4 space-y-2">
          {roster.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-background-200 bg-background-100/40 px-3 py-2 text-xs">
              <div className="min-w-0 flex-1"><strong className="text-foreground-900">{row.name}</strong>{row.number && ` #${row.number}`}<span className="block text-foreground-500">{row.shirtSize} top · {row.bottomSize} bottom · {row.sleeve} sleeve · Qty {row.quantity}</span></div>
              <button type="button" aria-label={`Remove ${row.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-accent-600 hover:bg-accent-50" onClick={() => setRoster((current) => current.filter((item) => item.id !== row.id))}><i className="ri-delete-bin-line" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-background-200 bg-white p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-background-300 text-primary-700" checked={Boolean(extras.supporterEnabled)} onChange={(event) => setExtras((current) => ({ ...current, supporterEnabled: event.target.checked, supporterJerseys: current.supporterJerseys?.length ? current.supporterJerseys : [{ size: "M", sleeve: "Short", quantity: 1 }] }))} />
          <span><strong className="block text-sm text-foreground-900">Add Supporter Jerseys</strong><span className="text-xs text-foreground-500">Same team design without player numbers · ${SUPPORTER_JERSEY_PRICE.toFixed(2)} each</span></span>
        </label>
        {extras.supporterEnabled && (
          <div className="mt-4 space-y-2 border-t border-background-200 pt-4">
            {(extras.supporterJerseys || []).map((row, index) => (
              <div key={`${index}-${row.size}`} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] gap-2">
                <div className={`grid min-w-0 gap-2 ${extras.mixedSleeves ? "grid-cols-2" : "grid-cols-1"}`}>
                  <Select aria-label={`Supporter jersey size ${index + 1}`} value={sizes.includes(row.size) ? row.size : "M"} onChange={(event) => updateSupporterRow(index, "size", event.target.value)}>{sizes.map((size) => <option key={size} disabled={(extras.supporterJerseys || []).some((other, rowIndex) => rowIndex !== index && other.size === size)}>{size}</option>)}</Select>
                  {extras.mixedSleeves && <Select aria-label={`Supporter jersey sleeve ${index + 1}`} value={row.sleeve === "Long" ? "Long" : "Short"} onChange={(event) => updateSupporterRow(index, "sleeve", event.target.value)}><option>Short</option><option>Long</option></Select>}
                </div>
                <Input aria-label={`Supporter jersey quantity ${index + 1}`} type="number" min="1" max="99" value={row.quantity} onChange={(event) => updateSupporterRow(index, "quantity", event.target.value)} />
                <button type="button" aria-label={`Remove supporter jersey size ${row.size}`} className="rounded-lg text-accent-600 hover:bg-accent-50" onClick={() => setExtras((current) => { const supporterJerseys = (current.supporterJerseys || []).filter((_, rowIndex) => rowIndex !== index); return { ...current, supporterEnabled: supporterJerseys.length > 0, supporterJerseys }; })}><i className="ri-delete-bin-line" /></button>
              </div>
            ))}
            {(extras.supporterJerseys || []).length < sizes.length && <button type="button" className="text-xs font-bold text-primary-700" onClick={() => setExtras((current) => { const nextSize = sizes.find((size) => !(current.supporterJerseys || []).some((row) => row.size === size)); return { ...current, supporterJerseys: [...(current.supporterJerseys || []), { size: nextSize || "M", sleeve: "Short", quantity: 1 }] }; })}>+ Add Another Size</button>}
            <div className="flex justify-between border-t border-background-200 pt-3 text-sm font-semibold"><span>{extrasStatus.supporterQuantity} Supporter Jersey{extrasStatus.supporterQuantity === 1 ? "" : "s"}</span><span>${extrasStatus.supporterTotal.toFixed(2)}</span></div>
            {extrasStatus.supporterLongSleeveQuantity > 0 && <div className="flex justify-between text-xs font-semibold text-foreground-600"><span>{extrasStatus.supporterLongSleeveQuantity} Long-Sleeve Upgrade{extrasStatus.supporterLongSleeveQuantity === 1 ? "" : "s"}</span><span>+${(extrasStatus.supporterLongSleeveQuantity * LONG_SLEEVE_PRICE).toFixed(2)}</span></div>}
          </div>
        )}
      </div>

      {extrasStatus.requiredSocks > 0 && (
        <div className={`mt-4 rounded-2xl border p-4 ${attempted && !extrasStatus.socksValid ? "border-accent-400 bg-accent-50" : "border-background-200 bg-white"}`}>
          <div className="flex items-center justify-between gap-4">
            <span><strong className="block text-sm text-foreground-900">Socks</strong><span className="text-xs text-foreground-500">{extrasStatus.requiredSocks} included with the full-uniform order. Additional pairs are ${EXTRA_SOCK_PRICE.toFixed(2)} each.</span></span>
            <label className="w-24 text-xs font-semibold text-foreground-700">Quantity<Input className="mt-1" aria-label="Sock quantity" type="number" min={extrasStatus.requiredSocks} max="999" value={extrasStatus.socksQuantity} onChange={(event) => setExtras((current) => ({ ...current, socksQuantity: event.target.value }))} /></label>
          </div>
          {extrasStatus.extraSocks > 0 && <div className="mt-3 flex justify-between border-t border-background-200 pt-3 text-sm font-semibold"><span>{extrasStatus.extraSocks} Extra Pair{extrasStatus.extraSocks === 1 ? "" : "s"} × ${EXTRA_SOCK_PRICE.toFixed(2)}</span><span>${extrasStatus.extraSocksTotal.toFixed(2)}</span></div>}
          {attempted && !extrasStatus.socksValid && <p role="alert" className="mt-2 text-xs font-semibold text-accent-800">Sock quantity must be at least {extrasStatus.requiredSocks}.</p>}
        </div>
      )}

      {attempted && (!status.valid || !extrasStatus.fitValid || !extrasStatus.socksValid || !extrasStatus.insideCollarValid) && <p role="alert" className="mt-3 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-900">Complete the required fit, roster, production options and sock quantity shown above before continuing.</p>}
      <Button type="button" variant="primary" size="lg" className="mt-5 w-full" disabled={!artworkReady || artworkReading} onClick={continueToReview}>Continue to Review &amp; Checkout</Button>
    </section>
  );
}
