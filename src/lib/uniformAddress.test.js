import { describe, expect, it } from "vitest";
import { validateUniformShippingAddress } from "./uniformAddress";

const base = {
  firstName: "James",
  lastName: "Brown",
  address1: "123 James Street",
  city: "Houston",
};

describe("Uniform Studio North American address validation", () => {
  it("accepts valid U.S., Canadian and Mexican addresses", () => {
    expect(validateUniformShippingAddress({ ...base, country: "US", state: "TX", postcode: "77044" }).valid).toBe(true);
    expect(validateUniformShippingAddress({ ...base, country: "CA", state: "ON", postcode: "M5V 3L9" }).valid).toBe(true);
    expect(validateUniformShippingAddress({ ...base, country: "MX", state: "JA", postcode: "44100" }).valid).toBe(true);
  });

  it("rejects incomplete names, street addresses, regions and postal codes", () => {
    const result = validateUniformShippingAddress({
      ...base,
      firstName: "h",
      lastName: "g",
      address1: "James Street",
      country: "US",
      state: "XX",
      postcode: "7704",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({ firstName: expect.any(String), lastName: expect.any(String), address1: expect.any(String), state: expect.any(String), postcode: expect.any(String) });
  });

  it("keeps Caribbean postal codes and regions optional", () => {
    expect(validateUniformShippingAddress({ ...base, country: "DM", state: "", postcode: "" }).valid).toBe(true);
  });
});
