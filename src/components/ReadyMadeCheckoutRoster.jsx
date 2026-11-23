import { useMemo, useState } from "react";
import Button from "./ui/Button";
import { Input, Select } from "./ui/FormField";

const sizes = ["Youth S", "Youth M", "Youth L", "XS", "S", "M", "L", "XL", "2XL", "3XL"];

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

export default function ReadyMadeCheckoutRoster({ items, roster, setRoster, onContinue }) {
  const readyMadeItems = useMemo(() => items.filter((item) => item.readyMade), [items]);
  const [entry, setEntry] = useState(() => emptyEntry(readyMadeItems[0]?.key));
  const [attempted, setAttempted] = useState(false);
  const status = readyMadeRosterStatus(items, roster);

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
    if (status.valid) onContinue();
  };

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
        <Input aria-label="Player name" placeholder="Player name *" value={entry.name} error={attempted && !entry.name.trim()} onChange={(event) => setEntry((current) => ({ ...current, name: event.target.value }))} />
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

      {attempted && !status.valid && <p role="alert" className="mt-3 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-900">Complete every design quantity shown above before continuing.</p>}
      <Button type="button" variant="primary" size="lg" className="mt-5 w-full" onClick={continueToReview}>Continue to Review &amp; Checkout</Button>
    </section>
  );
}
