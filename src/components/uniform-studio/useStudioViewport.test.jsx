import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStudioViewport from "./useStudioViewport";

let viewport;
function Workspace() {
  const { shellRef, keyboardOpen, compact } = useStudioViewport();
  return <div ref={shellRef} data-testid="shell" data-keyboard-open={keyboardOpen} data-compact={compact}><textarea aria-label="Prompt" /><button>Minimize</button></div>;
}
beforeEach(() => {
  viewport = new EventTarget();
  viewport.height = 844;
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("matchMedia", () => Object.assign(new EventTarget(), { matches: true }));
  vi.spyOn(window.screen, "height", "get").mockReturnValue(844);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("studio visual viewport", () => {
  it("fits the visual viewport and retains keyboard layout until the keyboard closes", () => {
    render(<Workspace />);
    act(() => screen.getByRole("textbox").focus());
    act(() => { viewport.height = 440; viewport.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("shell")).toHaveAttribute("data-keyboard-open", "true");
    expect(screen.getByTestId("shell").style.getPropertyValue("--studio-viewport-height")).toBe("440px");
    act(() => screen.getByRole("button").focus());
    expect(screen.getByTestId("shell")).toHaveAttribute("data-keyboard-open", "true");
    act(() => { viewport.height = 844; viewport.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("shell")).toHaveAttribute("data-keyboard-open", "false");
  });
  it("does not treat landscape resizing without an input focus as a keyboard", () => {
    render(<Workspace />);
    act(() => { viewport.height = 390; viewport.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("shell")).toHaveAttribute("data-keyboard-open", "false");
  });
});
