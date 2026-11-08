import { describe, expect, it } from "vitest";
import { bookingPriceForSelection, bookingRateForDate, ruleDates } from "./bookingRates";

describe("booking rate calendar", () => {
  const rules = [
    { id: "season", period: "season", startDate: "2030-06-01", endDate: "2030-08-31", priceCents: 15000 },
    { id: "holiday", period: "day", startDate: "2030-07-04", endDate: "2030-07-04", priceCents: 22500 },
  ];

  it("uses the most specific matching rule", () => {
    expect(bookingRateForDate("2030-07-03", 10000, rules)).toBe(15000);
    expect(bookingRateForDate("2030-07-04", 10000, rules)).toBe(22500);
    expect(bookingRateForDate("2030-10-01", 10000, rules)).toBe(10000);
  });

  it("sums the price shown for each rental date", () => {
    expect(bookingPriceForSelection({
      bookingType: "rental",
      basePriceCents: 10000,
      rules,
      checkIn: "2030-07-03",
      checkOut: "2030-07-06",
      rateUnit: "night",
    })).toBe(52500);
  });

  it("expands week and month shortcuts", () => {
    expect(ruleDates("week", "2030-06-10")).toEqual({ startDate: "2030-06-10", endDate: "2030-06-16" });
    expect(ruleDates("month", "2030-02-01")).toEqual({ startDate: "2030-02-01", endDate: "2030-02-28" });
  });

  it("prices meetings by the minute or hour", () => {
    expect(bookingPriceForSelection({
      bookingType: "appointment",
      preferredDate: "2030-07-03",
      basePriceCents: 200,
      durationMinutes: 45,
      priceUnit: "minute",
    })).toBe(9000);
    expect(bookingPriceForSelection({
      bookingType: "appointment",
      preferredDate: "2030-07-03",
      basePriceCents: 12000,
      durationMinutes: 90,
      priceUnit: "hour",
    })).toBe(18000);
  });
});
