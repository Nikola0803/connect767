import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PositionPicker from "./PositionPicker";

describe("PositionPicker cover controls", () => {
  it("shows the full-image mode and exposes a clear reposition icon control", () => {
    render(
      <PositionPicker
        src="https://example.com/cover.jpg"
        shape="cover"
        position="center"
        zoom={1}
        fit="contain"
        onPositionChange={vi.fn()}
        onZoomChange={vi.fn()}
        onFitChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Fit full image" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reposition" })).toBeInTheDocument();
    expect(screen.getByText(/entire photo is visible/i)).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeDisabled();
    expect(screen.queryByText("Drag to reposition")).not.toBeInTheDocument();
  });

  it("switches to reposition mode when requested", () => {
    const onFitChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/cover.jpg"
        shape="cover"
        position="center"
        zoom={1}
        fit="contain"
        onPositionChange={vi.fn()}
        onZoomChange={vi.fn()}
        onFitChange={onFitChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reposition" }));
    expect(onFitChange).toHaveBeenCalledWith("cover");
  });

  it("activates repositioning from the photo toolbar", () => {
    const onFitChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/cover.jpg"
        shape="cover"
        position="center"
        zoom={1}
        fit="contain"
        onPositionChange={vi.fn()}
        onZoomChange={vi.fn()}
        onFitChange={onFitChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reposition photo" }));
    expect(onFitChange).toHaveBeenCalledWith("cover");
  });

  it("uses the reposition icon as a working drag handle", () => {
    const onFitChange = vi.fn();
    const onPositionChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/cover.jpg"
        shape="cover"
        position="center"
        zoom={1}
        fit="contain"
        onPositionChange={onPositionChange}
        onZoomChange={vi.fn()}
        onFitChange={onFitChange}
      />,
    );

    const handle = screen.getByRole("button", { name: "Reposition photo" });
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 115, clientY: 108 });
    fireEvent.mouseUp(window);

    expect(onFitChange).toHaveBeenCalledWith("cover");
    expect(onPositionChange).toHaveBeenCalled();
  });

  it("changes zoom from the photo toolbar icons", () => {
    const onZoomChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/cover.jpg"
        shape="cover"
        position="center"
        zoom={1.2}
        fit="cover"
        onPositionChange={vi.fn()}
        onZoomChange={onZoomChange}
        onFitChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onZoomChange).toHaveBeenLastCalledWith(1.3);

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(onZoomChange).toHaveBeenLastCalledWith(1.1);
  });
});
