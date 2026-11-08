const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, "0");

export function toDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return toDateKey(date);
}

export function normalizeBookingRateRules(rules) {
  let input = rules;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      input = [];
    }
  }
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 100)
    .map((rule, index) => ({
      id: String(rule?.id || `rate-${index}`),
      label: String(rule?.label || "Special rate").slice(0, 80),
      period: ["day", "week", "month", "season"].includes(rule?.period) ? rule.period : "day",
      startDate: toDateKey(rule?.startDate),
      endDate: toDateKey(rule?.endDate || rule?.startDate),
      priceCents: Math.max(0, Math.min(10000000, Math.round(Number(rule?.priceCents) || 0))),
    }))
    .filter((rule) => rule.startDate && rule.endDate && rule.endDate >= rule.startDate && rule.priceCents > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate)
      || a.endDate.localeCompare(b.endDate)
      || (periodPriority[b.period] || 0) - (periodPriority[a.period] || 0));
}

const periodPriority = { season: 1, month: 2, week: 3, day: 4 };

export function bookingRateRuleForDate(date, rules) {
  const dateKey = toDateKey(date);
  return normalizeBookingRateRules(rules)
    .filter((rule) => dateKey >= rule.startDate && dateKey <= rule.endDate)
    .sort((a, b) => (periodPriority[b.period] || 0) - (periodPriority[a.period] || 0))[0] || null;
}

export function bookingRateForDate(date, basePriceCents, rules) {
  return bookingRateRuleForDate(date, rules)?.priceCents
    ?? Math.max(0, Number(basePriceCents) || 0);
}

export function datesBetween(startDate, endDate) {
  if (!startDate || !endDate || endDate <= startDate) return [];
  const total = Math.round(
    (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / DAY_MS,
  );
  return Array.from({ length: Math.max(0, total) }, (_, index) => addDays(startDate, index));
}

export function bookingPriceForSelection({
  bookingType,
  basePriceCents,
  rules,
  preferredDate,
  checkIn,
  checkOut,
  rateUnit,
  durationMinutes = 30,
  priceUnit = "appointment",
}) {
  if (bookingType === "appointment") {
    const rate = bookingRateForDate(preferredDate, basePriceCents, rules);
    const minutes = Math.max(15, Number(durationMinutes) || 30);
    if (priceUnit === "minute") return Math.round(rate * minutes);
    if (priceUnit === "hour") return Math.round(rate * (minutes / 60));
    return rate;
  }
  const dates = datesBetween(checkIn, checkOut);
  if (!dates.length) return 0;
  const periodDays = rateUnit === "week" ? 7 : rateUnit === "month" ? 30 : rateUnit === "year" ? 365 : 1;
  if (periodDays > 1) {
    return Array.from({ length: Math.ceil(dates.length / periodDays) }, (_, index) =>
      bookingRateForDate(addDays(checkIn, index * periodDays), basePriceCents, rules),
    ).reduce((total, price) => total + price, 0);
  }
  const normalizedRules = normalizeBookingRateRules(rules);
  const selectedDates = new Set(dates);
  const dailyRules = normalizedRules.filter((rule) => !["week", "month"].includes(rule.period));
  let total = 0;
  let index = 0;

  while (index < dates.length) {
    const date = dates[index];
    const flatRule = normalizedRules
      .filter((rule) => ["week", "month"].includes(rule.period)
        && rule.startDate === date
        && datesBetween(rule.startDate, addDays(rule.endDate, 1)).every((item) => selectedDates.has(item)))
      .sort((a, b) => (periodPriority[b.period] || 0) - (periodPriority[a.period] || 0))[0];

    if (flatRule) {
      total += flatRule.priceCents;
      index += datesBetween(flatRule.startDate, addDays(flatRule.endDate, 1)).length;
      continue;
    }

    total += bookingRateForDate(date, basePriceCents, dailyRules);
    index += 1;
  }

  return total;
}

export function ruleDates(period, anchor, seasonEnd = "") {
  if (!anchor) return { startDate: "", endDate: "" };
  if (period === "day") return { startDate: anchor, endDate: anchor };
  if (period === "week") return { startDate: anchor, endDate: addDays(anchor, 6) };
  if (period === "month") {
    const [year, month] = anchor.slice(0, 7).split("-").map(Number);
    const startDate = `${year}-${pad(month)}-01`;
    const endDate = toDateKey(new Date(Date.UTC(year, month, 0)));
    return { startDate, endDate };
  }
  return { startDate: anchor, endDate: seasonEnd };
}
