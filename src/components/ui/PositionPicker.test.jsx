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
    const onZoomChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/cover.jpg"
        shape="cover"
        position="center"
        zoom={1}
        fit="contain"
        onPositionChange={onPositionChange}
        onZoomChange={onZoomChange}
        onFitChange={onFitChange}
      />,
    );

    const handle = screen.getByRole("button", { name: "Reposition photo" });
    expect(handle.parentElement).not.toHaveClass("absolute");
    expect(handle.parentElement).toHaveClass("mt-3");
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 115, clientY: 108 });
    fireEvent.mouseUp(window);

    expect(onFitChange).toHaveBeenCalledWith("cover");
    expect(onZoomChange).toHaveBeenCalledWith(1.1);
    expect(onPositionChange).toHaveBeenCalled();
  });

  it("moves a square cover image vertically from the reposition handle", () => {
    const onPositionChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/square-logo.jpg"
        shape="cover"
        position="center"
        zoom={1}
        fit="cover"
        onPositionChange={onPositionChange}
        onZoomChange={vi.fn()}
        onFitChange={vi.fn()}
      />,
    );

    const image = screen.getByAltText("Position preview");
    Object.defineProperties(image, {
      naturalWidth: { value: 1000 },
      naturalHeight: { value: 1000 },
    });
    fireEvent.load(image);
    image.parentElement.getBoundingClientRect = () => ({
      width: 400,
      height: 225,
      left: 0,
      top: 0,
      right: 400,
      bottom: 225,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(screen.getByRole("button", { name: "Reposition photo" }), {
      clientX: 100,
      clientY: 100,
    });
    fireEvent.mouseMove(window, { clientX: 100, clientY: 140 });
    fireEvent.mouseUp(window);

    expect(onPositionChange).toHaveBeenLastCalledWith("50% 31%");
  });

  it("shows the same working reposition and zoom toolbar on profile photos", () => {
    const onPositionChange = vi.fn();
    const onZoomChange = vi.fn();
    render(
      <PositionPicker
        src="https://example.com/profile.jpg"
        shape="logo"
        position="center"
        zoom={1.2}
        onPositionChange={onPositionChange}
        onZoomChange={onZoomChange}
      />,
    );

    const handle = screen.getByRole("button", { name: "Reposition photo" });
    expect(handle.parentElement).not.toHaveClass("absolute");
    expect(handle.parentElement).toHaveClass("mt-3");
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 112, clientY: 105 });
    fireEvent.mouseUp(window);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(onPositionChange).toHaveBeenCalled();
    expect(onZoomChange).toHaveBeenCalledWith(1.3);
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
