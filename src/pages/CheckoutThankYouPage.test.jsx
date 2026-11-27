import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import CheckoutThankYouPage from "./CheckoutThankYouPage";

describe("checkout completion messages", () => {
  it("confirms that quote requests are unpaid and production has not started", () => {
    render(<MemoryRouter initialEntries={["/checkout/thank-you?order=123&payment=quote"]}><CheckoutThankYouPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Quote requested" })).toBeInTheDocument();
    expect(screen.getByText(/Payment and production have not started/i)).toBeInTheDocument();
    expect(screen.getByText(/#123/)).toBeInTheDocument();
  });
});
