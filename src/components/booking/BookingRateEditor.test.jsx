import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingRateEditor from "./BookingRateEditor";

describe("BookingRateEditor", () => {
  it("keeps optional special pricing collapsed until requested", () => {
    render(
      <BookingRateEditor
        basePriceCents={20000}
        rules={[]}
        onChange={() => {}}
        rateLabel="daily rate"
        billingPeriod="day"
      />,
    );

    expect(screen.getByRole("button", { name: /add special pricing/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/apply special rate to/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add special pricing/i }));
    expect(screen.getByLabelText(/apply special rate to/i)).toBeInTheDocument();
  });

  it("limits special-rate periods to options compatible with the base billing period", () => {
    render(
      <BookingRateEditor
        basePriceCents={95000}
        rules={[]}
        onChange={() => {}}
        rateLabel="monthly rate"
        billingPeriod="month"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add special pricing/i }));
    const period = screen.getByLabelText(/apply special rate to/i);

    expect(period).toHaveValue("month");
    expect(screen.getByRole("option", { name: "Full month" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Season / date range" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Specific day" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Full week" })).not.toBeInTheDocument();
  });

  it("opens automatically when saved special rates already exist", () => {
    render(
      <BookingRateEditor
        basePriceCents={20000}
        rules={[{
          id: "holiday",
          label: "Holiday rate",
          period: "day",
          startDate: "2030-12-25",
          endDate: "2030-12-25",
          priceCents: 25000,
        }]}
        onChange={() => {}}
        rateLabel="daily rate"
        billingPeriod="day"
      />,
    );

    expect(screen.getByLabelText(/apply special rate to/i)).toBeInTheDocument();
    expect(screen.getByText(/holiday rate/i)).toBeInTheDocument();
  });

  it("warns when a required rate is missing", () => {
    render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add special pricing/i }));
    fireEvent.click(screen.getByRole("button", { name: /add special rate/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/enter a rate above \$0/i);
  });

  it("requires the seasonal start before enabling its end date", () => {
    render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add special pricing/i }));
    fireEvent.change(screen.getByLabelText(/apply special rate to/i), { target: { value: "season" } });
    expect(screen.getByLabelText(/season ends/i)).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/season starts/i), { target: { value: "2030-06-01" } });
    expect(screen.getByLabelText(/season ends/i)).toBeEnabled();
  });
});
