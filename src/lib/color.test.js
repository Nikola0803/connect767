import { describe, it, expect } from "vitest";
import { shadeOf, fabricShades } from "./color";

describe("shadeOf", () => {
  it("lightens a color with a positive delta", () => {
    const result = shadeOf("#808080", 16);
    // #808080 is roughly 50% lightness — a +16 delta should end up lighter.
    expect(result.toLowerCase()).not.toBe("#808080");
    const lightness = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    expect(lightness(result)).toBeGreaterThan(lightness("#808080"));
  });

  it("darkens a color with a negative delta", () => {
    const result = shadeOf("#808080", -18);
    const lightness = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    expect(lightness(result)).toBeLessThan(lightness("#808080"));
  });

  it("clamps lightness so a near-white base never blows out past white", () => {
    const result = shadeOf("#fefefe", 50);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("clamps lightness so a near-black base never crushes to pure black", () => {
    const result = shadeOf("#010101", -50);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns a well-formed hex string", () => {
    expect(shadeOf("#3366ff", 10)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("fabricShades", () => {
  it("returns highlight/base/shadow keyed around the input color", () => {
    const shades = fabricShades("#4477cc");
    expect(shades.base).toBe("#4477cc");
    expect(shades.highlight).toMatch(/^#[0-9a-f]{6}$/);
    expect(shades.shadow).toMatch(/^#[0-9a-f]{6}$/);
    expect(shades.highlight).not.toBe(shades.shadow);
  });
});
