import { expect, it } from "vitest";
import { basketballKitRule, basketballSocksRequested } from "./uniformPromptRules.js";

it("adds Basketball socks only for an explicit customer request", () => {
  expect(basketballSocksRequested("Create a green basketball uniform")).toBe(false);
  expect(basketballSocksRequested("Add matching socks")).toBe(true);
  expect(basketballSocksRequested("Include knee-high socks")).toBe(true);
  expect(basketballSocksRequested("Keep the socks solid with no logos")).toBe(true);
});
it("removes socks when requested and preserves an earlier explicit choice during refinement", () => {
  expect(basketballSocksRequested("Change the jersey colour", true)).toBe(true);
  for (const prompt of ["No socks", "Without socks", "Remove the socks", "Don't include socks", "Do not generate socks"]) expect(basketballSocksRequested(prompt, true)).toBe(false);
});
it("makes default and requested kit instructions unambiguous", () => {
  expect(basketballKitRule(false)).toContain("Do not generate socks");
  expect(basketballKitRule(false)).toContain("sleeveless jerseys and shorts only");
  expect(basketballKitRule(true)).toContain("customer explicitly requested socks");
});
