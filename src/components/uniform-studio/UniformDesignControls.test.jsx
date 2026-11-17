import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultZoneColors, normalizeZoneColors } from "../../data/uniforms";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";
import { DesignPanel, OptionsPanel, StudioBackgroundPanel, UniformSetupPanel } from "./StudioPanels";

describe("uniform design controls", () => {
  it.each([["soccer", 22], ["basketball", 10], ["cricket", 15], ["netball", 10]])("shows the %s minimum beside Full Kit pricing", (sport, minimum) => {
    render(<OptionsPanel sport={sport} section="fit" fitType="Men" kitType="Full" />);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveTextContent(`Team order · Min Qnty ${minimum}`);
    expect(screen.getByRole("button", { name: /^Shirt Only/ })).toHaveTextContent("Extra shirts with a Full Kit order");
  });
  it("keeps Full Kit selected when adding extra shirts and allows sizes and quantities", () => {
    const setKitType = vi.fn();
    const setExtraTeamShirts = vi.fn();
    const options = { fitType: "Men", setFitType: vi.fn(), kitType: "Shirt", setKitType, extraTeamShirts: [{ size: "AM", quantity: 1 }], setExtraTeamShirts, logoApplication: "Sublimated", setLogoApplication: vi.fn(), insideCollarMessage: false, setInsideCollarMessage: vi.fn(), insideCollarText: "", setInsideCollarText: vi.fn() };
    render(<OptionsPanel {...options} section="fit" />);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Shirt Only/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Extra shirt quantity 1"), { target: { value: "3" } });
    expect(setExtraTeamShirts.mock.calls.at(-1)[0](options.extraTeamShirts)).toEqual([{ size: "AM", quantity: 3 }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove extra shirt size 1" }));
    expect(setKitType).toHaveBeenCalledWith("Full");
  });
  it("combines fit, colors and functioning production extras in uniform setup", () => {
    const setInsideCollarMessage = vi.fn();
    render(<UniformSetupPanel designProps={{ sport: "soccer", collar: "Crew", setCollar: vi.fn(), sleeve: "Short", setSleeve: vi.fn(), colors: defaultZoneColors, setColors: vi.fn() }} optionsProps={{ fitType: "Men", setFitType: vi.fn(), kitType: "Full", setKitType: vi.fn(), logoApplication: "Sublimated", setLogoApplication: vi.fn(), insideCollarMessage: false, setInsideCollarMessage, insideCollarText: "", setInsideCollarText: vi.fn() }} />);
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toBeVisible();
    expect(screen.getByLabelText("Shirt body color")).toBeInTheDocument();
    const summary = screen.getByText("Production extras");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(summary.closest("summary"));
    expect(screen.getByRole("button", { name: /Embroidery/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(setInsideCollarMessage).toHaveBeenCalledWith(true);
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
  it("offers optional Polo and mixed sleeves without Crew, V-Neck or Sleeveless buttons", () => {
    const setSleeve = vi.fn();
    const props = { sport: "soccer", collar: "Crew", setCollar: vi.fn(), sleeve: "Short", setSleeve, colors: defaultZoneColors, setColors: vi.fn() };
    const { rerender } = render(<DesignPanel {...props} />);
    expect(screen.queryByRole("button", { name: /Crew|V-Neck|Sleeveless/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mixed sleeve lengths" }));
    expect(setSleeve).toHaveBeenCalledWith("Mixed");
    rerender(<DesignPanel {...props} sleeve="Mixed" />);
    expect(screen.getByText(/Only long-sleeve kits add/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Long sleeves/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mixed sleeve lengths" }));
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

  it("maps the two-colour shortcut to the real shorts zone", () => {
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

    fireEvent.click(screen.getByRole("checkbox", { name: /Different shirt and shorts colors/i }));
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

    fireEvent.click(screen.getByRole("checkbox", { name: /Polo/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Long sleeves/ }));
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
    expect(screen.getByRole("button", { name: /^Full Kit/ })).toHaveTextContent("$30.00");
    expect(screen.getByRole("button", { name: /^Shirt Only/ })).toHaveTextContent("$12.00");
    fireEvent.click(screen.getByRole("button", { name: /^Shirt Only/ }));
    expect(setKitType).toHaveBeenCalledWith("Shirt");
  });
});
