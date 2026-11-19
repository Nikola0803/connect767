export const UNIFORM_SHIPPING_COUNTRIES = [
  {
    label: "North America",
    countries: [
      ["US", "United States"],
      ["CA", "Canada"],
      ["MX", "Mexico"],
    ],
  },
  {
    label: "Caribbean",
    countries: [
      ["AI", "Anguilla"], ["AG", "Antigua and Barbuda"], ["AW", "Aruba"],
      ["BS", "Bahamas"], ["BB", "Barbados"], ["BQ", "Bonaire, Sint Eustatius and Saba"],
      ["VG", "British Virgin Islands"], ["KY", "Cayman Islands"], ["CU", "Cuba"],
      ["CW", "Curaçao"], ["DM", "Dominica"], ["DO", "Dominican Republic"],
      ["GD", "Grenada"], ["GP", "Guadeloupe"], ["HT", "Haiti"],
      ["JM", "Jamaica"], ["MQ", "Martinique"], ["MS", "Montserrat"],
      ["PR", "Puerto Rico"], ["BL", "Saint Barthélemy"], ["KN", "Saint Kitts and Nevis"],
      ["LC", "Saint Lucia"], ["MF", "Saint Martin"], ["VC", "Saint Vincent and the Grenadines"],
      ["SX", "Sint Maarten"], ["TT", "Trinidad and Tobago"], ["TC", "Turks and Caicos Islands"],
      ["VI", "U.S. Virgin Islands"],
    ],
  },
];

const NORTH_AMERICA = new Set(UNIFORM_SHIPPING_COUNTRIES[0].countries.map(([code]) => code));
const CARIBBEAN = new Set(UNIFORM_SHIPPING_COUNTRIES[1].countries.map(([code]) => code));

export function uniformShippingRate(country, unitCount) {
  const code = String(country || "").trim().toUpperCase();
  const units = Math.max(0, Math.floor(Number(unitCount) || 0));
  const highVolume = units >= 50;
  if (NORTH_AMERICA.has(code)) {
    return {
      zone: "north-america",
      zoneLabel: "North America",
      amount: highVolume ? 450 : 300,
      label: `North America uniform shipping · ${highVolume ? "50+" : "under 50"} units`,
    };
  }
  if (CARIBBEAN.has(code)) {
    return {
      zone: "caribbean",
      zoneLabel: "Caribbean",
      amount: highVolume ? 800 : 600,
      label: `Caribbean uniform shipping · ${highVolume ? "50+" : "under 50"} units`,
    };
  }
  return null;
}

