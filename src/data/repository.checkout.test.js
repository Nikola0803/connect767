import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCartPaypalOrder, createPaymentIntent } from "./repository";

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
});
