import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/config", async (importOriginal) => ({
  ...(await importOriginal()),
  isLiveApi: true,
}));

import {
  checkout,
  captureCartPaypalOrder,
  captureVendorProductPaypalOrder,
  confirmOrder,
  confirmVendorOrder,
  createCartPaypalOrder,
  createCartLocalDominicaOrder,
  createPaymentIntent,
  createUniformPaymentIntent,
  createUniformPaypalOrder,
  createUniformLocalDominicaOrder,
  quoteUniformCheckout,
} from "./repository";

const items = [
  {
    slug: "promotional-crew-neck-t-shirt",
    qty: 2,
    variationId: 1280,
    title: "Promotional Crew neck T-Shirt",
    price: 20,
  },
];

const shipping = {
  firstName: "Test",
  lastName: "Customer",
  company: "",
  address1: "100 Main Street",
  address2: "Suite 4",
  city: "Austin",
  state: "TX",
  postcode: "78701",
  country: "US",
  phone: "555-0100",
};

describe("shop checkout payloads", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ orderId: 99, clientSecret: "secret", paypalOrderId: "PAYPAL-1" }),
      }),
    );
  });

  it.each([["Stripe", createPaymentIntent], ["PayPal", createCartPaypalOrder], ["hosted checkout", checkout], ["local payment", createCartLocalDominicaOrder]])("keeps team and sponsor files in %s order requests", async (_name, createOrder) => {
    const readyMadeArtwork = [
      { name: "crest.png", kind: "team", src: "data:image/png;base64,AA==", notes: "Left chest" },
      { name: "sponsor.pdf", kind: "sponsor", src: "data:application/pdf;base64,AA==", notes: "Upper back" },
    ];
    await createOrder(items, "buyer@example.com", shipping, { readyMadeArtwork });
    expect(JSON.parse(fetch.mock.calls[0][1].body).readyMadeArtwork).toEqual(readyMadeArtwork);
  });

  it("sends the complete shipping address with Stripe orders", async () => {
    await createPaymentIntent(items, "buyer@example.com", shipping);

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      items: [{ slug: items[0].slug, qty: 2, variationId: 1280 }],
      email: "buyer@example.com",
      shipping,
    });
  });

  it("sends the same shipment data with PayPal orders", async () => {
    await createCartPaypalOrder(items, "buyer@example.com", shipping);

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      items: [{ slug: items[0].slug, qty: 2, variationId: 1280 }],
      email: "buyer@example.com",
      shipping,
    });
  });

  it("creates a Shop order reserved for local payment in Dominica", async () => {
    const dominicaShipping = { ...shipping, country: "DM", state: "Saint George", postcode: "" };

    await createCartLocalDominicaOrder(items, "buyer@example.com", dominicaShipping);

    expect(fetch.mock.calls[0][0]).toContain("/checkout/local-dominica");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      items: [{ slug: items[0].slug, qty: 2, variationId: 1280 }],
      email: "buyer@example.com",
      shipping: dominicaShipping,
    });
  });

  it("returns the private checkout token to Shop confirmation endpoints", async () => {
    await confirmOrder(99, "shop-token");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ orderId: 99, accessToken: "shop-token" });

    fetch.mockClear();
    await captureCartPaypalOrder(99, "shop-token");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ orderId: 99, accessToken: "shop-token" });
  });

  it("returns the private checkout token to storefront confirmation endpoints", async () => {
    await confirmVendorOrder(44, "vendor-token");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ accessToken: "vendor-token" });

    fetch.mockClear();
    await captureVendorProductPaypalOrder(44, "vendor-token");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ accessToken: "vendor-token" });
  });

  it("sends the full uniform design, roster and shipment to the totals endpoint", async () => {
    const order = {
      template: "Classic Crew",
      sport: "soccer",
      roster: [{ name: "A. Miller", quantity: 2, shirtSize: "L" }],
      grandTotal: 50,
    };

    await quoteUniformCheckout(order, "coach@example.com", shipping);

    expect(fetch.mock.calls[0][0]).toContain("/uniform-checkout/quote");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ order, email: "coach@example.com", shipping });
  });

  it("adds the Connect767 Design Fee to legacy quote responses below the threshold", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ subtotal: 929, shipping: 300, tax: 0, total: 1229, currency: "USD" }),
    });

    const totals = await quoteUniformCheckout({ roster: [{ name: "Team", quantity: 22 }] }, "coach@example.com", shipping);
    expect(totals).toMatchObject({ designerFee: 50, total: 1279 });
  });

  it("blocks payment when the checkout server has not enforced the required fee", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ subtotal: 929, shipping: 300, tax: 0, total: 1229, clientSecret: "secret" }),
    });

    await expect(createUniformPaymentIntent({ roster: [{ name: "Team", quantity: 22 }] }, "coach@example.com", shipping))
      .rejects.toThrow("Checkout is updating the Connect767 Design Fee");
  });

  it("uses the same server-authoritative uniform payload for Stripe and PayPal", async () => {
    const order = { template: "Classic Crew", roster: [{ name: "A. Miller", quantity: 1 }] };

    await createUniformPaymentIntent(order, "coach@example.com", shipping);
    expect(fetch.mock.calls[0][0]).toContain("/uniform-checkout/intent");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ order, email: "coach@example.com", shipping });

    fetch.mockClear();
    await createUniformPaypalOrder(order, "coach@example.com", shipping);
    expect(fetch.mock.calls[0][0]).toContain("/uniform-checkout/paypal/order");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ order, email: "coach@example.com", shipping });
  });

  it("creates a Dominican local-payment order with the same verified order data", async () => {
    const order = { template: "Classic Crew", roster: [{ name: "A. Miller", quantity: 1 }] };

    await createUniformLocalDominicaOrder(order, "coach@example.com", shipping);

    expect(fetch.mock.calls[0][0]).toContain("/uniform-checkout/local-dominica");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ order, email: "coach@example.com", shipping });
  });
});
