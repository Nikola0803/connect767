import { useMemo, useState } from "react";
import { addDays, bookingRateForDate, toDateKey } from "../../lib/bookingRates";

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(Number(cents) % 100 ? 2 : 0)}`;
const monthTitle = (date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

function monthCells(month) {
  const year = month.getFullYear();
  const index = month.getMonth();
  const firstDay = new Date(year, index, 1).getDay();
  const days = new Date(year, index + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: days }, (_, day) => toDateKey(new Date(Date.UTC(year, index, day + 1)))),
  ];
}

export default function BookingPriceCalendar({
  basePriceCents = 0,
  rules = [],
  mode = "single",
  selectedStart = "",
  selectedEnd = "",
  onSelect,
  minimumDate = toDateKey(new Date()),
  unitLabel = "booking unit",
}) {
  const initial = selectedStart ? new Date(`${selectedStart}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const cells = useMemo(() => monthCells(month), [month]);

  const choose = (date) => {
    if (!date || date < minimumDate) return;
    if (mode === "single") {
      onSelect?.(date, "");
      return;
    }
    if (!selectedStart || selectedEnd || date < selectedStart) onSelect?.(date, "");
    else if (date > selectedStart) onSelect?.(selectedStart, date);
  };

  return (
    <div className="rounded-2xl border border-primary-200 bg-background-50 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="w-9 h-9 rounded-full border border-background-200 hover:bg-primary-50" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <i className="ri-arrow-left-s-line" />
        </button>
        <div className="text-center">
          <p className="font-heading text-base font-semibold text-foreground-950">{monthTitle(month)}</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-primary-700 font-semibold">Prices shown per {unitLabel}</p>
        </div>
        <button type="button" className="w-9 h-9 rounded-full border border-background-200 hover:bg-primary-50" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <i className="ri-arrow-right-s-line" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-500">{day}</div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} />;
          const disabled = date < minimumDate;
          const inRange = selectedStart && selectedEnd && date >= selectedStart && date < selectedEnd;
          const selected = date === selectedStart || date === selectedEnd;
          const special = bookingRateForDate(date, basePriceCents, rules) !== Number(basePriceCents || 0);
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => choose(date)}
              className={`min-h-[52px] rounded-lg border px-1 py-1.5 text-center transition-all ${disabled ? "opacity-35 cursor-not-allowed border-transparent" : "hover:-translate-y-0.5 hover:shadow-md"} ${selected ? "bg-primary-700 border-primary-700 text-white" : inRange ? "bg-primary-100 border-primary-200" : special ? "bg-amber-50 border-amber-300" : "bg-white border-background-200"}`}
            >
              <span className="block text-xs font-semibold">{Number(date.slice(-2))}</span>
              <span className={`block mt-0.5 text-[10px] font-bold ${selected ? "text-white" : special ? "text-amber-800" : "text-primary-700"}`}>
                {money(bookingRateForDate(date, basePriceCents, rules))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-foreground-600 font-label">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300" /> Special rate</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary-100 border border-primary-200" /> Selected dates</span>
        {mode === "range" && !selectedEnd && selectedStart && <span className="text-primary-700 font-semibold">Now choose an end date</span>}
      </div>
    </div>
  );
}
