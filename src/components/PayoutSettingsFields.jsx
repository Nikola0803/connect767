import { FormField, Input, Select } from "./ui/FormField";
import {
  DIGITAL_PAYOUT_PROVIDERS,
  DIGITAL_PAYOUT_PROVIDER_HELP,
} from "../lib/payoutSettings";

export default function PayoutSettingsFields({ form, onChange }) {
  const paidBookings = Number(form.bookingPrice || 0) > 0;
  const providerHelp = DIGITAL_PAYOUT_PROVIDER_HELP[form.bookingPayoutDigitalProvider];

  if (!paidBookings) {
    return (
      <div className="sm:col-span-2 rounded-xl border border-background-200 bg-background-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-100 text-foreground-500">
            <i className="ri-wallet-3-line text-lg" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-900">Owner payouts</p>
            <p className="mt-1 text-xs leading-5 text-foreground-600 font-label">
              Enter a booking rate above $0 to choose where Connect767 should send your earnings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 overflow-hidden rounded-xl border border-primary-200 bg-background-50">
      <div className="border-b border-primary-100 bg-primary-50/70 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <i className="ri-secure-payment-line text-xl" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-950">Where should we send your payouts?</p>
            <p className="mt-1 text-xs leading-5 text-foreground-600 font-label">
              Customers pay securely through Connect767. We retain the 10% platform fee and send
              the remaining balance to this private payout destination.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              value: "bank",
              icon: "ri-bank-line",
              title: "Bank account",
              text: "Local or international transfer",
            },
            {
              value: "digital",
              icon: "ri-wallet-3-line",
              title: "Digital payment",
              text: "NBD MoBanking, Remitly and more",
            },
          ].map((method) => (
            <label
              key={method.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                form.bookingPayoutMethod === method.value
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-background-300 hover:border-primary-300"
              }`}
            >
              <input
                type="radio"
                name="bookingPayoutMethod"
                value={method.value}
                checked={form.bookingPayoutMethod === method.value}
                onChange={(event) => onChange("bookingPayoutMethod", event.target.value)}
                className="mt-1"
              />
              <span className="flex min-w-0 gap-3">
                <i className={`${method.icon} mt-0.5 text-lg text-primary-700`} />
                <span>
                  <span className="block text-sm font-semibold text-foreground-900">{method.title}</span>
                  <span className="mt-0.5 block text-xs text-foreground-600 font-label">{method.text}</span>
                </span>
              </span>
            </label>
          ))}
        </div>

        {form.bookingPayoutMethod === "bank" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Account holder name" htmlFor="bookingPayoutAccountName" required>
              <Input
                id="bookingPayoutAccountName"
                value={form.bookingPayoutAccountName}
                onChange={(event) => onChange("bookingPayoutAccountName", event.target.value)}
                autoComplete="name"
                placeholder="Name on the account"
              />
            </FormField>
            <FormField label="Bank name" htmlFor="bookingPayoutBankName" required>
              <Input
                id="bookingPayoutBankName"
                value={form.bookingPayoutBankName}
                onChange={(event) => onChange("bookingPayoutBankName", event.target.value)}
                placeholder="Financial institution"
              />
            </FormField>
            <FormField label="Bank country" htmlFor="bookingPayoutBankCountry" required>
              <Input
                id="bookingPayoutBankCountry"
                value={form.bookingPayoutBankCountry}
                onChange={(event) => onChange("bookingPayoutBankCountry", event.target.value)}
                autoComplete="country-name"
                placeholder="Dominica"
              />
            </FormField>
            <FormField label="Account number / IBAN" htmlFor="bookingPayoutAccountNumber" required>
              <Input
                id="bookingPayoutAccountNumber"
                type="password"
                value={form.bookingPayoutAccountNumber}
                onChange={(event) => onChange("bookingPayoutAccountNumber", event.target.value)}
                autoComplete="off"
                placeholder="Account number or IBAN"
              />
            </FormField>
            <FormField label="Routing / transit number" htmlFor="bookingPayoutRoutingNumber" hint="Required when your bank uses one">
              <Input
                id="bookingPayoutRoutingNumber"
                value={form.bookingPayoutRoutingNumber}
                onChange={(event) => onChange("bookingPayoutRoutingNumber", event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Routing or transit number"
              />
            </FormField>
            <FormField label="SWIFT / BIC" htmlFor="bookingPayoutSwiftCode" hint="Use this for international transfers">
              <Input
                id="bookingPayoutSwiftCode"
                value={form.bookingPayoutSwiftCode}
                onChange={(event) => onChange("bookingPayoutSwiftCode", event.target.value.toUpperCase())}
                autoComplete="off"
                placeholder="e.g. FCIBDMDM"
              />
            </FormField>
          </div>
        )}

        {form.bookingPayoutMethod === "digital" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Payment provider" htmlFor="bookingPayoutDigitalProvider" required>
              <Select
                id="bookingPayoutDigitalProvider"
                value={form.bookingPayoutDigitalProvider}
                onChange={(event) => onChange("bookingPayoutDigitalProvider", event.target.value)}
              >
                <option value="">Choose a provider</option>
                {DIGITAL_PAYOUT_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              label={providerHelp?.label || "Payout email, username, or handle"}
              htmlFor="bookingPayoutDigitalAccount"
              required
              hint="Enter the exact destination registered with your provider"
            >
              <Input
                id="bookingPayoutDigitalAccount"
                value={form.bookingPayoutDigitalAccount}
                onChange={(event) => onChange("bookingPayoutDigitalAccount", event.target.value)}
                autoComplete="off"
                placeholder={providerHelp?.placeholder || "payments@business.com or @business"}
              />
            </FormField>
            {(form.bookingPayoutDigitalProvider === "NBD MoBanking" ||
              form.bookingPayoutDigitalProvider === "Remitly") && (
              <p className="sm:col-span-2 -mt-1 text-xs leading-5 text-foreground-600 font-label">
                Connect767 will verify this destination and process the payout after you request cash out.
                Transfer timing and any provider requirements are confirmed before funds are released.
              </p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-background-100 px-3 py-2.5 text-xs leading-5 text-foreground-600 font-label">
          <i className="ri-lock-2-line mt-0.5 text-primary-700" />
          <span>Payout details are encrypted and never displayed on your public listing.</span>
        </div>
      </div>
    </div>
  );
}
