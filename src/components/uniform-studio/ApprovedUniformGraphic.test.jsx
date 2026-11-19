import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sports, templates } from "../../data/uniforms";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";
import { SIDE_ASSET_BY_SPORT, SIDE_REGIONS } from "./SideUniformGraphic";

describe("ApprovedUniformGraphic trim isolation", () => {
  it.each(["front", "side", "back"])("uses precision rendering for the %s preview", (view) => {
    const { container } = render(<ApprovedUniformGraphic sport="soccer" view={view} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("shape-rendering", "geometricPrecision");
    expect(svg).toHaveAttribute("text-rendering", "geometricPrecision");
    expect(svg).toHaveAttribute("color-interpolation", "sRGB");
    expect(svg.style.imageRendering).toBe("auto");
  });

  it("renders Mixed as a matching short-sleeve sample instead of mismatched arms", () => {
    const { container } = render(<ApprovedUniformGraphic sport="soccer" view="front" sleeve="Mixed" />);
    expect(container.querySelectorAll('[data-sleeve-replacement] path')).toHaveLength(0);
  });

  it.each(["front", "back"])("renders every selected collar shape on the soccer %s view", (view) => {
    for (const collar of ["Crew", "V-Neck", "Polo"]) {
      const { container, unmount } = render(
        <ApprovedUniformGraphic sport="soccer" view={view} collar={collar} />,
      );
      expect(container.querySelector(`[data-collar-shape="${collar}"]`)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders every selected collar shape with perspective treatment on the side view", () => {
    for (const collar of ["Crew", "V-Neck", "Polo"]) {
      const { container, unmount } = render(
        <ApprovedUniformGraphic sport="soccer" view="side" collar={collar} />,
      );
      const collarLayer = container.querySelector(`[data-collar-shape="${collar}"]`);
      expect(collarLayer).toBeInTheDocument();
      expect(collarLayer.querySelector('[data-collar-part="side-band"]')).toBeInTheDocument();
      unmount();
    }
  });

  it.each(["Crew", "V-Neck", "Polo"])("uses one solid selected color for the %s collar in every view", (collar) => {
    const collarColor = "#f15a37";
    for (const view of ["front", "side", "back"]) {
      const { container, unmount } = render(
        <ApprovedUniformGraphic sport="soccer" view={view} collar={collar} colors={{ collar: collarColor }} />,
      );
      const part = view === "side"
        ? "side-band"
        : collar === "Polo"
          ? (view === "front" ? "polo-left-wing" : "polo-back-band")
          : collar === "Crew"
            ? (view === "front" ? "crew-band" : "crew-back-band")
            : (view === "front" ? "v-neck-band" : "v-neck-back-band");
      const band = container.querySelector(`[data-collar-part="${part}"]`);
      expect(band).toBeInTheDocument();
      expect(band.getAttribute("fill")).toBe(collarColor);
      unmount();
    }
  });

  it.each(["Crew", "V-Neck"])("uses distinct front and rear geometry for the %s collar", (collar) => {
    const { container, rerender } = render(
      <ApprovedUniformGraphic sport="soccer" view="front" collar={collar} />,
    );
    const frontPart = collar === "Crew" ? "crew-band" : "v-neck-band";
    const backPart = collar === "Crew" ? "crew-back-band" : "v-neck-back-band";
    expect(container.querySelector(`[data-collar-part="${frontPart}"]`)).toBeInTheDocument();
    expect(container.querySelector(`[data-collar-part="${backPart}"]`)).not.toBeInTheDocument();

    rerender(<ApprovedUniformGraphic sport="soccer" view="back" collar={collar} />);
    expect(container.querySelector(`[data-collar-part="${frontPart}"]`)).not.toBeInTheDocument();
    expect(container.querySelector(`[data-collar-part="${backPart}"]`)).toBeInTheDocument();
  });

  it("fits the soccer collar cleanup and bands to the photographed neckline", () => {
    const { container, rerender } = render(
      <ApprovedUniformGraphic sport="soccer" view="front" collar="Crew" />,
    );
    const frontPatch = container.querySelector('[data-collar-patch="source-cleanup"]');
    const frontBand = container.querySelector('[data-collar-part="crew-band"]');
    expect(frontPatch.getAttribute("rx")).toBe("47");
    expect(frontPatch.getAttribute("ry")).toBe("30");
    expect(Number(frontBand.getAttribute("rx"))).toBeLessThan(40);

    rerender(<ApprovedUniformGraphic sport="soccer" view="back" collar="Crew" />);
    const backPatch = container.querySelector('[data-collar-patch="source-cleanup"]');
    expect(backPatch.getAttribute("rx")).toBe("45");
    expect(backPatch.getAttribute("ry")).toBe("25");
    expect(container.querySelector('[data-collar-part="crew-back-band"]')).toBeInTheDocument();
  });

  it("scales the soccer side collar around the photographed neck anchor", () => {
    const { container } = render(
      <ApprovedUniformGraphic sport="soccer" view="side" collar="V-Neck" />,
    );
    const collarLayer = container.querySelector('[data-collar-shape="V-Neck"]');
    expect(collarLayer.getAttribute("data-collar-scale")).toBe("0.74");
    expect(collarLayer.getAttribute("transform")).toContain("scale(0.74)");
    expect(collarLayer.querySelector('[data-collar-part="side-inner-seam"]')).toBeInTheDocument();
  });

  it("keeps Polo wings and placket on the front while rendering only a rear band on the back", () => {
    const collarColor = "#20d860";
    const { container, rerender } = render(
      <ApprovedUniformGraphic sport="soccer" view="front" collar="Polo" colors={{ collar: collarColor }} />,
    );
    expect(container.querySelector('[data-collar-part="polo-left-wing"]')).toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-right-wing"]')).toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-placket"]')).toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-back-band"]')).not.toBeInTheDocument();
    for (const wing of container.querySelectorAll('[data-collar-part^="polo-"][data-collar-part$="-wing"]')) {
      expect(wing.getAttribute("d")).toContain(" Q");
      expect(wing.getAttribute("stroke-linecap")).toBe("round");
      expect(wing.getAttribute("stroke-linejoin")).toBe("round");
      expect(wing.getAttribute("filter")).toBeNull();
      expect(wing.getAttribute("fill")).toBe(collarColor);
    }
    expect(container.querySelector('[data-collar-part="polo-placket"]').getAttribute("fill")).toBe(collarColor);

    rerender(<ApprovedUniformGraphic sport="soccer" view="back" collar="Polo" colors={{ collar: collarColor }} />);
    expect(container.querySelector('[data-collar-part="polo-left-wing"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-right-wing"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-placket"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-back-band"]')).toBeInTheDocument();
    expect(container.querySelector('[data-collar-part="polo-back-band"]').getAttribute("fill")).toBe(collarColor);
    expect(container.querySelector('[data-collar-part="polo-back-seam"]')).toBeInTheDocument();
  });

  it.each(["front", "back"])("replaces both %s sleeves from the shoulder boundary and preserves wrist trim", (view) => {
    const { container } = render(
      <ApprovedUniformGraphic sport="soccer" view={view} sleeve="Long" colors={{ sleeveStrip: "#f15a37" }} />,
    );
    const replacements = container.querySelectorAll('[data-sleeve-replacement="Long"] [data-long-sleeve-side]');
    expect(replacements).toHaveLength(2);
    const expectedBoundaryStarts = view === "front"
      ? ["M275,56", "M391,56"]
      : ["M775.5,52", "M894.5,52"];
    replacements.forEach((replacement, index) => {
      expect(replacement.getAttribute("d")).toMatch(new RegExp(`^${expectedBoundaryStarts[index]}`));
      expect(replacement).not.toHaveAttribute("stroke");
    });
    const shoulderCaps = container.querySelector('[data-long-sleeve-shoulder-caps="masked"]');
    expect(shoulderCaps.getAttribute("mask")).toMatch(/^url\(#approved-jersey-/);
    expect(shoulderCaps.querySelectorAll("[data-long-sleeve-shoulder]")).toHaveLength(2);
    expect(container.querySelectorAll('[data-long-sleeve-cuff]')).toHaveLength(2);
    // The selected long sleeve replaces the short cuff; only the wrist trim
    // remains after the sleeve continues from the existing shirt boundary.
    expect(container.querySelectorAll('[data-garment-tint="flat-color"] [data-garment-zone="sleeveStrip"]')).toHaveLength(0);
    for (const cuff of container.querySelectorAll('[data-long-sleeve-cuff]')) {
      expect(cuff.getAttribute("stroke")).toMatch(/^url\(#approved-sleeve-edge-/);
      expect(cuff.getAttribute("data-edge-color")).toBe("#f15a37");
    }
  });

  it("renders the selected long sleeve and its end trim in the side view", () => {
    const { container } = render(
      <ApprovedUniformGraphic sport="soccer" view="side" sleeve="Long" colors={{ sleeve: "#f4f1e8", sleeveStrip: "#00c8c8" }} />,
    );
    const replacement = container.querySelector('[data-sleeve-replacement="Long"] [data-long-sleeve-side="right"]');
    expect(replacement).not.toBeNull();
    expect(replacement.getAttribute("d")).toMatch(/^M369 38/);
    const cuff = container.querySelector('[data-long-sleeve-cuff="right"]');
    expect(cuff.getAttribute("fill")).toMatch(/^url\(#approved-side-sleeve-edge-/);
    expect(cuff.getAttribute("data-edge-color")).toBe("#00c8c8");
  });

  it.each(["front", "side", "back"])("uses the same full-strength sleeve tint on the %s view", (view) => {
    const { container } = render(<ApprovedUniformGraphic sport="soccer" view={view} colors={{ body: "#8888ff", sleeve: "#111111" }} />);
    const sleeveTint = [...container.querySelectorAll('[data-garment-tint="fabric-multiply"]')]
      .find((group) => group.querySelector('path[fill="#111111"]'));
    expect(sleeveTint).toBeDefined();
    const maskId = sleeveTint.getAttribute("mask").slice(5, -1);
    const mask = container.querySelector(`mask[id="${maskId}"]`);
    expect(mask.style.maskType).toBe("alpha");
    expect([null, "1"]).toContain(sleeveTint.getAttribute("opacity"));
    expect(sleeveTint.style.mixBlendMode).toBe("multiply");
    if (view !== "side") {
      // Shape cuts still need black to hide fabric, rather than using alpha.
      expect(container.querySelector('mask[id^="approved-kit-shape-"]').style.maskType).toBe("luminance");
    }
  });
  it.each(["front", "back"])("composites the %s shirt body and sleeves once without a bordered join", (view) => {
    const color = "#0c2340";
    const { container } = render(
      <ApprovedUniformGraphic sport="soccer" view={view} colors={{ body: color, sleeve: color }} />,
    );

    const body = container.querySelector('[data-garment-zone="body"]');
    const sleeves = container.querySelectorAll('[data-garment-zone="sleeve"]');
    expect(sleeves).toHaveLength(2);
    expect(body.parentElement).toBe(sleeves[0].parentElement);
    expect(body.parentElement.getAttribute("data-garment-tint")).toBe("fabric-multiply");
    expect(body.getAttribute("stroke")).toBe(color);
    for (const sleeve of sleeves) {
      expect(sleeve.getAttribute("stroke")).toBe(color);
      expect(sleeve.getAttribute("stroke-width")).toBe("5");
    }
  });
  it("aligns the basketball V-neck to the actual front and back garment centers", () => {
    const { container, rerender } = render(
      <ApprovedUniformGraphic sport="basketball" view="front" collar="V-Neck" />,
    );

    const frontPatch = container.querySelector('[data-collar-patch="source-cleanup"]');
    const frontOpening = container.querySelector('[data-collar-part="v-neck-opening"]');
    expect(frontPatch.getAttribute("cx")).toBe("334");
    expect(frontOpening.getAttribute("d")).toBe("M282,187 Q321,234 334,242 Q347,234 386,187");

    rerender(<ApprovedUniformGraphic sport="basketball" view="back" collar="V-Neck" />);
    const backPatch = container.querySelector('[data-collar-patch="source-cleanup"]');
    const backOpening = container.querySelector('[data-collar-part="v-neck-back-opening"]');
    expect(backPatch.getAttribute("cx")).toBe("836.5");
    expect(backOpening.getAttribute("d")).toContain("836.5");
    expect(container.querySelector('[data-collar-part="v-neck-opening"]')).not.toBeInTheDocument();
  });

  it("aligns side color boundaries with each image's native dimensions", () => {
    const { container, rerender } = render(<ApprovedUniformGraphic sport="soccer" view="side" />);
    for (const [sport, region] of Object.entries(SIDE_REGIONS)) {
      rerender(<ApprovedUniformGraphic sport={sport} view="side" />);
      const svg = container.querySelector('svg');
      expect(svg.getAttribute("viewBox")).toBe(`0 0 ${region.width} ${region.height}`);
      expect(svg.querySelector('image').getAttribute("width")).toBe(String(region.width));
      expect(svg.querySelector('[data-garment-zone="body"]').getAttribute("height")).toBe(String(region.bottomStart));
    }
  });

  it("matches the soccer shirt-end thickness across front, side and back views", () => {
    const { container, rerender } = render(<ApprovedUniformGraphic sport="soccer" view="front" />);
    const front = container.querySelector('[data-shirt-edge="complete"]');
    expect(front.getAttribute("data-shirt-edge-width")).toBe("30");
    expect(front.getAttribute("rx")).toBe("4");
    const frontRatio = Number(front.getAttribute("height")) / 1358;

    rerender(<ApprovedUniformGraphic sport="soccer" view="side" />);
    const side = container.querySelector('[data-garment-zone="shirtStrip"]');
    expect(side.getAttribute("data-shirt-edge-width")).toBe("30");
    expect(Number(side.getAttribute("rx"))).toBeGreaterThan(0);
    const sideRatio = Number(side.getAttribute("height")) / SIDE_REGIONS.soccer.height;

    rerender(<ApprovedUniformGraphic sport="soccer" view="back" />);
    const back = container.querySelector('[data-shirt-edge="complete"]');
    expect(back.getAttribute("data-shirt-edge-width")).toBe("30");
    const backRatio = Number(back.getAttribute("height")) / 1358;

    expect(Math.abs(frontRatio - sideRatio)).toBeLessThan(0.001);
    expect(backRatio).toBe(frontRatio);
  });

  it("keeps shorts and sleeve-end trims smooth and proportionally equal in every soccer view", () => {
    const { container, rerender } = render(<ApprovedUniformGraphic sport="soccer" view="front" />);
    const frontShorts = container.querySelector('[data-shorts-edge="complete"]');
    const frontSleeves = container.querySelectorAll('[data-garment-zone="sleeveStrip"]');
    expect(frontShorts.getAttribute("data-shorts-edge-width")).toBe("18");
    expect(frontSleeves).toHaveLength(2);
    for (const sleeve of frontSleeves) {
      expect(sleeve.getAttribute("data-sleeve-edge-width")).toBe("20");
      expect(sleeve.getAttribute("d")).toContain(" Q");
      expect(sleeve.getAttribute("stroke-linejoin")).toBe("round");
    }

    rerender(<ApprovedUniformGraphic sport="soccer" view="side" />);
    const sideShorts = container.querySelector('[data-garment-zone="shortsStrip"]');
    const sideSleeve = container.querySelector('[data-garment-zone="sleeveStrip"]');
    expect(sideShorts.getAttribute("data-shorts-edge-width")).toBe("18");
    expect(Number(sideShorts.getAttribute("data-edge-depth")) / SIDE_REGIONS.soccer.height)
      .toBeCloseTo(18 / 1358, 3);
    expect(sideSleeve.getAttribute("data-sleeve-edge-width")).toBe("20");
    expect(Number(sideSleeve.getAttribute("data-edge-depth")) / SIDE_REGIONS.soccer.height)
      .toBeCloseTo(20 / 1358, 3);
    expect(sideSleeve.getAttribute("stroke-linejoin")).toBe("round");

    rerender(<ApprovedUniformGraphic sport="soccer" view="back" />);
    expect(container.querySelector('[data-shorts-edge="complete"]').getAttribute("data-shorts-edge-width")).toBe("18");
    for (const sleeve of container.querySelectorAll('[data-garment-zone="sleeveStrip"]')) {
      expect(sleeve.getAttribute("data-sleeve-edge-width")).toBe("20");
      expect(sleeve.getAttribute("d")).toContain(" Q");
    }
  });

  it("composites side colors once so the sleeve never multiplies into the body color", () => {
    const colors = { body: "#17384e", sleeve: "#ed430d", shorts: "#22cc88", collar: "#ffcc00", sleeveStrip: "#112233" };
    const { container, rerender } = render(<ApprovedUniformGraphic sport="soccer" view="side" colors={colors} />);
    expect(container.querySelectorAll('[data-garment-tint="fabric-multiply"]')).toHaveLength(1);
    for (const key of ["body", "sleeve", "shorts"]) {
      expect(container.querySelector(`[data-garment-zone="${key}"]`).getAttribute("fill")).toBe(colors[key]);
    }
    expect(container.querySelector('[data-garment-zone="collar"]').getAttribute("fill")).toBe(colors.collar);
    expect(container.querySelector('[data-garment-zone="sleeveStrip"]').getAttribute("data-edge-color")).toBe(colors.sleeveStrip);
    rerender(<ApprovedUniformGraphic sport="soccer" view="side" colors={{ ...colors, body: "#ff0000" }} />);
    expect(container.querySelector('[data-garment-zone="body"]').getAttribute("fill")).toBe("#ff0000");
    expect(container.querySelector('[data-garment-zone="sleeve"]').getAttribute("fill")).toBe(colors.sleeve);
  });

  it.each(["front", "back"])("paints the selected sleeve-end color over dark source pixels on the %s view", (view) => {
    const sleeveEnd = "#ff6538";
    const { container } = render(
      <ApprovedUniformGraphic sport="soccer" view={view} colors={{ sleeveStrip: sleeveEnd }} />,
    );

    const cuffs = container.querySelectorAll('[data-garment-zone="sleeveStrip"]');
    expect(cuffs).toHaveLength(2);
    for (const cuff of cuffs) {
      expect(cuff.getAttribute("fill")).toMatch(/^url\(#approved-sleeve-edge-/);
      expect(cuff.getAttribute("data-edge-color")).toBe(sleeveEnd);
      if (view === "back") expect(cuff.getAttribute("transform")).toBe("translate(579.5 0)");
      else expect(cuff.getAttribute("transform")).toBeNull();
    }
    expect(cuffs[0].parentElement.getAttribute("data-garment-tint")).toBe("flat-color");
    expect(cuffs[0].parentElement.style.mixBlendMode).toBe("normal");
  });

  it("does not double-tint the default front or back shirt zones", () => {
    const { container, rerender } = render(<ApprovedUniformGraphic sport="soccer" view="front" colors={{ body: "#17384e" }} />);
    expect(container.querySelector('[data-zone-id="front-body"]').getAttribute("fill-opacity")).toBe("0");
    rerender(<ApprovedUniformGraphic sport="soccer" view="back" colors={{ body: "#17384e" }} />);
    expect(container.querySelector('[data-zone-id="back-body"]').getAttribute("fill-opacity")).toBe("0");
  });
  it("provides a side-view asset for every sport category and template", () => {
    for (const sport of sports) {
      expect(SIDE_ASSET_BY_SPORT[sport.slug], `${sport.label} side asset`).toBeTruthy();
    }

    for (const template of templates) {
      expect(
        SIDE_ASSET_BY_SPORT[template.sportSlug],
        `${template.name} side asset`,
      ).toBeTruthy();
    }
  });

  it("uses the dedicated Netball dress silhouette for the Court Dress template", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="netball"
        view="side"
        colors={{ body: "#f6f1e7", shorts: "#086B44" }}
      />,
    );

    expect(container.querySelector('image[href*="approved-netball-side.png"]')).not.toBeNull();
  });

  it("renders a dedicated side asset with the same workspace contract", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="side"
        colors={{ body: "#1B1A16", shorts: "#086B44", socks: "#E4553D" }}
      />,
    );

    const side = container.querySelector('svg[data-uniform-view="side"]');
    expect(side).not.toBeNull();
    expect(side.getAttribute("aria-label")).toBe("soccer complete uniform side");
    expect(side.querySelector('image[href*="approved-soccer-side.png"]')).not.toBeNull();
    expect(side.querySelector('rect[fill="#1B1A16"]')).not.toBeNull();
    expect(side.querySelector('rect[fill="#086B44"]')).not.toBeNull();
    expect(side.querySelector('rect[fill="#E4553D"]')).not.toBeNull();
  });

  it("provides independent mirrored left and right sleeve artwork surfaces", () => {
    const { container, rerender } = render(
      <ApprovedUniformGraphic sport="soccer" view="sleeve-left" colors={{ sleeve: "#12aa66" }} />,
    );

    const leftSleeve = container.querySelector('svg[data-uniform-view="sleeve-left"]');
    expect(leftSleeve).not.toBeNull();
    expect(leftSleeve.getAttribute("data-sleeve-side")).toBe("left");
    expect(leftSleeve.style.transform).toBe("scaleX(-1)");
    expect(leftSleeve.getAttribute("aria-label")).toBe("soccer left sleeve");

    rerender(<ApprovedUniformGraphic sport="soccer" view="sleeve-right" colors={{ sleeve: "#12aa66" }} />);
    const rightSleeve = container.querySelector('svg[data-uniform-view="sleeve-right"]');
    expect(rightSleeve).not.toBeNull();
    expect(rightSleeve.getAttribute("data-sleeve-side")).toBe("right");
    expect(rightSleeve.style.transform).toBe("");
    expect(rightSleeve.getAttribute("aria-label")).toBe("soccer right sleeve");
  });

  it("uses the selected colors as deep base tones while retaining fabric shading", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{ body: "#1B1A16", shorts: "#086B44" }}
      />,
    );

    const shirtBody = [...container.querySelectorAll('[data-garment-tint="fabric-multiply"]')]
      .map((node) => node.querySelector('path[d^="M275,56"]'))
      .find(Boolean);
    const shorts = [...container.querySelectorAll('[data-garment-tint="fabric-multiply"]')]
      .find((node) => node.getAttribute("mask")?.includes("approved-shorts-"))
      ?.querySelector('rect[fill="#086B44"]');

    expect(shirtBody.getAttribute("fill")).toBe("#1B1A16");
    expect(shorts.getAttribute("fill")).toBe("#086B44");
    expect(shirtBody.parentElement.style.mixBlendMode).toBe("multiply");
    expect(shorts.parentElement.style.mixBlendMode).toBe("multiply");
    expect(shirtBody.parentElement.getAttribute("opacity")).toBe("1");
  });

  it("renders both socks as one solid color without repainting the cuffs or shirt hem", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{ socks: "#086B44", shirtStrip: "#E4553D" }}
      />,
    );

    const leftSock = container.querySelector('[data-zone-id="front-left-sock"]');
    const rightSock = container.querySelector('[data-zone-id="front-right-sock"]');
    const leftCuff = container.querySelector('[data-zone-id="front-left-sock-cuff"]');
    const shirtHem = container.querySelector('[data-shirt-edge="complete"]');

    const sockTint = [...container.querySelectorAll('[data-garment-tint="fabric-multiply"]')]
      .find((node) => node.getAttribute("mask")?.includes("approved-socks-"));

    expect(sockTint.querySelector('rect[fill="#086B44"]')).not.toBeNull();
    expect(leftSock.getAttribute("fill-opacity")).toBe("0");
    expect(rightSock.getAttribute("fill-opacity")).toBe("0");
    expect(leftSock.getAttribute("mask")).toContain("approved-socks-");
    expect(leftCuff.getAttribute("fill-opacity")).toBe("0");
    expect(shirtHem.getAttribute("fill")).toMatch(/^url\(#approved-shirt-edge-/);
    expect(shirtHem.getAttribute("data-edge-color")).toBe("#E4553D");

    const socksMask = container.querySelector('mask[id^="approved-socks-"]');
    const socksClip = container.querySelector('clipPath[id^="approved-socks-clip-"]');
    expect(socksMask.style.maskType).toBe("alpha");
    expect(socksMask.querySelector("image").getAttribute("clip-path")).toContain("approved-socks-clip-");
    expect(socksClip.querySelector("rect").getAttribute("y")).toBe("865");
  });

  it("clips non-correctable sock templates to the dedicated socks-only mask", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="goalkeeper"
        view="front"
        colors={{ socks: "#1B1A16" }}
      />,
    );

    const sockTint = [...container.querySelectorAll('[data-garment-tint="fabric-multiply"]')]
      .find((node) => node.getAttribute("mask")?.includes("approved-socks-"));

    expect(sockTint).toBeDefined();
    expect(sockTint.querySelector('rect[fill="#1B1A16"]')).not.toBeNull();
  });

  it("renders one shirt-end band without painting a separate body-cleanup color", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{ body: "#eeeeee", shirtStrip: "#18a8d8", shorts: "#f47b63" }}
      />,
    );

    const shirtHem = container.querySelector('[data-shirt-edge="complete"]');
    const shirtBody = container.querySelector('path[d^="M275,56"]');
    const shirtBodyCleanup = container.querySelector('[data-shirt-body-cleanup="complete"]');
    const editableShirtHem = container.querySelector('[data-zone-id="front-shirt-hem"]');
    expect(shirtHem).not.toBeNull();
    expect(shirtBody.getAttribute("d")).toContain("L481,548 L189,548");
    expect(shirtHem.parentElement.getAttribute("mask")).toContain("approved-jersey-");
    expect(shirtHem.parentElement.style.mixBlendMode).toBe("normal");
    expect(shirtHem.getAttribute("x")).toBe("0");
    expect(shirtHem.getAttribute("y")).toBe("550");
    expect(shirtHem.getAttribute("width")).toBe("579.5");
    expect(shirtHem.getAttribute("height")).toBe("30");
    expect(shirtBodyCleanup).toBeNull();
    expect(editableShirtHem.getAttribute("fill-opacity")).toBe("0");

    const jerseyMask = container.querySelector('mask[id^="approved-jersey-"]');
    const jerseyClip = container.querySelector('clipPath[id^="approved-jersey-clip-"]');
    expect(jerseyMask.style.maskType).toBe("alpha");
    expect(jerseyClip.querySelector("rect").getAttribute("height")).toBe("580");
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

  it("hard-clips one shorts color across the full source silhouette", () => {
    const { container } = render(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        colors={{ shorts: "#1B1A16", shortsStrip: "#1B1A16" }}
      />,
    );

    const shortsTint = [...container.querySelectorAll('[data-garment-tint="fabric-multiply"]')]
      .find((node) => node.getAttribute("mask")?.includes("approved-shorts-"));
    const shortsMask = container.querySelector('mask[id^="approved-shorts-"]');
    const shortsClip = container.querySelector('clipPath[id^="approved-shorts-clip-"]');
    const leftLeg = container.querySelector('[data-zone-id="front-left-shorts"]');
    const waistband = container.querySelector('[data-zone-id="front-waistband"]');
    const editableShortsHem = container.querySelector('[data-zone-id="front-left-shorts-hem"]');
    const shortsEdge = container.querySelector('[data-shorts-edge="complete"]');

    expect(shortsTint.querySelector('rect[fill="#1B1A16"]')).not.toBeNull();
    expect(shortsMask.style.maskType).toBe("alpha");
    expect(shortsMask.querySelector("image").getAttribute("clip-path")).toContain("approved-shorts-clip-");
    expect(shortsClip.querySelector("rect").getAttribute("y")).toBe("580");
    expect(shortsClip.querySelector("rect").getAttribute("height")).toBe("285");
    expect(leftLeg.getAttribute("fill-opacity")).toBe("0");
    expect(waistband.getAttribute("fill-opacity")).toBe("0");
    expect(editableShortsHem.getAttribute("fill-opacity")).toBe("0");
    expect(shortsEdge.getAttribute("data-shorts-edge-width")).toBe("18");
    expect(shortsEdge.getAttribute("transform")).toBe("translate(0 0)");
    expect(shortsEdge.querySelectorAll("path")).toHaveLength(2);
    expect(shortsEdge.querySelector("path").getAttribute("d")).toContain("M155,792 C200,812");
    expect(shortsEdge.querySelector("path").getAttribute("fill")).toMatch(/^url\(#approved-shorts-edge-/);
    expect(shortsEdge.getAttribute("data-edge-color")).toBe("#1B1A16");
    expect(shortsEdge.parentElement.style.mixBlendMode).toBe("normal");
  });
});
