import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultZoneColors, normalizeZoneColors } from "../../data/uniforms";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";
import { DesignPanel } from "./StudioPanels";

describe("uniform design controls", () => {
  it("starts the collar in the same color as the blank shirt fabric", () => {
    expect(defaultZoneColors.collar).toBe(defaultZoneColors.body);
  });

  it("drops legacy side-panel colors from saved designs", () => {
    const restored = normalizeZoneColors({ ...defaultZoneColors, panel: "#ff00ff", trim: "#00ffff" });
    expect(restored).not.toHaveProperty("panel");
    expect(restored).not.toHaveProperty("trim");
    expect(Object.keys(restored)).toEqual(Object.keys(defaultZoneColors));
  });

  it("shows only the supported garment color zones", () => {
    render(
      <DesignPanel
        sport="soccer"
        collar="Crew"
        setCollar={vi.fn()}
        sleeve="Short"
        setSleeve={vi.fn()}
        colors={defaultZoneColors}
        setColors={vi.fn()}
        onHoverZone={vi.fn()}
      />,
    );

    expect(screen.getByText("Shirt ends")).toBeInTheDocument();
    expect(screen.getByText("Sleeve ends")).toBeInTheDocument();
    expect(screen.getByText("Shorts ends")).toBeInTheDocument();
    expect(screen.queryByText("Side panels")).not.toBeInTheDocument();
    expect(screen.queryByText(/Trim \(hem/i)).not.toBeInTheDocument();
  });

  it("applies collar and sleeve selections and renders their shapes", () => {
    const setCollar = vi.fn();
    const setSleeve = vi.fn();
    const { container, rerender } = render(
      <DesignPanel
        sport="soccer"
        collar="Crew"
        setCollar={setCollar}
        sleeve="Short"
        setSleeve={setSleeve}
        colors={defaultZoneColors}
        setColors={vi.fn()}
        onHoverZone={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Polo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Long/ }));
    expect(setCollar).toHaveBeenCalledWith("Polo");
    expect(setSleeve).toHaveBeenCalledWith("Long");

    rerender(
      <ApprovedUniformGraphic
        sport="soccer"
        view="front"
        collar="Polo"
        sleeve="Long"
        colors={defaultZoneColors}
      />,
    );
    expect(container.querySelector('[data-collar-shape="Polo"]')).toBeInTheDocument();
    expect(container.querySelector('[data-collar-color="#ffffff"]')).toBeInTheDocument();
    expect(container.querySelector('[data-sleeve-extension="Long"]')).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /soccer complete uniform front/i })).toHaveClass(
      "overflow-hidden",
    );
  });
});
