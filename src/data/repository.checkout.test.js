import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/config", async (importOriginal) => ({
  ...(await importOriginal()),
  isLiveApi: true,
}));

import {
  captureCartPaypalOrder,
  captureVendorProductPaypalOrder,
  confirmOrder,
  confirmVendorOrder,
  createCartPaypalOrder,
  createPaymentIntent,
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
});
