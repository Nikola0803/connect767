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
});
