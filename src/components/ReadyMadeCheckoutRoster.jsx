import { useEffect, useMemo, useState } from "react";
import Button from "./ui/Button";
import { Input, Select } from "./ui/FormField";

const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const sockCategories = new Set(["soccer", "goalkeeper"]);
export const SUPPORTER_JERSEY_PRICE = 15;
export const EXTRA_SOCK_PRICE = 5;

export function readyMadeExtrasStatus(items = [], extras = {}) {
  const requiredSocks = items
    .filter((item) => item.readyMade && sockCategories.has(String(item.uniformCategory || "").toLowerCase()))
    .reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.qty) || 0)), 0);
  const socksQuantity = requiredSocks
    ? Math.max(0, Math.floor(Number(extras.socksQuantity) || 0))
    : 0;
  const supporterJerseys = extras.supporterEnabled
    ? (Array.isArray(extras.supporterJerseys) ? extras.supporterJerseys : [])
        .map((row) => ({ size: sizes.includes(String(row.size || "")) ? String(row.size) : "M", quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)) }))
        .filter((row) => row.quantity > 0)
    : [];
  const supporterQuantity = supporterJerseys.reduce((sum, row) => sum + row.quantity, 0);
  const extraSocks = Math.max(0, socksQuantity - requiredSocks);
  return {
    requiredSocks,
    socksQuantity,
    extraSocks,
    socksValid: requiredSocks === 0 || socksQuantity >= requiredSocks,
    supporterJerseys,
    supporterQuantity,
    supporterTotal: supporterQuantity * SUPPORTER_JERSEY_PRICE,
    extraSocksTotal: extraSocks * EXTRA_SOCK_PRICE,
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

export default function ReadyMadeCheckoutRoster({ items, roster, setRoster, extras, setExtras, onContinue }) {
  const readyMadeItems = useMemo(() => items.filter((item) => item.readyMade), [items]);
  const [entry, setEntry] = useState(() => emptyEntry(readyMadeItems[0]?.key));
  const [attempted, setAttempted] = useState(false);
  const status = readyMadeRosterStatus(items, roster);
  const extrasStatus = readyMadeExtrasStatus(items, extras);

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
    if (status.valid && extrasStatus.socksValid) onContinue();
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
        <label className="text-xs font-semibold text-foreground-700">Sleeve
          <Select className="mt-1" value={entry.sleeve} onChange={(event) => setEntry((current) => ({ ...current, sleeve: event.target.value }))}><option>Short</option><option>Long</option></Select>
        </label>
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
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-background-300 text-primary-700" checked={Boolean(extras.supporterEnabled)} onChange={(event) => setExtras((current) => ({ ...current, supporterEnabled: event.target.checked, supporterJerseys: current.supporterJerseys?.length ? current.supporterJerseys : [{ size: "M", quantity: 1 }] }))} />
          <span><strong className="block text-sm text-foreground-900">Add Supporter Jerseys</strong><span className="text-xs text-foreground-500">Same team design without player numbers · ${SUPPORTER_JERSEY_PRICE.toFixed(2)} each</span></span>
        </label>
        {extras.supporterEnabled && (
          <div className="mt-4 space-y-2 border-t border-background-200 pt-4">
            {(extras.supporterJerseys || []).map((row, index) => (
              <div key={`${index}-${row.size}`} className="grid grid-cols-[1fr_7rem_2.5rem] gap-2">
                <Select aria-label={`Supporter jersey size ${index + 1}`} value={sizes.includes(row.size) ? row.size : "M"} onChange={(event) => updateSupporterRow(index, "size", event.target.value)}>{sizes.map((size) => <option key={size} disabled={(extras.supporterJerseys || []).some((other, rowIndex) => rowIndex !== index && other.size === size)}>{size}</option>)}</Select>
                <Input aria-label={`Supporter jersey quantity ${index + 1}`} type="number" min="1" max="99" value={row.quantity} onChange={(event) => updateSupporterRow(index, "quantity", event.target.value)} />
                <button type="button" aria-label={`Remove supporter jersey size ${row.size}`} className="rounded-lg text-accent-600 hover:bg-accent-50" onClick={() => setExtras((current) => { const supporterJerseys = (current.supporterJerseys || []).filter((_, rowIndex) => rowIndex !== index); return { ...current, supporterEnabled: supporterJerseys.length > 0, supporterJerseys }; })}><i className="ri-delete-bin-line" /></button>
              </div>
            ))}
            {(extras.supporterJerseys || []).length < sizes.length && <button type="button" className="text-xs font-bold text-primary-700" onClick={() => setExtras((current) => { const nextSize = sizes.find((size) => !(current.supporterJerseys || []).some((row) => row.size === size)); return { ...current, supporterJerseys: [...(current.supporterJerseys || []), { size: nextSize || "M", quantity: 1 }] }; })}>+ Add Another Size</button>}
            <div className="flex justify-between border-t border-background-200 pt-3 text-sm font-semibold"><span>{extrasStatus.supporterQuantity} Supporter Jersey{extrasStatus.supporterQuantity === 1 ? "" : "s"}</span><span>${extrasStatus.supporterTotal.toFixed(2)}</span></div>
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

      {attempted && (!status.valid || !extrasStatus.socksValid) && <p role="alert" className="mt-3 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-900">Complete every required roster and sock quantity shown above before continuing.</p>}
      <Button type="button" variant="primary" size="lg" className="mt-5 w-full" onClick={continueToReview}>Continue to Review &amp; Checkout</Button>
    </section>
  );
}
