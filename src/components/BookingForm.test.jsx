import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BookingForm from "./BookingForm";

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
    expect(screen.getByText(/60-minute appointment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to payment · \$75.00/i })).toBeInTheDocument();
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

    expect(screen.getAllByLabelText("required")).toHaveLength(6);
    expect(screen.getByLabelText(/your name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred date/i)).toBeRequired();
    expect(screen.getByLabelText(/preferred time/i)).toBeRequired();
    expect(screen.getByLabelText(/anything else/i)).toBeRequired();
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

    expect(screen.getByText(/3 nights × \$125.00/i)).toBeInTheDocument();
    expect(screen.getByText(/total \$375.00/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to payment · \$375.00/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred time/i)).not.toBeInTheDocument();
  });
});
