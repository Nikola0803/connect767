/**
 * Convert a saved experience total into the value for the current year.
 *
 * The CMS stores the year in which the owner supplied the number. Keeping
 * that baseline makes the value deterministic and removes the need for a
 * scheduled job to rewrite every listing on January 1.
 */
export function currentYearsExperience(
  storedYears,
  asOfYear,
  currentYear = new Date().getUTCFullYear(),
) {
  if (storedYears === null || storedYears === undefined || storedYears === "") return "";

  const years = Number(storedYears);
  const baselineYear = Number(asOfYear);
  const year = Number(currentYear);

  if (!Number.isFinite(years) || years < 0) return "";
  if (
    !Number.isInteger(baselineYear) ||
    baselineYear < 1900 ||
    !Number.isInteger(year) ||
    year < baselineYear
  ) {
    return String(Math.floor(years));
  }

  return String(Math.floor(years) + (year - baselineYear));
}
