import { useMemo, useState } from "react";
import { bookingRateForDate, normalizeBookingRateRules, ruleDates, toDateKey } from "../../lib/bookingRates";
import BookingPriceCalendar from "./BookingPriceCalendar";
import { FormField, Input, Select } from "../ui/FormField";

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function BookingRateEditor({ basePriceCents, rules, onChange, rateLabel = "rate" }) {
  const normalized = useMemo(() => normalizeBookingRateRules(rules), [rules]);
  const today = toDateKey(new Date());
  const [draft, setDraft] = useState({ period: "day", anchor: today, seasonEnd: today, price: "" });

  const addRule = () => {
    const price = Number(draft.price);
    const { startDate, endDate } = ruleDates(draft.period, draft.anchor, draft.seasonEnd);
    if (!startDate || !endDate || endDate < startDate || !Number.isFinite(price) || price < 0) return;
    onChange([
      ...normalized,
      {
        id: `rate-${Date.now()}`,
        label: `${draft.period[0].toUpperCase()}${draft.period.slice(1)} rate`,
        period: draft.period,
        startDate,
        endDate,
        priceCents: Math.round(price * 100),
      },
    ]);
    setDraft((current) => ({ ...current, price: "" }));
  };

  return (
    <section className="sm:col-span-2 rounded-2xl border border-primary-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary-700 font-bold">Smart rate calendar</p>
          <h3 className="font-heading text-lg font-semibold text-foreground-950">Set prices by day, week, month or season</h3>
          <p className="text-xs text-foreground-600 font-label mt-1">Special rates override your base {rateLabel}. Visitors see the exact price on each date.</p>
        </div>
        <span className="rounded-full bg-primary-50 border border-primary-100 px-3 py-1 text-xs font-semibold text-primary-800 whitespace-nowrap">Base {money(basePriceCents)}</span>
      </div>
      <BookingPriceCalendar basePriceCents={basePriceCents} rules={normalized} minimumDate={today} unitLabel={rateLabel.replace(/ rate$/, "")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 rounded-xl bg-background-100/70 p-4">
        <FormField label="Rate period" htmlFor="rate-period">
          <Select id="rate-period" value={draft.period} onChange={(event) => setDraft((current) => ({ ...current, period: event.target.value }))}>
            <option value="day">Specific day</option>
            <option value="week">Full week</option>
            <option value="month">Full month</option>
            <option value="season">Season / date range</option>
          </Select>
        </FormField>
        <FormField label={draft.period === "month" ? "Month" : draft.period === "season" ? "Season starts" : draft.period === "week" ? "Week starts" : "Date"} htmlFor="rate-anchor">
          <Input id="rate-anchor" type={draft.period === "month" ? "month" : "date"} min={draft.period === "month" ? today.slice(0, 7) : today} value={draft.period === "month" ? draft.anchor.slice(0, 7) : draft.anchor} onChange={(event) => setDraft((current) => ({ ...current, anchor: draft.period === "month" ? `${event.target.value}-01` : event.target.value }))} />
        </FormField>
        {draft.period === "season" && <FormField label="Season ends" htmlFor="rate-season-end">
          <Input id="rate-season-end" type="date" min={draft.anchor} value={draft.seasonEnd} onChange={(event) => setDraft((current) => ({ ...current, seasonEnd: event.target.value }))} />
        </FormField>}
        <FormField label="Price (USD)" htmlFor="special-rate-price">
          <Input id="special-rate-price" type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} placeholder="125.00" />
        </FormField>
        <div className="flex items-end">
          <button type="button" onClick={addRule} className="w-full min-h-[46px] rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800">
            <i className="ri-add-line mr-1" /> Add rate
          </button>
        </div>
      </div>
      {normalized.length > 0 && (
        <div className="mt-4 space-y-2">
          {normalized.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-background-200 px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground-900">{rule.label} · {money(rule.priceCents)}</p>
                <p className="text-xs text-foreground-500 font-label">{rule.startDate}{rule.endDate !== rule.startDate ? ` to ${rule.endDate}` : ""}</p>
              </div>
              <button type="button" className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent-700 hover:bg-accent-50" onClick={() => onChange(normalized.filter((item) => item.id !== rule.id))}>
                <i className="ri-delete-bin-line mr-1" /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
