export const DIGITAL_PAYOUT_PROVIDERS = [
  "NBD MoBanking",
  "Remitly",
  "PayPal",
  "Wise",
  "Zelle",
  "Cash App",
  "Venmo",
  "Other digital wallet",
];

export const DIGITAL_PAYOUT_PROVIDER_HELP = {
  "NBD MoBanking": {
    label: "NBD MoBanking mobile number or account reference",
    placeholder: "+1 767 555 0100 or NBD account reference",
  },
  Remitly: {
    label: "Remitly recipient email or mobile number",
    placeholder: "payments@business.com or +1 767 555 0100",
  },
};

export function hasPaidBookingRate(form) {
  return Number(form.bookingPrice || 0) > 0 ||
    (form.bookingRateRules || []).some((rule) => Number(rule.priceCents) > 0);
}

export function payoutDetailsRequired(form) {
  return Boolean(form.sellProducts || (form.bookingEnabled && hasPaidBookingRate(form)));
}

export function missingPayoutFieldIds(form) {
  if (!payoutDetailsRequired(form)) return [];
  if (form.bookingPayoutMethod === "bank") {
    const routingIsMissing = !form.bookingPayoutRoutingNumber?.trim() && !form.bookingPayoutSwiftCode?.trim();
    return [
      !form.bookingPayoutAccountName?.trim() && "bookingPayoutAccountName",
      !form.bookingPayoutBankName?.trim() && "bookingPayoutBankName",
      !form.bookingPayoutBankCountry?.trim() && "bookingPayoutBankCountry",
      !form.bookingPayoutAccountNumber?.trim() && "bookingPayoutAccountNumber",
      routingIsMissing && "bookingPayoutRoutingNumber",
      routingIsMissing && "bookingPayoutSwiftCode",
    ].filter(Boolean);
  }
  if (form.bookingPayoutMethod === "digital") {
    return [
      !form.bookingPayoutDigitalProvider?.trim() && "bookingPayoutDigitalProvider",
      !form.bookingPayoutDigitalAccount?.trim() && "bookingPayoutDigitalAccount",
    ].filter(Boolean);
  }
  return ["bookingPayoutMethod"];
}

export function hasCompletePayoutDetails(form) {
  return missingPayoutFieldIds(form).length === 0;
}
