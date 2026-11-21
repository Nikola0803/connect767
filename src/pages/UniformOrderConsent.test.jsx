import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewOrderTool } from "./UniformStudioPage";
import { UNIFORM_ORDER_TERMS_VERSION } from "../components/uniform-studio/UniformOrderAgreement";

const mocks = vi.hoisted(() => ({
  intent: vi.fn(), paypal: vi.fn(), capture: vi.fn(), local: vi.fn(), quote: vi.fn(),
  confirm: vi.fn(), error: vi.fn(),
}));
vi.mock("../lib/config", async (original) => ({ ...(await original()), isLiveApi: true }));
vi.mock("../data/repository", async (original) => ({
  ...(await original()),
  getCheckoutConfig: async () => ({ stripeEnabled: true, stripePublishableKey: "pk_test_fixture", paypalEnabled: true, paypalClientId: "test" }),
  quoteUniformCheckout: mocks.quote,
  createUniformPaymentIntent: mocks.intent,
  createUniformPaypalOrder: mocks.paypal,
  captureUniformPaypalOrder: mocks.capture,
  createUniformLocalDominicaOrder: mocks.local,
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve(null) }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }) => children,
  PaymentElement: () => <div>Test card element</div>,
  useStripe: () => ({ confirmPayment: mocks.confirm }),
  useElements: () => ({}),
}));
vi.mock("../components/PaypalButton", () => ({
  default: ({ disabled, createOrder }) => <button disabled={disabled} onClick={createOrder}>PayPal test checkout</button>,
}));

const totals = { subtotal: 770, shipping: 60, tax: 0, designerFee: 50, total: 880 };
const renderOrder = () => render(<ReviewOrderTool
  activeSport="soccer" collar="Crew" sleeve="Short" kitType="Full" logoApplication="Sublimated"
  layers={[]} roster={[{ name: "Team", quantity: 22, size: "M" }]}
  contact={{ name: "", email: "", phone: "", club: "" }} setContact={() => {}}
  shipping={{ firstName: "Avery", lastName: "Miller", email: "test@example.com", phone: "7675550100", company: "", address1: "10 Stadium Road", address2: "", city: "Roseau", state: "Saint George", postcode: "", country: "DM" }}
  setShipping={() => {}} orderPayload={{ roster: [], extraTeamShirts: [], insideCollarMessage: false }}
  capturePreview={async () => ""} unitPrice={35} fanJerseyAdded={false} supporterJerseys={[]}
  onRequestQuote={() => {}} onEditStep={() => {}} savedOrderDesigns={[]}
/>);

describe("custom uniform payment consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.quote.mockResolvedValue(totals);
    mocks.intent.mockResolvedValue({ ...totals, clientSecret: "test", orderId: 99, accessToken: "test" });
    mocks.paypal.mockResolvedValue({ orderId: 99, paypalOrderId: "test" });
    mocks.confirm.mockResolvedValue({ error: { message: "Fixture: no real card payment" } });
  });
  const calculate = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Calculate tax, shipping & total" }));
    await screen.findByRole("button", { name: "Pay $880.00 by card" });
  };
  const consent = () => screen.getByRole("checkbox", { name: /I agree to the Terms & Conditions/ });

  it("requires an explicit agreement for card, PayPal and local orders, without blocking a quote", async () => {
    renderOrder();
    await calculate();
    expect(consent()).not.toBeChecked();
    expect(consent()).toBeRequired();
    expect(screen.getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute("href", "/terms#custom-uniforms");
    const card = screen.getByRole("button", { name: "Pay $880.00 by card" });
    const paypal = screen.getByRole("button", { name: "PayPal test checkout" });
    const local = screen.getByRole("button", { name: "Place order — pay locally in Dominica" });
    for (const button of [card, paypal, local]) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(mocks.intent).not.toHaveBeenCalled();
    expect(mocks.paypal).not.toHaveBeenCalled();
    expect(mocks.local).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Request a quote instead" })).toBeEnabled();
    fireEvent.click(consent());
    for (const button of [card, paypal, local]) expect(button).toBeEnabled();
    fireEvent.click(paypal);
    await waitFor(() => expect(mocks.paypal).toHaveBeenCalled());
    expect(mocks.paypal.mock.calls[0][0]).toMatchObject({ customOrderTermsAccepted: true, customOrderTermsVersion: UNIFORM_ORDER_TERMS_VERSION });
    fireEvent.click(consent());
    for (const button of [card, paypal, local]) expect(button).toBeDisabled();
  });

  it("also disables the final embedded Stripe confirmation when consent is withdrawn", async () => {
    renderOrder();
    await calculate();
    fireEvent.click(consent());
    fireEvent.click(screen.getByRole("button", { name: "Pay $880.00 by card" }));
    const pay = await screen.findByRole("button", { name: "Pay $880.00 securely" });
    expect(mocks.intent.mock.calls[0][0]).toMatchObject({ customOrderTermsAccepted: true, customOrderTermsVersion: UNIFORM_ORDER_TERMS_VERSION });
    expect(pay).toBeEnabled();
    fireEvent.click(consent());
    expect(pay).toBeDisabled();
    fireEvent.submit(pay.closest("form"));
    expect(mocks.confirm).not.toHaveBeenCalled();
    fireEvent.click(consent());
    fireEvent.submit(pay.closest("form"));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
  });
});
