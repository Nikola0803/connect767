import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BackgroundRemovalPanel } from "./StudioPanels";

describe("BackgroundRemovalPanel", () => {
  it("converts an uploaded image and passes a transparent PNG to placement", async () => {
    const processor = vi.fn().mockResolvedValue(new Blob(["transparent"], { type: "image/png" }));
    const onPlace = vi.fn();
    const { container } = render(<BackgroundRemovalPanel processor={processor} onPlace={onPlace} />);
    const input = container.querySelector('input[type="file"]');
    const photo = new File(["photo"], "team-photo.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [photo] } });
    await screen.findByAltText("Original upload");
    fireEvent.click(screen.getByRole("button", { name: "Remove background" }));

    await screen.findByAltText("Transparent result");
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
    expect(screen.getByText("Sign in and complete payment to unlock image downloads.")).toBeVisible();
    expect(processor).toHaveBeenCalledWith(photo, expect.any(Function));
    fireEvent.click(screen.getByRole("button", { name: "Place on uniform" }));
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace.mock.calls[0][0]).toMatchObject({ name: "team-photo-transparent.png", type: "image/png" });
  });

  it("rejects unsupported uploads before processing", async () => {
    const processor = vi.fn();
    const { container } = render(<BackgroundRemovalPanel processor={processor} onPlace={() => {}} />);
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [new File(["pdf"], "logo.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("PNG, JPEG or WebP");
    expect(processor).not.toHaveBeenCalled();
  });
});
