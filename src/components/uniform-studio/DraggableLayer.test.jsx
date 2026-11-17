import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DraggableLayer from "./DraggableLayer";

const layer = {
  id: "logo-1",
  type: "logo",
  src: "data:image/png;base64,AA==",
  x: 50,
  y: 45,
  size: 16,
  rotation: 0,
};

describe("DraggableLayer", () => {
  it("resizes selected artwork with the mouse wheel", () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();

    render(
      <DraggableLayer
        layer={layer}
        stageRef={{ current: document.createElement("div") }}
        selected
        onSelect={onSelect}
        onChange={onChange}
      />,
    );

    fireEvent.wheel(screen.getByRole("group"), { deltaY: -100 });

    expect(onSelect).toHaveBeenCalledWith("logo-1");
    expect(onChange).toHaveBeenCalledWith("logo-1", {
      x: 50,
      y: 45,
      size: 18,
      rotation: 0,
    });
  });

  it("moves and resizes selected artwork from the keyboard", () => {
    const onChange = vi.fn();

    render(
      <DraggableLayer
        layer={layer}
        stageRef={{ current: document.createElement("div") }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    const artwork = screen.getByRole("group");
    fireEvent.keyDown(artwork, { key: "ArrowRight" });
    fireEvent.keyDown(artwork, { key: "+" });

    expect(onChange).toHaveBeenNthCalledWith(1, "logo-1", {
      x: 51,
      y: 45,
      size: 16,
      rotation: 0,
    });
    expect(onChange).toHaveBeenNthCalledWith(2, "logo-1", {
      x: 50,
      y: 45,
      size: 18,
      rotation: 0,
    });
  });
});
