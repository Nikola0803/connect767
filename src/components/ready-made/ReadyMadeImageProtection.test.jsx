import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useReadyMadeImageProtection from "../../hooks/useReadyMadeImageProtection";
import { ReadyMadeCaptureShield, ReadyMadeImageWatermark } from "./ReadyMadeImageProtection";

function ProtectedFixture() {
  const active = useReadyMadeImageProtection(true);
  return <><div data-protected-ready-made="true"><img alt="Ready-made kit" src="/kit.png" /><ReadyMadeImageWatermark /></div><ReadyMadeCaptureShield active={active} /></>;
}

describe("ready-made image protection", () => {
  it("keeps a visible Connect767 watermark over protected product images", () => {
    render(<ProtectedFixture />);
    expect(screen.getByTestId("ready-made-image-watermark")).toBeVisible();
    expect(screen.getAllByText("Connect767 Protected Preview")).toHaveLength(3);
  });

  it("shows the capture shield for common screenshot shortcuts", () => {
    render(<ProtectedFixture />);
    fireEvent.keyDown(document, { key: "PrintScreen" });
    expect(screen.getByTestId("ready-made-capture-shield")).toBeVisible();
  });

  it("blocks context-menu access on protected images", () => {
    render(<ProtectedFixture />);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    screen.getByRole("img", { name: "Ready-made kit" }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
