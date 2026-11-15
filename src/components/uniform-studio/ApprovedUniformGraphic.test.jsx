import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";

describe("ApprovedUniformGraphic trim isolation", () => {
  it("uses the selected colors as deep base tones while retaining fabric shading", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{ body: "#1B1A16", shorts: "#086B44" }}
      />,
    );

    const shirtBody = container.querySelector('path[d^="M275,56"]');
    const shorts = container.querySelector('path[d^="M176,555"]');

    expect(shirtBody.getAttribute("fill")).toBe("#1B1A16");
    expect(shorts.getAttribute("fill")).toBe("#086B44");
    expect(shirtBody.parentElement.style.mixBlendMode).toBe("multiply");
    expect(shorts.parentElement.style.mixBlendMode).toBe("multiply");
    expect(shirtBody.parentElement.getAttribute("opacity")).toBe("1");
  });

  it("clips the full-width shirt hem to the jersey instead of the shorts", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{ body: "#eeeeee", shirtStrip: "#18a8d8", shorts: "#f47b63" }}
      />,
    );

    const shirtHem = container.querySelector('path[d^="M189,545"]');
    const shirtBody = container.querySelector('path[d^="M275,56"]');
    expect(shirtHem).not.toBeNull();
    expect(shirtBody.getAttribute("d")).toContain("L481,548 L189,548");
    expect(shirtHem.parentElement.getAttribute("mask")).toContain("approved-jersey-");
  });

  it("does not reuse sleeve-end color for shoulder seams or shirt-end color for the waistband", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{
          body: "#eeeeee",
          sleeve: "#dddddd",
          sleeveStrip: "#22cc88",
          shirtStrip: "#18a8d8",
          shorts: "#f47b63",
        }}
      />,
    );

    const shoulderSeam = container.querySelector('[data-zone-id="front-left-armhole"]');
    const waistband = container.querySelector('[data-zone-id="front-waistband"]');
    expect(shoulderSeam.getAttribute("fill-opacity")).toBe("0");
    expect(waistband.getAttribute("fill")).toBe("#f47b63");
  });
});
