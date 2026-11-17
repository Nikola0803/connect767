import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JerseyStage from "./JerseyStage";

const baseProps = {
  sport: "soccer",
  view: "side",
  collar: "Crew",
  sleeve: "Short",
  colors: {},
  layers: [],
  selectedId: null,
  onSelect: vi.fn(),
  onLayerChange: vi.fn(),
  onBackgroundClick: vi.fn(),
  onViewChange: vi.fn(),
  studioBackground: "cream",
};

describe("JerseyStage sleeve placement", () => {
  it("renders independent left and right sleeve windows", () => {
    render(<JerseyStage {...baseProps} />);

    expect(screen.getByRole("group", { name: "Left sleeve artwork surface" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Right sleeve artwork surface" })).toBeInTheDocument();
  });

  it.each([
    ["Left sleeve", "sleeve-left"],
    ["Right sleeve", "sleeve-right"],
  ])("places armed artwork on the %s surface", (label, view) => {
    const onCommitPending = vi.fn();
    const onViewChange = vi.fn();
    render(
      <JerseyStage
        {...baseProps}
        pendingLayer={{ type: "logo" }}
        onCommitPending={onCommitPending}
        onViewChange={onViewChange}
      />,
    );

    const surface = screen.getByRole("group", { name: `${label} artwork surface` });
    surface.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {},
    });
    fireEvent.mouseDown(surface, { clientX: 60, clientY: 30 });

    expect(onViewChange).toHaveBeenCalledWith(view);
    expect(onCommitPending).toHaveBeenCalledWith({ x: 60, y: 30, view });
  });

  it("hides sleeve windows for a sleeveless garment", () => {
    render(<JerseyStage {...baseProps} sleeve="Sleeveless" />);
    expect(screen.queryByLabelText("Sleeve artwork windows")).not.toBeInTheDocument();
  });
});
