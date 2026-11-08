import { describe, expect, it } from "vitest";
import { bookingPriceForSelection, bookingRateForDate, checkoutAfterFlatRateSelection, normalizeBookingRateRules, ruleDates } from "./bookingRates";

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

  it("bills weekly and yearly rentals by their selected calendar period", () => {
    expect(bookingPriceForSelection({
      bookingType: "rental",
      basePriceCents: 70000,
      checkIn: "2030-01-01",
      checkOut: "2030-01-15",
      rateUnit: "week",
    })).toBe(140000);
    expect(bookingPriceForSelection({
      bookingType: "rental",
      basePriceCents: 500000,
      checkIn: "2030-01-01",
      checkOut: "2031-01-02",
      rateUnit: "year",
    })).toBe(1000000);
  });

  it("charges a complete weekly special rate once for a nightly stay", () => {
    expect(bookingPriceForSelection({
      bookingType: "rental",
      basePriceCents: 20000,
      rules: [{
        id: "holiday-week",
        period: "week",
        startDate: "2030-01-01",
        endDate: "2030-01-07",
        priceCents: 80000,
      }],
      checkIn: "2030-01-01",
      checkOut: "2030-01-08",
      rateUnit: "night",
    })).toBe(80000);
  });

  it("moves checkout to the day after the final included weekly-special date", () => {
    const weeklyRule = [{
      id: "holiday-week",
      period: "week",
      startDate: "2030-01-01",
      endDate: "2030-01-07",
      priceCents: 80000,
    }];
    expect(checkoutAfterFlatRateSelection("2030-01-01", "2030-01-07", weeklyRule)).toBe("2030-01-08");
    expect(checkoutAfterFlatRateSelection("2030-01-02", "2030-01-07", weeklyRule)).toBe("2030-01-07");
  });

  it("uses nightly pricing when a stay does not cover the complete special week", () => {
    expect(bookingPriceForSelection({
      bookingType: "rental",
      basePriceCents: 20000,
      rules: [{
        id: "holiday-week",
        period: "week",
        startDate: "2030-01-01",
        endDate: "2030-01-07",
        priceCents: 80000,
      }],
      checkIn: "2030-01-01",
      checkOut: "2030-01-04",
      rateUnit: "night",
    })).toBe(60000);
  });

  it("expands week and month shortcuts", () => {
    expect(ruleDates("week", "2030-06-10")).toEqual({ startDate: "2030-06-10", endDate: "2030-06-16" });
    expect(ruleDates("month", "2030-02-01")).toEqual({ startDate: "2030-02-01", endDate: "2030-02-28" });
  });

  it("requires an explicit seasonal end date", () => {
    expect(ruleDates("season", "2030-06-10")).toEqual({ startDate: "2030-06-10", endDate: "" });
  });

  it("keeps persisted rate periods in chronological order", () => {
    expect(normalizeBookingRateRules([
      { id: "later", period: "day", startDate: "2030-09-10", endDate: "2030-09-10", priceCents: 20000 },
      { id: "earlier", period: "season", startDate: "2030-05-01", endDate: "2030-06-01", priceCents: 15000 },
      { id: "empty", period: "day", startDate: "2030-01-01", endDate: "2030-01-01", priceCents: 0 },
    ]).map((rule) => rule.id)).toEqual(["earlier", "later"]);
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
