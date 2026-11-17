import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SelectedItemPanel from "./SelectedItemPanel";

const logo = {
  id: "logo-1",
  type: "logo",
  src: "data:image/png;base64,AA==",
  x: 50,
  y: 45,
  size: 34,
  rotation: 0,
};

describe("SelectedItemPanel", () => {
  it("connects all selected-logo controls to the active 2D layer", () => {
    const onScaleChange = vi.fn();
    const onRotateChange = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    render(
      <SelectedItemPanel
        layer={logo}
        placement={null}
        onScaleChange={onScaleChange}
        onRotateChange={onRotateChange}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );

    fireEvent.change(screen.getByLabelText("Size"), { target: { value: "46" } });
    fireEvent.click(screen.getByRole("button", { name: "Rotate selected artwork left" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate selected artwork right" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove selected logo" }));

    expect(onScaleChange).toHaveBeenCalledWith("logo-1", 46);
    expect(onRotateChange).toHaveBeenNthCalledWith(1, "logo-1", -1);
    expect(onRotateChange).toHaveBeenNthCalledWith(2, "logo-1", 1);
    expect(onDuplicate).toHaveBeenCalledWith("logo-1");
    expect(onDelete).toHaveBeenCalledWith("logo-1");
  });
});
