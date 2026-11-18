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
  it("renders stacked AI text and keeps its line breaks editable", () => {
    const onChange = vi.fn();
    render(
      <DraggableLayer
        layer={{ ...layer, id: "text-1", type: "text", text: "TEAM\nUNIFORM", textLayout: "stacked", color: "#fff" }}
        stageRef={{ current: document.createElement("div") }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.doubleClick(screen.getByText(/TEAM/));
    const editor = screen.getByRole("textbox", { name: "Edit uniform text" });
    expect(editor.tagName).toBe("TEXTAREA");
    expect(editor.value).toBe("TEAM\nUNIFORM");
    fireEvent.change(editor, { target: { value: "CONNECT\n767" } });
    expect(onChange).toHaveBeenCalledWith("text-1", { text: "CONNECT\n767" });
  });

  it("renders the selected text case, alignment, spacing, weight and effects", () => {
    render(
      <DraggableLayer
        layer={{
          ...layer,
          id: "styled-text",
          type: "text",
          text: "Team Name",
          color: "#ffffff",
          textTransform: "none",
          textAlign: "left",
          fontWeight: 900,
          italic: true,
          letterSpacing: 2.4,
          outline: true,
          shadow: true,
        }}
        stageRef={{ current: document.createElement("div") }}
        selected
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Team Name")).toHaveStyle({
      textTransform: "none",
      textAlign: "left",
      fontWeight: "900",
      fontStyle: "italic",
      letterSpacing: "2.4px",
      WebkitTextStroke: "1.5px #1b1a16",
      textShadow: "0 3px 6px rgba(0,0,0,0.38)",
    });
  });

  it("allows production text to shrink below the former six-point minimum", () => {
    const onChange = vi.fn();
    render(
      <DraggableLayer
        layer={{ ...layer, id: "small-text", type: "text", text: "TEAM", size: 1, color: "#fff" }}
        stageRef={{ current: document.createElement("div") }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.wheel(screen.getByRole("group"), { deltaY: 100 });
    expect(onChange).toHaveBeenCalledWith("small-text", {
      x: 50,
      y: 45,
      size: 0.5,
      rotation: 0,
    });
    expect(screen.getByText("TEAM")).toHaveStyle({ fontSize: "5.33px" });
  });

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

  it("preserves the current resized dimensions when artwork is dragged", () => {
    const onChange = vi.fn();
    const stage = document.createElement("div");
    stage.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const { rerender } = render(
      <DraggableLayer
        layer={layer}
        stageRef={{ current: stage }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    const resizedLayer = { ...layer, size: 40, rotation: 15 };
    rerender(
      <DraggableLayer
        layer={resizedLayer}
        stageRef={{ current: stage }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("group"), { clientX: 50, clientY: 45 });
    fireEvent.mouseMove(window, { clientX: 60, clientY: 50 });
    fireEvent.mouseUp(window);

    expect(onChange).toHaveBeenLastCalledWith("logo-1", {
      x: 60,
      y: 50,
      size: 40,
      rotation: 15,
    });
  });

  it("rotates artwork without restoring stale position or size values", () => {
    const onChange = vi.fn();
    const stage = document.createElement("div");
    stage.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const { rerender } = render(
      <DraggableLayer
        layer={layer}
        stageRef={{ current: stage }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    const transformedLayer = { ...layer, x: 60, y: 55, size: 40, rotation: 15 };
    rerender(
      <DraggableLayer
        layer={transformedLayer}
        stageRef={{ current: stage }}
        selected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    const artwork = screen.getByRole("group");
    artwork.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.mouseDown(screen.getByRole("button", { name: "Rotate" }), { clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 100, clientY: 50 });
    fireEvent.mouseUp(window);

    expect(onChange).toHaveBeenLastCalledWith("logo-1", {
      x: 60,
      y: 55,
      size: 40,
      rotation: 90,
    });
  });
});
