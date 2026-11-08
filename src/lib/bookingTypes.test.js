import { describe, expect, it } from "vitest";
import {
  bookingRateUnit,
  bookingRateLabel,
  bookingTypeOptions,
  normalizeRentalRateUnit,
  rentalBookingTypes,
  rentalUnitsBetween,
} from "./bookingTypes";

describe("booking types", () => {
  it("offers every Rental industry plus Appointment or service", () => {
    expect(bookingTypeOptions[0]).toEqual({ value: "appointment", label: "Appointment or service" });
    expect(bookingTypeOptions.slice(1).map((option) => option.value)).toEqual(
      rentalBookingTypes.map((industry) => industry.slug),
    );
    expect(rentalBookingTypes).toHaveLength(14);
  });

  it("assigns the requested nightly, monthly, and daily rate units", () => {
    expect(bookingRateUnit("apartments")).toBe("night");
    expect(bookingRateUnit("hotels")).toBe("night");
    expect(bookingRateUnit("short-term-rental-housing")).toBe("night");
    expect(bookingRateUnit("long-term-rental-housing")).toBe("month");
    expect(bookingRateUnit("vehicles")).toBe("day");
    expect(bookingRateUnit("appointment")).toBe("booking");
    expect(bookingRateLabel("vehicles")).toBe("Daily");
  });

  it("calculates calendar days and weekly, monthly, and yearly billing periods", () => {
    expect(rentalUnitsBetween("2030-01-01", "2030-01-04", "day")).toBe(3);
    expect(rentalUnitsBetween("2030-01-01", "2030-01-15", "week")).toBe(2);
    expect(rentalUnitsBetween("2030-01-01", "2030-03-02", "month")).toBe(2);
    expect(rentalUnitsBetween("2030-01-01", "2031-01-02", "year")).toBe(2);
    expect(normalizeRentalRateUnit("week", "apartments")).toBe("week");
    expect(normalizeRentalRateUnit("invalid", "apartments")).toBe("night");
  });
});
