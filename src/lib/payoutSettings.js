export const DIGITAL_PAYOUT_PROVIDERS = [
  "NBD MoBanking",
  "Remitly",
  "PayPal",
  "Wise",
  "Zelle",
  "Cash App",
  "Venmo",
  "Republic Bank of Dominica",
  "Dominica Cooperative Credit Union",
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
  "Republic Bank of Dominica": {
    label: "Republic Bank account number or payout reference",
    placeholder: "Account number or payout reference",
  },
  "Dominica Cooperative Credit Union": {
    label: "Credit union account number or payout reference",
    placeholder: "Account number or payout reference",
  },
};

export function hasPaidBookingRate(form) {
  return Number(form.bookingPrice || 0) > 0 ||
    (form.bookingRateRules || []).some((rule) => Number(rule.priceCents) > 0);
}

export function hasCompletePayoutDetails(form) {
  const hasPaidRate = hasPaidBookingRate(form);
  if (!form.bookingEnabled || !hasPaidRate) return true;
  if (form.bookingPayoutMethod === "bank") {
    return Boolean(
      form.bookingPayoutAccountName?.trim() &&
        form.bookingPayoutBankName?.trim() &&
        form.bookingPayoutBankCountry?.trim() &&
        form.bookingPayoutAccountNumber?.trim() &&
        (form.bookingPayoutRoutingNumber?.trim() || form.bookingPayoutSwiftCode?.trim())
    );
  }
  if (form.bookingPayoutMethod === "digital") {
    return Boolean(
      form.bookingPayoutDigitalProvider?.trim() && form.bookingPayoutDigitalAccount?.trim()
    );
  }
  return false;
}
