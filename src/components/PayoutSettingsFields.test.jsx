import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayoutSettingsFields from "./PayoutSettingsFields";
import { hasCompletePayoutDetails } from "../lib/payoutSettings";

const paidForm = {
  bookingEnabled: true,
  bookingPrice: "75",
  bookingPayoutMethod: "",
  bookingPayoutAccountName: "",
  bookingPayoutBankName: "",
  bookingPayoutBankCountry: "Dominica",
  bookingPayoutAccountNumber: "",
  bookingPayoutRoutingNumber: "",
  bookingPayoutSwiftCode: "",
  bookingPayoutDigitalProvider: "",
  bookingPayoutDigitalAccount: "",
};

describe("PayoutSettingsFields", () => {
  it("requires a complete destination for paid bookings only", () => {
    expect(hasCompletePayoutDetails(paidForm)).toBe(false);
    expect(hasCompletePayoutDetails({ ...paidForm, bookingPrice: "0" })).toBe(true);
    expect(
      hasCompletePayoutDetails({
        ...paidForm,
        bookingPayoutMethod: "digital",
        bookingPayoutDigitalProvider: "PayPal",
        bookingPayoutDigitalAccount: "payments@example.com",
      }),
    ).toBe(true);
  });

  it("shows bank and digital payout choices", () => {
    const onChange = vi.fn();
    render(<PayoutSettingsFields form={paidForm} onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /bank account/i }));
    expect(onChange).toHaveBeenCalledWith("bookingPayoutMethod", "bank");
    expect(screen.getByRole("radio", { name: /digital payment/i })).toBeInTheDocument();
    expect(screen.getByText(/10% platform fee/i)).toBeInTheDocument();
  });

  it("includes NBD MoBanking and Remitly as digital cash-out destinations", () => {
    render(
      <PayoutSettingsFields
        form={{ ...paidForm, bookingPayoutMethod: "digital" }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("option", { name: "NBD MoBanking" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Remitly" })).toBeInTheDocument();
  });

  it("renders protected bank fields when bank transfer is selected", () => {
    render(
      <PayoutSettingsFields
        form={{ ...paidForm, bookingPayoutMethod: "bank" }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText(/account holder name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account number \/ iban/i)).toHaveAttribute("type", "password");
    expect(screen.getByText(/encrypted and never displayed/i)).toBeInTheDocument();
  });
});
