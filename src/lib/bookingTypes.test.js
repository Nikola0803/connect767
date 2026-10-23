import { describe, expect, it } from "vitest";
import {
  bookingRateUnit,
  bookingRateLabel,
  bookingTypeOptions,
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

  it("calculates calendar days and 30-day billing months", () => {
    expect(rentalUnitsBetween("2030-01-01", "2030-01-04", "day")).toBe(3);
    expect(rentalUnitsBetween("2030-01-01", "2030-03-02", "month")).toBe(2);
  });
});
