import { useEffect, useMemo, useState } from "react";
import { normalizeBookingRateRules, ruleDates, toDateKey } from "../../lib/bookingRates";
import BookingPriceCalendar from "./BookingPriceCalendar";
import { FormField, Input, Select } from "../ui/FormField";

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const periodOptions = {
  week: [
    { value: "week", label: "Full week" },
    { value: "month", label: "Full month" },
    { value: "season", label: "Season / date range" },
  ],
  month: [
    { value: "month", label: "Full month" },
    { value: "season", label: "Season / date range" },
  ],
  year: [{ value: "season", label: "Season / date range" }],
  default: [
    { value: "day", label: "Specific day" },
    { value: "week", label: "Full week" },
    { value: "month", label: "Full month" },
    { value: "season", label: "Season / date range" },
  ],
};

export default function BookingRateEditor({ basePriceCents, rules, onChange, onSave, rateLabel = "rate", billingPeriod = "day" }) {
  const incomingRules = useMemo(() => normalizeBookingRateRules(rules), [rules]);
  const [editableRules, setEditableRules] = useState(() => incomingRules);
  const normalized = useMemo(() => normalizeBookingRateRules(editableRules), [editableRules]);
  const today = toDateKey(new Date());
  const availablePeriods = periodOptions[billingPeriod] || periodOptions.default;
  const [isOpen, setIsOpen] = useState(() => normalized.length > 0);
  const [draft, setDraft] = useState({ period: availablePeriods[0].value, anchor: today, seasonEnd: "", price: "" });
  const [warning, setWarning] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditableRules(incomingRules);
  }, [incomingRules]);

  useEffect(() => {
    if (normalized.length > 0) setIsOpen(true);
  }, [normalized.length]);

  useEffect(() => {
    if (!availablePeriods.some((option) => option.value === draft.period)) {
      setDraft((current) => ({ ...current, period: availablePeriods[0].value }));
    }
  }, [availablePeriods, draft.period]);

  const ruleFromDraft = () => {
    const price = Number(draft.price);
    const { startDate, endDate } = ruleDates(draft.period, draft.anchor, draft.seasonEnd);
    if (!startDate) {
      return { error: "Choose the start date before adding this rate." };
    }
    if (draft.period === "season" && !draft.seasonEnd) {
      return { error: "Choose the season start date first, then choose its end date." };
    }
    if (!endDate || endDate < startDate) {
      return { error: "The end date must be on or after the start date." };
    }
    if (!draft.price.trim() || !Number.isFinite(price) || price <= 0) {
      return { error: "Enter a rate above $0 before adding it to the calendar." };
    }

    return {
      rule: {
        id: `rate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: `${draft.period[0].toUpperCase()}${draft.period.slice(1)} rate`,
        period: draft.period,
        startDate,
        endDate,
        priceCents: Math.round(price * 100),
      },
    };
  };

  const updateRules = (nextRules) => {
    const next = normalizeBookingRateRules(nextRules);
    setEditableRules(next);
    onChange(next);
    return next;
  };

  const addRule = () => {
    const { rule, error } = ruleFromDraft();
    if (error) {
      setWarning(error);
      return;
    }
    setWarning("");
    setSaveMessage("Rate added. Select Save rates to store it.");
    updateRules([...normalized, rule]);
    setDraft((current) => ({ ...current, price: "" }));
  };

  const saveRates = async () => {
    let rulesToSave = normalized;
    const hasCompletedDraft = draft.price.trim().length > 0;

    if (hasCompletedDraft) {
      const { rule, error } = ruleFromDraft();
      if (error) {
        setWarning(error);
        return;
      }
      rulesToSave = updateRules([...normalized, rule]);
    }

    if (!rulesToSave.length) {
      setWarning("Add at least one special rate before saving.");
      return;
    }
    setWarning("");
    setSaveMessage("");
    setSaving(true);
    try {
      const result = await onSave?.(rulesToSave);
      if (hasCompletedDraft) setDraft((current) => ({ ...current, price: "" }));
      setSaveMessage(result?.deferred
        ? "Rates are saved in this listing form and will publish when the listing is submitted."
        : "Special rates saved successfully.");
    } catch (error) {
      setWarning(error?.message || "Special rates could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const changePeriod = (period) => {
    setWarning("");
    setDraft((current) => ({
      ...current,
      period,
      anchor: period === "season" ? "" : (current.anchor || today),
      seasonEnd: "",
    }));
  };

  const changeAnchor = (anchor) => {
    setWarning("");
    setDraft((current) => ({
      ...current,
      anchor,
      seasonEnd: current.seasonEnd && current.seasonEnd >= anchor ? current.seasonEnd : "",
    }));
  };

  const selectCalendarDates = (startDate, endDate = "") => {
    setWarning("");
    setSaveMessage("");
    setDraft((current) => ({
      ...current,
      anchor: startDate,
      seasonEnd: current.period === "season" ? endDate : "",
    }));
  };

  return (
    <section className="sm:col-span-2 rounded-2xl border border-primary-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary-700 font-bold">Smart rate calendar</p>
          <h3 className="font-heading text-lg font-semibold text-foreground-950">Add special pricing when you need it</h3>
          <p className="text-xs text-foreground-600 font-label mt-1">Your base {rateLabel} applies automatically. Add overrides only for selected dates or seasons.</p>
        </div>
        <span className="rounded-full bg-primary-50 border border-primary-100 px-3 py-1 text-xs font-semibold text-primary-800 whitespace-nowrap">Base {money(basePriceCents)}</span>
      </div>
      {!isOpen ? (
        <button
          type="button"
          aria-label="+ Special Rates"
          onClick={() => setIsOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-primary-300 bg-primary-50 px-4 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-100"
        >
          <span aria-hidden="true" className="mr-1">+</span><span className="whitespace-nowrap">Special Rates</span>
        </button>
      ) : (
        <>
          <BookingPriceCalendar
            basePriceCents={basePriceCents}
            rules={normalized}
            mode={draft.period === "season" ? "range" : "single"}
            selectedStart={draft.anchor}
            selectedEnd={draft.period === "season" ? draft.seasonEnd : ""}
            onSelect={selectCalendarDates}
            minimumDate={today}
            unitLabel={rateLabel.replace(/ rate$/, "")}
          />
          {warning && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
              <i className="ri-error-warning-line mt-0.5 text-amber-700" />
              <span>{warning}</span>
            </div>
          )}
          {saveMessage && (
            <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
              <i className="ri-checkbox-circle-line mt-0.5 text-primary-700" />
              <span>{saveMessage}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 rounded-xl bg-background-100/70 p-4">
            <FormField label="Apply special rate to" htmlFor="special-rate-period">
              <Select id="special-rate-period" value={draft.period} onChange={(event) => changePeriod(event.target.value)}>
                {availablePeriods.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label={draft.period === "month" ? "Month" : draft.period === "season" ? "Season starts" : draft.period === "week" ? "Week starts" : "Date"} htmlFor="rate-anchor">
              <Input id="rate-anchor" type={draft.period === "month" ? "month" : "date"} min={draft.period === "month" ? today.slice(0, 7) : today} value={draft.period === "month" ? draft.anchor.slice(0, 7) : draft.anchor} onChange={(event) => changeAnchor(draft.period === "month" ? `${event.target.value}-01` : event.target.value)} required />
            </FormField>
            {draft.period === "season" && <FormField label="Season ends" htmlFor="rate-season-end">
              <Input id="rate-season-end" type="date" min={draft.anchor || today} value={draft.seasonEnd} disabled={!draft.anchor} required onChange={(event) => {
                setWarning("");
                setDraft((current) => ({ ...current, seasonEnd: event.target.value }));
              }} />
            </FormField>}
            <FormField label="Rate (USD)" htmlFor="special-rate-price" required>
              <Input id="special-rate-price" type="number" min="0.01" step="0.01" value={draft.price} required onChange={(event) => {
                setWarning("");
                setDraft((current) => ({ ...current, price: event.target.value }));
              }} placeholder="125.00" />
            </FormField>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-end gap-3 pt-1">
              <button type="button" aria-label="+ Special Rates" onClick={addRule} className="inline-flex min-h-[46px] items-center justify-center whitespace-nowrap rounded-lg bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800">
                <span aria-hidden="true" className="mr-1">+</span> Special Rates
              </button>
              <button type="button" onClick={saveRates} disabled={saving || (normalized.length === 0 && !draft.price.trim())} className="inline-flex min-h-[46px] items-center justify-center whitespace-nowrap rounded-lg border border-primary-300 bg-white px-5 text-sm font-semibold text-primary-800 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50">
                <i className="ri-save-line mr-1.5" /> {saving ? "Saving…" : "Save rates"}
              </button>
            </div>
          </div>
        </>
      )}
      {normalized.length > 0 && (
        <div className="mt-4 space-y-2">
          {normalized.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-background-200 px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground-900">{rule.label} · {money(rule.priceCents)}</p>
                <p className="text-xs text-foreground-500 font-label">{rule.startDate}{rule.endDate !== rule.startDate ? ` to ${rule.endDate}` : ""}</p>
              </div>
              <button type="button" className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent-700 hover:bg-accent-50" onClick={() => {
                updateRules(normalized.filter((item) => item.id !== rule.id));
                setSaveMessage("Rate removed. Select Save rates to store this change.");
              }}>
                <i className="ri-delete-bin-line mr-1" /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
