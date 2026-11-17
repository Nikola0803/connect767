import { useState } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultZoneColors } from "../../data/uniforms";
import { SOCCER_ZONE_MODEL } from "./uniformZoneModel";
import useGarmentColors from "./useGarmentColors";
import { DesignPanel } from "./StudioPanels";
import ApprovedUniformGraphic from "./ApprovedUniformGraphic";

function usePalette(previewing = true) {
  const [colors, setColors] = useState(defaultZoneColors);
  const [plan, setPlan] = useState({ name: "AI kit", colors: { ...defaultZoneColors, body: "#17384e", sleeve: "#ed430d" } });
  const [zoneStyles, setZoneStyles] = useState({ front: { "front-body": { color: "#112233", texture: "mesh" }, "front-left-shoulder": { color: "#ee5500" } }, back: { "back-body": { color: "#112233" } } });
  const [visible, update] = useGarmentColors({ colors, setColors, previewPlan: previewing ? plan : null, setPreviewPlan: setPlan, zoneModel: SOCCER_ZONE_MODEL, setZoneStyles });
  return { colors, plan, zoneStyles, visible, update };
}

describe("garment palette editing", () => {
  it("updates front, side and back when the shirt body color picker changes during an AI preview", () => {
    function Editor() {
      const { visible, update } = usePalette();
      return <>
        <DesignPanel sport="soccer" collar="Crew" sleeve="Short" colors={visible} setColors={update} />
        {["front", "side", "back"].map((view) => <ApprovedUniformGraphic key={view} sport="soccer" view={view} colors={visible} />)}
      </>;
    }
    const { container } = render(<Editor />);
    expect(screen.getByLabelText("Shirt body color")).toHaveValue("#17384e");
    fireEvent.change(screen.getByLabelText("Shirt body color"), { target: { value: "#00a651" } });
    expect(screen.getByLabelText("Shirt body color")).toHaveValue("#00a651");
    for (const view of ["front", "back"]) {
      const svg = container.querySelector(`[data-uniform-view="${view}"]`);
      expect(svg.querySelector('[data-zone-correction-overlay] [data-zone-id$="-body"]').getAttribute("fill")).toBe("#00a651");
      expect(svg.querySelector('path[fill="#00a651"]')).not.toBeNull();
    }
    expect(container.querySelector('[data-uniform-view="side"] [data-garment-zone="body"]').getAttribute("fill")).toBe("#00a651");
    expect(container.querySelector('[data-uniform-view="side"] [data-garment-zone="sleeve"]').getAttribute("fill")).toBe("#ed430d");
  });
  it("edits the visible AI production palette and saves it without resetting other garment colors", () => {
    const { result, rerender } = renderHook(({ previewing }) => usePalette(previewing), { initialProps: { previewing: true } });
    expect(result.current.visible.body).toBe("#17384e");
    act(() => result.current.update((current) => ({ ...current, body: "#00a651" })));
    expect(result.current.visible.body).toBe("#00a651");
    expect(result.current.plan.colors).toEqual(result.current.colors);
    expect(result.current.visible.sleeve).toBe("#ed430d");
    expect(result.current.plan.name).toBe("AI kit");
    expect(result.current.zoneStyles.front["front-body"]).toEqual({ texture: "mesh" });
    expect(result.current.zoneStyles.back["back-body"]).toEqual({});
    expect(result.current.zoneStyles.front["front-left-shoulder"].color).toBe("#ee5500");
    rerender({ previewing: false });
    expect(result.current.visible.body).toBe("#00a651");
  });

  it("updates a manual garment without changing the original AI plan", () => {
    const { result } = renderHook(() => usePalette(false));
    act(() => result.current.update((current) => ({ ...current, body: "#ffcc00" })));
    expect(result.current.visible.body).toBe("#ffcc00");
    expect(result.current.plan.colors.body).toBe("#17384e");
    expect(result.current.visible.shorts).toBe(defaultZoneColors.shorts);
  });
});
