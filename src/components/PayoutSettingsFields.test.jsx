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

  it("requires and prompts for payout details when only a flexible calendar rate is paid", () => {
    const flexiblePaidForm = {
      ...paidForm,
      bookingPrice: "0",
      bookingRateRules: [{
        period: "week",
        startDate: "2030-06-01",
        endDate: "2030-06-30",
        priceCents: 95000,
      }],
    };

    expect(hasCompletePayoutDetails(flexiblePaidForm)).toBe(false);
    render(<PayoutSettingsFields form={flexiblePaidForm} onChange={() => {}} />);
    expect(screen.getByText(/flexible calendar rates require payout information/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /bank account/i })).toBeInTheDocument();
  });

  it("includes the existing providers and Dominican institutions in one cash-out list", () => {
    render(
      <PayoutSettingsFields
        form={{ ...paidForm, bookingPayoutMethod: "digital" }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("option", { name: "NBD MoBanking" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Remitly" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PayPal" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Republic Bank of Dominica" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dominica Cooperative Credit Union" })).toBeInTheDocument();
  });

  it("renders protected bank fields when bank transfer is selected", () => {
    render(
      <PayoutSettingsFields
        form={{ ...paidForm, bookingPayoutMethod: "bank" }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText(/account holder name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account number \/ iban/i)).toHaveAttribute("type", "password");
    expect(screen.getByText(/encrypted and never displayed/i)).toBeInTheDocument();
  });
});
