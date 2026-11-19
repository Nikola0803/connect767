export const UNIFORM_ADDRESS_REGIONS = {
  US: [
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
    ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
    ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
    ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
    ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
    ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
    ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
    ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
    ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
    ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
    ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
    ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
    ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ],
  CA: [
    ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
    ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"],
    ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"],
    ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"],
  ],
  MX: [
    ["AG", "Aguascalientes"], ["BC", "Baja California"], ["BS", "Baja California Sur"],
    ["CM", "Campeche"], ["CS", "Chiapas"], ["CH", "Chihuahua"], ["CO", "Coahuila"],
    ["CL", "Colima"], ["DF", "Ciudad de México"], ["DG", "Durango"],
    ["GT", "Guanajuato"], ["GR", "Guerrero"], ["HG", "Hidalgo"], ["JA", "Jalisco"],
    ["MX", "Estado de México"], ["MI", "Michoacán"], ["MO", "Morelos"],
    ["NA", "Nayarit"], ["NL", "Nuevo León"], ["OA", "Oaxaca"], ["PU", "Puebla"],
    ["QT", "Querétaro"], ["QR", "Quintana Roo"], ["SL", "San Luis Potosí"],
    ["SI", "Sinaloa"], ["SO", "Sonora"], ["TB", "Tabasco"], ["TM", "Tamaulipas"],
    ["TL", "Tlaxcala"], ["VE", "Veracruz"], ["YU", "Yucatán"], ["ZA", "Zacatecas"],
  ],
};

const COUNTRY_NAMES = { US: "U.S.", CA: "Canadian", MX: "Mexican" };
const POSTCODE_PATTERNS = {
  US: /^\d{5}(?:-\d{4})?$/,
  CA: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
  MX: /^\d{5}$/,
};

const hasTwoLetters = (value) => (String(value || "").match(/\p{L}/gu) || []).length >= 2;
const validStreet = (value) => {
  const text = String(value || "").trim();
  return (/\d/.test(text) && hasTwoLetters(text)) || /\bP(?:OST)?\.?\s*O(?:FFICE)?\.?\s*BOX\s+\d+/i.test(text);
};

export function uniformAddressRegions(country) {
  return UNIFORM_ADDRESS_REGIONS[String(country || "").toUpperCase()] || [];
}

export function validateUniformShippingAddress(address = {}) {
  const country = String(address.country || "").trim().toUpperCase();
  const errors = {};
  const isNorthAmerican = Boolean(UNIFORM_ADDRESS_REGIONS[country]);

  if (!String(address.firstName || "").trim()) errors.firstName = "Enter the recipient’s first name.";
  if (!String(address.lastName || "").trim()) errors.lastName = "Enter the recipient’s last name.";
  if (!String(address.address1 || "").trim()) errors.address1 = "Enter the street address.";
  if (!String(address.city || "").trim()) errors.city = "Enter the city.";
  if (!country) errors.country = "Choose the delivery country.";

  if (isNorthAmerican) {
    if (!hasTwoLetters(address.firstName)) errors.firstName = "Enter a valid recipient first name.";
    if (!hasTwoLetters(address.lastName)) errors.lastName = "Enter a valid recipient last name.";
    if (!validStreet(address.address1)) errors.address1 = "Enter a complete street address with a building number.";
    if (!hasTwoLetters(address.city)) errors.city = "Enter a valid city.";

    const state = String(address.state || "").trim().toUpperCase();
    if (!UNIFORM_ADDRESS_REGIONS[country].some(([code]) => code === state)) {
      errors.state = `Choose a valid ${COUNTRY_NAMES[country]} ${country === "CA" ? "province or territory" : "state"}.`;
    }

    const postcode = String(address.postcode || "").trim();
    if (!POSTCODE_PATTERNS[country].test(postcode)) {
      errors.postcode = country === "US"
        ? "Enter a valid U.S. ZIP code (for example, 77044)."
        : country === "CA"
          ? "Enter a valid Canadian postal code (for example, M5V 3L9)."
          : "Enter a valid 5-digit Mexican postal code.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    message: Object.values(errors)[0] || "",
  };
}
