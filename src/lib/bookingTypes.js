import { categoryTaxonomy } from "../data/industries";

const rentalCategory = categoryTaxonomy.find((category) => category.slug === "rentals");

const NIGHTLY_TYPES = new Set(["apartments", "hotels", "short-term-rental-housing", "rental"]);
const MONTHLY_TYPES = new Set(["long-term-rental-housing"]);
export const rentalRateUnitOptions = [
  { value: "night", label: "Nightly" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

export const rentalBookingTypes = rentalCategory?.industries || [];
export const bookingTypeOptions = [
  { value: "appointment", label: "Appointment or service" },
  ...rentalBookingTypes.map(({ slug, label }) => ({ value: slug, label })),
];

export function isRentalBookingType(type) {
  return type === "rental" || rentalBookingTypes.some(({ slug }) => slug === type);
}

export function bookingRateUnit(type) {
  if (!isRentalBookingType(type)) return "booking";
  if (MONTHLY_TYPES.has(type)) return "month";
  if (NIGHTLY_TYPES.has(type)) return "night";
  return "day";
}

export function normalizeRentalRateUnit(unit, type = "rental") {
  return rentalRateUnitOptions.some((option) => option.value === unit)
    ? unit
    : bookingRateUnit(type);
}

export function bookingRateLabel(type, selectedUnit = "") {
  const unit = isRentalBookingType(type)
    ? normalizeRentalRateUnit(selectedUnit, type)
    : bookingRateUnit(type);
  return rentalRateUnitOptions.find((option) => option.value === unit)?.label || "Booking";
}

export function bookingTypeLabel(type) {
  if (type === "appointment") return "Appointment or service";
  if (type === "rental") return "Rental stay";
  return rentalBookingTypes.find(({ slug }) => slug === type)?.label || "Rental";
}

export function normalizeBookingType(type) {
  return type === "appointment" || isRentalBookingType(type) ? type : "appointment";
}

export function rentalUnitsBetween(startDate, endDate, unit) {
  if (!startDate || !endDate) return 0;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const days = Math.round((end - start) / 86400000);
  const periodDays = unit === "week" ? 7 : unit === "month" ? 30 : unit === "year" ? 365 : 1;
  return Math.ceil(days / periodDays);
}
