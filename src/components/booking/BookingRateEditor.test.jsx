import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("button", { name: /special rates/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/apply special rate to/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/enter a rate above \$0/i);
  });

  it("requires the seasonal start before enabling its end date", () => {
    render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    fireEvent.change(screen.getByLabelText(/apply special rate to/i), { target: { value: "season" } });
    expect(screen.getByLabelText(/season ends/i)).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/season starts/i), { target: { value: "2030-06-01" } });
    expect(screen.getByLabelText(/season ends/i)).toBeEnabled();
  });

  it("fills seasonal start and end dates by clicking calendar days", () => {
    render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    fireEvent.change(screen.getByLabelText(/apply special rate to/i), { target: { value: "season" } });

    const availableDays = screen.getAllByRole("button", { name: /\w+ \d+, \d{4}, \$200/i })
      .filter((button) => !button.disabled);
    const startDate = availableDays[0].getAttribute("data-date");
    const endDate = availableDays[3].getAttribute("data-date");
    fireEvent.click(availableDays[0]);
    fireEvent.click(availableDays[3]);

    expect(screen.getByLabelText(/season starts/i)).toHaveValue(startDate);
    expect(screen.getByLabelText(/season ends/i)).toHaveValue(endDate);
    expect(screen.getAllByText(/selected dates/i).length).toBeGreaterThan(0);
  });

  it("keeps the special-rate action on one concise label and saves added rates", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue({ deferred: false });
    const { rerender } = render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={onChange} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    expect(screen.getByRole("button", { name: /^\+ special rates$/i })).toHaveClass("whitespace-nowrap");
    fireEvent.change(screen.getByLabelText(/rate \(usd\)/i), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: /^\+ special rates$/i }));

    const addedRules = onChange.mock.calls[0][0];
    rerender(<BookingRateEditor basePriceCents={20000} rules={addedRules} onChange={onChange} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /save rates/i }));

    expect(onSave).toHaveBeenCalledWith(addedRules);
  });

  it("retains multiple special rates added before the parent rerenders", () => {
    const onChange = vi.fn();
    render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: "2030-02-01" } });
    fireEvent.change(screen.getByLabelText(/rate \(usd\)/i), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: /^\+ special rates$/i }));

    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: "2030-02-02" } });
    fireEvent.change(screen.getByLabelText(/rate \(usd\)/i), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /^\+ special rates$/i }));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0]).toHaveLength(2);
    expect(onChange.mock.calls[1][0].map((rule) => rule.priceCents)).toEqual([25000, 30000]);
  });

  it("includes a completed unsaved rate when Save rates is selected", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue({ deferred: false });
    render(<BookingRateEditor basePriceCents={20000} rules={[]} onChange={onChange} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /special rates/i }));
    fireEvent.change(screen.getByLabelText(/apply special rate to/i), { target: { value: "week" } });
    fireEvent.change(screen.getByLabelText(/week starts/i), { target: { value: "2030-02-03" } });
    fireEvent.change(screen.getByLabelText(/rate \(usd\)/i), { target: { value: "800" } });
    fireEvent.click(screen.getByRole("button", { name: /save rates/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedRules = onSave.mock.calls[0][0];
    expect(savedRules).toHaveLength(1);
    expect(savedRules[0]).toMatchObject({
      period: "week",
      startDate: "2030-02-03",
      endDate: "2030-02-09",
      priceCents: 80000,
    });
  });
});
