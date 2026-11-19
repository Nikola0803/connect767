import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultZoneColors, normalizeZoneColors } from "../../data/uniforms";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";
import { DesignPanel, LayersPanel, OptionsPanel, StudioBackgroundPanel, UniformSetupPanel } from "./StudioPanels";

describe("uniform design controls", () => {
  it("offers twenty-eight quick colourways, including white-shirt presets, and applies the selected palette", () => {
    const onApplyColourway = vi.fn();
    render(
      <LayersPanel
        layers={[]}
        view="front"
        onApplyColourway={onApplyColourway}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Apply .* colourway/ })).toHaveLength(28);
    for (const name of ["White & Navy", "White & Royal", "White & Red", "White & Forest", "White & Gold", "White & Maroon", "White & Purple", "White & Teal"]) {
      expect(screen.getByRole("button", { name: `Apply ${name} colourway` })).toBeVisible();
    }
    fireEvent.click(screen.getByRole("button", { name: "Apply White & Navy colourway" }));
    expect(onApplyColourway).toHaveBeenCalledWith(["#ffffff", "#0c2340", "#0c2340"]);
  });

  it("restores full garment colors after leaving a picker, including focus restored by a native color dialog", () => {
    function Preview() {
      const [highlightZone, setHighlightZone] = useState(null);
      return <>
        <DesignPanel sport="soccer" collar="Crew" sleeve="Short" colors={defaultZoneColors} setColors={vi.fn()} onHoverZone={setHighlightZone} />
        {["front", "side", "back"].map((view) => <ApprovedUniformGraphic key={view} sport="soccer" view={view} colors={defaultZoneColors} highlightZone={highlightZone} />)}
      </>;
    }
    const { container } = render(<Preview />);
    const input = screen.getByLabelText("Shirt body color");
    const tile = input.closest("label");
    const expectFullColors = () => {
      for (const tint of container.querySelectorAll('[data-garment-tint="fabric-multiply"]')) {
        expect([null, "1"]).toContain(tint.getAttribute("opacity"));
      }
      for (const zone of container.querySelectorAll('[data-uniform-view="side"] [data-garment-zone]')) expect(zone.getAttribute("opacity")).toBe("1");
    };
    fireEvent.mouseEnter(tile);
    expect(container.querySelector('[data-uniform-view="side"] [data-garment-zone="sleeve"]').getAttribute("opacity")).toBe("0.24");
    fireEvent.mouseLeave(tile);
    fireEvent.focus(input);
    expectFullColors();
    fireEvent.mouseEnter(tile);
    fireEvent.click(input);
    expectFullColors();
    fireEvent.mouseEnter(tile);
    fireEvent.change(input, { target: { value: "#123456" } });
    expectFullColors();
  });

  it("clears the hover highlight when the color controls unmount", () => {
    const onHoverZone = vi.fn();
    const { unmount } = render(<DesignPanel sport="soccer" collar="Crew" sleeve="Short" colors={defaultZoneColors} setColors={vi.fn()} onHoverZone={onHoverZone} />);
    fireEvent.mouseEnter(screen.getByLabelText("Collar color").closest("label"));
    expect(onHoverZone).toHaveBeenLastCalledWith("collar");
    unmount();
    expect(onHoverZone).toHaveBeenLastCalledWith(null);
  });
  it.each([["soccer", 22], ["basketball", 10], ["cricket", 15], ["netball", 10]])("shows the %s minimum beside Full Kit pricing", (sport, minimum) => {
    render(<OptionsPanel sport={sport} section="fit" fitType="Men" kitType="Full" />);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveTextContent(`Team order · Min Qnty ${minimum}`);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveTextContent("Includes shirt, shorts and socks");
    expect(screen.getByRole("button", { name: /^Shirt Only/ })).toHaveTextContent("Extra team and supporter jerseys use this price");
  });
  it("keeps extra-shirt quantities out of Step 1", () => {
    const setKitType = vi.fn();
    const options = { fitType: "Men", setFitType: vi.fn(), kitType: "Shirt", setKitType, logoApplication: "Sublimated", setLogoApplication: vi.fn(), insideCollarMessage: false, setInsideCollarMessage: vi.fn(), insideCollarText: "", setInsideCollarText: vi.fn() };
    render(<OptionsPanel {...options} section="fit" />);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Shirt Only/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Add extra shirts to your full-kit team order.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Extra shirt quantity 1")).not.toBeInTheDocument();
  });
  it("combines fit, colors and functioning production extras in uniform setup", () => {
    const setInsideCollarMessage = vi.fn();
    render(<UniformSetupPanel designProps={{ sport: "soccer", collar: "Crew", setCollar: vi.fn(), sleeve: "Short", setSleeve: vi.fn(), colors: defaultZoneColors, setColors: vi.fn() }} optionsProps={{ fitType: "Men", setFitType: vi.fn(), kitType: "Full", setKitType: vi.fn(), logoApplication: "Sublimated", setLogoApplication: vi.fn(), insideCollarMessage: false, setInsideCollarMessage, insideCollarText: "", setInsideCollarText: vi.fn() }} />);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toBeVisible();
    expect(screen.getByLabelText("Shirt body color")).toBeInTheDocument();
    const productionHeading = screen.getByRole("heading", { name: "Production extras" });
    expect(productionHeading).toBeVisible();
    expect(productionHeading.closest("details")).toBeNull();
    expect(screen.getByRole("checkbox", { name: /Embroidered team logo/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(setInsideCollarMessage).toHaveBeenCalledWith(true);
  });
  it("includes sublimation by default and allows the embroidery upgrade to be added or removed", () => {
    const setLogoApplication = vi.fn();
    const props = { section: "production", logoApplication: "Sublimated", setLogoApplication, insideCollarMessage: false };
    const { rerender } = render(<OptionsPanel {...props} />);
    expect(screen.getByText("All uniform prints, including logos, are sublimated and included in the base price.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sublimated" })).not.toBeInTheDocument();
    const upgrade = screen.getByRole("checkbox", { name: "Embroidered team logo (+$1.50/kit)" });
    expect(upgrade).not.toBeChecked();
    fireEvent.click(upgrade);
    expect(setLogoApplication).toHaveBeenLastCalledWith("Embroidery");
    rerender(<OptionsPanel {...props} logoApplication="Embroidery" />);
    expect(upgrade).toBeChecked();
    fireEvent.click(upgrade);
    expect(setLogoApplication).toHaveBeenLastCalledWith("Sublimated");
  });
  it("warns when inside-collar customization has neither a message nor an attachment", () => {
    const baseProps = {
      section: "production",
      logoApplication: "Sublimated",
      setLogoApplication: vi.fn(),
      insideCollarMessage: true,
      setInsideCollarMessage: vi.fn(),
      setInsideCollarText: vi.fn(),
      setInsideCollarAttachment: vi.fn(),
    };
    const { rerender } = render(
      <OptionsPanel {...baseProps} insideCollarText="" insideCollarAttachment={null} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an inside-collar message or attach a logo/artwork file.");
    expect(screen.getByPlaceholderText("Message for the inside collar")).toHaveAttribute("aria-invalid", "true");

    rerender(<OptionsPanel {...baseProps} insideCollarText="TEAM" insideCollarAttachment={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<OptionsPanel {...baseProps} insideCollarText="" insideCollarAttachment={{ name: "logo.png", type: "image/png", src: "data:image/png;base64,AA==" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("picks colors directly on garment tiles without a separate editor", () => {
    const setColors = vi.fn();
    const onHoverZone = vi.fn();
    render(<DesignPanel sport="soccer" collar="Crew" setCollar={vi.fn()} sleeve="Short" setSleeve={vi.fn()} colors={defaultZoneColors} setColors={setColors} onHoverZone={onHoverZone} />);
    fireEvent.change(screen.getByLabelText("Sleeve ends color"), { target: { value: "#0c8a57" } });
    const updated = setColors.mock.calls[0][0](defaultZoneColors);
    expect(updated).toEqual({ ...defaultZoneColors, sleeveStrip: "#0c8a57" });
    fireEvent.change(screen.getByLabelText("Shirt body color"), { target: { value: "#086b44" } });
    expect(setColors.mock.calls.at(-1)[0](defaultZoneColors)).toEqual({ ...defaultZoneColors, body: "#086b44" });
    expect(screen.queryByText("Editing selected part")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByLabelText("Collar color").closest("label"));
    expect(onHoverZone).toHaveBeenCalledWith("collar");
    fireEvent.change(screen.getByLabelText("Sleeve ends color"), { target: { value: "#123456" } });
    expect(setColors.mock.calls.at(-1)[0](defaultZoneColors).sleeveStrip).toBe("#123456");
  });
  it("keeps AI-designed base collars out of the controls and offers the paid Polo option", () => {
    const setSleeve = vi.fn();
    const setCollar = vi.fn();
    const props = { sport: "soccer", collar: "Crew", setCollar, sleeve: "Short", setSleeve, colors: defaultZoneColors, setColors: vi.fn() };
    const { rerender } = render(<DesignPanel {...props} />);
    expect(screen.queryByRole("button", { name: "Crew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "V-Neck" })).not.toBeInTheDocument();
    expect(screen.getByText(/Crew and V-Neck styles are designed with the AI tool and included in the base price/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Polo style collar/ }));
    expect(setCollar).toHaveBeenCalledWith("Polo");
    expect(screen.queryByRole("button", { name: "Sleeveless" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Long sleeves/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Long sleeves add \$2\.00\/kit/i)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mixed Sleeve Team Order" }));
    expect(setSleeve).toHaveBeenCalledWith("Mixed");
    rerender(<DesignPanel {...props} sleeve="Mixed" />);
    expect(screen.getByText(/combination of short- and long-sleeve jerseys/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mixed Sleeve Team Order" }));
    expect(setSleeve).toHaveBeenLastCalledWith("Short");
  });
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

  it("maps a distinct shorts color to the real shorts zone", () => {
    const setColors = vi.fn();
    const setTwoTone = vi.fn();
    render(
      <DesignPanel
        sport="soccer"
        collar="Crew"
        setCollar={vi.fn()}
        sleeve="Short"
        setSleeve={vi.fn()}
        colors={defaultZoneColors}
        setColors={setColors}
        onHoverZone={vi.fn()}
        twoTone={{ enabled: false, colorB: "#1b1a16", splitAt: 0.5, softness: 0.005 }}
        setTwoTone={setTwoTone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Shorts color"), { target: { value: "#1b1a16" } });
    const colorUpdater = setColors.mock.calls[0][0];
    const toneUpdater = setTwoTone.mock.calls[0][0];
    expect(colorUpdater(defaultZoneColors).shorts).toBe("#1b1a16");
    expect(toneUpdater({ enabled: false }).enabled).toBe(true);
    expect(screen.queryByText("Split height")).not.toBeInTheDocument();
    expect(screen.queryByText("Blend")).not.toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Crew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "V-Neck" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Polo style collar/ }));
    expect(setCollar).toHaveBeenCalledWith("Polo");
    expect(screen.queryByRole("checkbox", { name: /Long sleeves/ })).not.toBeInTheDocument();

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
    expect(container.querySelector('[data-sleeve-replacement="Long"]')).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /soccer complete uniform front/i })).toHaveClass(
      "overflow-hidden",
    );
  });

  it("offers useful studio backgrounds without changing garment controls", () => {
    const setStudioBackground = vi.fn();
    render(
      <StudioBackgroundPanel
        fitType="Regular"
        setFitType={vi.fn()}
        kitType="Full kit"
        setKitType={vi.fn()}
        logoApplication="Sublimated"
        setLogoApplication={vi.fn()}
        insideCollarMessage={false}
        setInsideCollarMessage={vi.fn()}
        insideCollarText=""
        setInsideCollarText={vi.fn()}
        studioBackground="#F5F0E7"
        setStudioBackground={setStudioBackground}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Charcoal/i }));
    expect(setStudioBackground).toHaveBeenCalledWith("#252824");
    expect(screen.getByText(/never recolors the garment/i)).toBeInTheDocument();
  });

  it("keeps backgrounds out of kit options and offers only Full Kit and Shirt Only", () => {
    const setKitType = vi.fn();
    render(<OptionsPanel fitType="Men" setFitType={vi.fn()} kitType="Full" setKitType={setKitType} logoApplication="Sublimated" setLogoApplication={vi.fn()} insideCollarMessage={false} setInsideCollarMessage={vi.fn()} insideCollarText="" setInsideCollarText={vi.fn()} />);
    expect(screen.queryByText("Studio background")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Both" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveTextContent("$35.00");
    expect(screen.getByRole("button", { name: /^Shirt Only/ })).toHaveTextContent("$12.00");
    fireEvent.click(screen.getByRole("button", { name: /^Shirt Only/ }));
    expect(setKitType).toHaveBeenCalledWith("Shirt");
  });
});
