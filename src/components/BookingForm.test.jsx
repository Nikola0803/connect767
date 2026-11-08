import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingForm from "./BookingForm";

vi.mock("../data/repository", () => ({
  getCheckoutConfig: vi.fn().mockResolvedValue({ stripeEnabled: true, paypalEnabled: false }),
  submitBooking: vi.fn().mockResolvedValue({
    bookingId: 812,
    accessToken: "preview-token",
    paymentRequired: true,
    amountCents: 80000,
  }),
  createBookingCheckout: vi.fn(),
  confirmBookingPayment: vi.fn(),
  createBookingPaypalOrder: vi.fn(),
  captureBookingPaypalOrder: vi.fn(),
}));

describe("BookingForm", () => {
  it("shows the server-provided price and appointment duration", () => {
    render(
      <BookingForm
        slug="consultation"
        businessName="Island Consulting"
        priceCents={7500}
        durationMinutes={60}
      />,
    );

    expect(screen.getByText("$75.00")).toBeInTheDocument();
    expect(screen.getByText(/choose a meeting length from 1 hour to 2 hours/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /paid booking terms/i })).toBeRequired();
    expect(screen.getByRole("button", { name: /continue to payment · \$75.00/i })).toBeDisabled();
  });

  it("keeps zero-price appointments in owner-confirmed request mode", () => {
    render(
      <BookingForm
        slug="free-consultation"
        businessName="Island Consulting"
        priceCents={0}
        durationMinutes={30}
      />,
    );

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send booking request/i })).toBeInTheDocument();
  });

  it("marks every appointment field as required", () => {
    render(
      <BookingForm
        slug="consultation"
        businessName="Island Consulting"
        priceCents={0}
        durationMinutes={30}
      />,
    );

    expect(screen.getAllByLabelText("required")).toHaveLength(7);
    expect(screen.getByLabelText(/your name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred date/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred time/i)).toBeRequired();
    expect(screen.getByLabelText(/meeting length/i)).toBeRequired();
    expect(screen.getByLabelText(/notes & preferences/i)).toBeRequired();
  });

  it("calculates a rental total from check-in and check-out dates", () => {
    render(
      <BookingForm
        slug="island-villa"
        businessName="Island Villa"
        bookingType="rental"
        priceCents={12500}
      />,
    );

    expect(screen.getByText("$125.00 / night")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/check-in/i), { target: { value: "2030-06-10" } });
    fireEvent.change(screen.getByLabelText(/check-out/i), { target: { value: "2030-06-13" } });

    expect(screen.getByText(/3 nights · rates shown on calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/total \$375.00/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /paid booking terms/i }));
    expect(screen.getByRole("button", { name: /continue to payment · \$375.00/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred time/i)).not.toBeInTheDocument();
  });

  it("uses a daily rate for equipment rentals", () => {
    render(
      <BookingForm
        slug="island-tools"
        businessName="Island Tools"
        bookingType="tools"
        priceCents={4000}
      />,
    );

    expect(screen.getByText("$40.00 / day")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2030-06-10" } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2030-06-13" } });
    expect(screen.getByText(/3 days · rates shown on calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/total \$120.00/i)).toBeInTheDocument();
  });

  it("uses a monthly rate for long-term housing", () => {
    render(
      <BookingForm
        slug="long-term-home"
        businessName="Long Term Home"
        bookingType="long-term-rental-housing"
        priceCents={120000}
      />,
    );

    expect(screen.getByText("$1200.00 / month")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2030-01-01" } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2030-03-02" } });
    expect(screen.getByText(/2 months · rates shown on calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/total \$2400.00/i)).toBeInTheDocument();
  });

  it("uses the saved weekly rate period in the calendar and total", () => {
    render(
      <BookingForm
        slug="weekly-villa"
        businessName="Weekly Villa"
        bookingType="apartments"
        rentalRateUnit="week"
        priceCents={95000}
      />,
    );

    expect(screen.getByText("$950.00 / week")).toBeInTheDocument();
    expect(screen.getByText(/prices shown per week/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2030-06-01" } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2030-06-15" } });
    expect(screen.getByText(/2 weeks · rates shown on calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/total \$1900.00/i)).toBeInTheDocument();
  });

  it("requires acceptance of the 10% transaction-fee terms for paid bookings", () => {
    render(
      <BookingForm
        slug="consultation"
        businessName="Island Consulting"
        priceCents={7500}
        durationMinutes={60}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: /10% transaction fee/i });
    const continueButton = screen.getByRole("button", { name: /continue to payment/i });

    expect(checkbox).not.toBeChecked();
    expect(continueButton).toBeDisabled();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(continueButton).toBeEnabled();
  });

  it("reflects a seasonal rate in the customer total", () => {
    render(
      <BookingForm
        slug="island-villa"
        businessName="Island Villa"
        bookingType="rental"
        priceCents={10000}
        rateRules={[{
          id: "winter",
          label: "Winter season",
          period: "season",
          startDate: "2030-12-01",
          endDate: "2030-12-31",
          priceCents: 17500,
        }]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/check-in/i), { target: { value: "2030-12-10" } });
    fireEvent.change(screen.getByLabelText(/check-out/i), { target: { value: "2030-12-13" } });
    expect(screen.getByText(/total \$525.00/i)).toBeInTheDocument();
  });

  it("shows a complete nightly date range and charges a weekly special once", () => {
    render(
      <BookingForm
        slug="james-local-fruits"
        businessName="James Local Fruits"
        bookingType="rental"
        priceCents={20000}
        rateRules={[{
          id: "new-year-week",
          label: "New Year week",
          period: "week",
          startDate: "2030-01-01",
          endDate: "2030-01-07",
          priceCents: 80000,
        }]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/check-in/i), { target: { value: "2030-01-01" } });
    fireEvent.change(screen.getByLabelText(/check-out/i), { target: { value: "2030-01-07" } });

    expect(screen.getByLabelText(/check-out/i)).toHaveValue("2030-01-08");
    expect(screen.getByText(/7 nights · rates shown on calendar/i)).toHaveTextContent("Jan 1–8, 2030");
    expect(screen.getByText(/total \$800\.00/i)).toBeInTheDocument();
  });

  it("replaces the base nightly rate with the exact server total at payment", async () => {
    render(
      <BookingForm
        slug="james-local-fruits"
        businessName="James Local Fruits"
        bookingType="rental"
        priceCents={20000}
        rateRules={[{
          id: "new-year-week",
          label: "New Year week",
          period: "week",
          startDate: "2030-01-01",
          endDate: "2030-01-07",
          priceCents: 80000,
        }]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dale Prosper" } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "dale@example.com" } });
    fireEvent.change(screen.getByLabelText(/^phone/i), { target: { value: "+17675550100" } });
    fireEvent.change(screen.getByLabelText(/check-in/i), { target: { value: "2030-01-01" } });
    fireEvent.change(screen.getByLabelText(/check-out/i), { target: { value: "2030-01-07" } });
    fireEvent.change(screen.getByLabelText(/notes & preferences/i), { target: { value: "Weekly stay" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /paid booking terms/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to payment · \$800\.00/i }));

    expect(await screen.findByText("Total due $800.00")).toBeInTheDocument();
    expect(screen.getByText(/jan 1–8, 2030 · 7 nights/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pay \$800\.00 with card/i })).toBeInTheDocument();
    expect(screen.queryByText(/from \$200\.00 \/ night/i)).not.toBeInTheDocument();
  });

  it("updates an hourly meeting price when the visitor changes duration", () => {
    render(
      <BookingForm
        slug="strategy-session"
        businessName="Island Consulting"
        priceCents={12000}
        priceUnit="hour"
        durationMinutes={30}
        maxDurationMinutes={120}
      />,
    );
    expect(screen.getByText("$120.00 / hour")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/preferred date/i), { target: { value: "2030-07-03" } });
    fireEvent.change(screen.getByLabelText(/meeting length/i), { target: { value: "90" } });
    expect(screen.getAllByText(/1 hr 30 min/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /continue to payment · \$180.00/i })).toBeInTheDocument();
  });
});
