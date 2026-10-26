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

export function hasCompletePayoutDetails(form) {
  if (!form.bookingEnabled || Number(form.bookingPrice || 0) <= 0) return true;
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
