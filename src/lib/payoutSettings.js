export const DIGITAL_PAYOUT_PROVIDERS = [
  "PayPal",
  "Wise",
  "Zelle",
  "Cash App",
  "Venmo",
  "Other digital wallet",
];

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
