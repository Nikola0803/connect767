import { useMemo, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useDesignHistory from "./useDesignHistory";

function Editor({ enabled = true, identity = "soccer" }) {
  const [layers, setLayers] = useState([]);
  const [color, setColor] = useState("green");
  const snapshot = useMemo(() => ({ layers, color }), [layers, color]);
  const history = useDesignHistory({ enabled, identity, snapshot, onRestore: (saved) => { setLayers(saved.layers); setColor(saved.color); } });
  return <>
    <output>{color}:{layers.length}</output>
    <button onClick={() => setLayers((current) => [...current, { id: current.length, text: "Team" }])}>Add text</button>
    <button onClick={() => setColor("blue")}>Blue</button>
    <button onClick={history.undo} disabled={!history.canUndo}>Undo</button>
    <button onClick={history.redo} disabled={!history.canRedo}>Redo</button>
  </>;
}
describe("editable garment history", () => {
  it("restores artwork and colors across undo and redo", () => {
    render(<Editor />);
    fireEvent.click(screen.getByText("Add text"));
    fireEvent.click(screen.getByText("Blue"));
    expect(screen.getByRole("status")).toHaveTextContent("blue:1");
    fireEvent.click(screen.getByText("Undo"));
    expect(screen.getByRole("status")).toHaveTextContent("green:1");
    fireEvent.click(screen.getByText("Undo"));
    expect(screen.getByRole("status")).toHaveTextContent("green:0");
    fireEvent.click(screen.getByText("Redo"));
    expect(screen.getByRole("status")).toHaveTextContent("green:1");
  });
  it("drops the redo branch after a new edit and isolates categories", () => {
    const { rerender } = render(<Editor />);
    fireEvent.click(screen.getByText("Add text"));
    fireEvent.click(screen.getByText("Undo"));
    fireEvent.click(screen.getByText("Blue"));
    expect(screen.getByText("Redo")).toBeDisabled();
    rerender(<Editor identity="cricket" />);
    expect(screen.getByText("Undo")).toBeDisabled();
  });
  it("does not enable manual history for AI-only images", () => {
    render(<Editor enabled={false} />);
    fireEvent.click(screen.getByText("Add text"));
    expect(screen.getByText("Undo")).toBeDisabled();
    expect(screen.getByText("Redo")).toBeDisabled();
  });
});
