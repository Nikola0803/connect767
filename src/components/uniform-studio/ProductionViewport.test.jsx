import { useRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductionViewport from "./ProductionViewport";

function Preview({ panMode = false, placingArtwork = false, onArtworkDown, onArtworkWheel }) {
  const [zoom, setZoom] = useState(1);
  const ref = useRef(null);
  return <>
    <button onClick={() => ref.current.reset()}>Fit</button>
    <output aria-label="Zoom">{zoom}</output>
    <ProductionViewport ref={ref} zoom={zoom} onZoomChange={setZoom} panMode={panMode} placingArtwork={placingArtwork}>
      <div>Garment background</div>
      <div data-zone-id="front-body">Shirt body</div>
      <div data-production-layer="crest" onPointerDown={onArtworkDown} onWheel={onArtworkWheel}>Team logo</div>
      <button>Front</button>
      <textarea aria-label="Artwork text" />
    </ProductionViewport>
  </>;
}

describe("production viewport", () => {
  beforeEach(() => {
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      constructor(type, options = {}) { super(type, options); this.pointerId = options.pointerId || 1; this.pointerType = options.pointerType || "mouse"; }
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("zooms with the wheel and pans blank space without changing artwork", () => {
    const onArtworkDown = vi.fn();
    const { container } = render(<Preview onArtworkDown={onArtworkDown} />);
    const viewport = screen.getByRole("group", { name: "Production map viewport" });
    fireEvent.wheel(screen.getByText("Garment background"), { deltaY: -100 });
    expect(screen.getByLabelText("Zoom")).toHaveTextContent("1.1");
    fireEvent.pointerDown(screen.getByText("Garment background"), { button: 0, clientX: 10, clientY: 20 });
    fireEvent.pointerMove(viewport, { clientX: 60, clientY: 50 });
    fireEvent.pointerUp(viewport);
    expect(container.querySelector('[data-production-transform]').style.transform).toBe("translate3d(50px, 30px, 0) scale(1.1)");
    expect(onArtworkDown).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Fit"));
    expect(container.querySelector('[data-production-transform]').style.transform).toBe("translate3d(0px, 0px, 0) scale(1)");
  });

  it("preserves artwork drag, resize and text editing in edit mode", () => {
    const onArtworkDown = vi.fn();
    const onArtworkWheel = vi.fn();
    render(<Preview onArtworkDown={onArtworkDown} onArtworkWheel={onArtworkWheel} />);
    const logo = screen.getByText("Team logo");
    fireEvent.pointerDown(logo, { button: 0 });
    fireEvent.wheel(logo, { deltaY: -100 });
    expect(onArtworkDown).toHaveBeenCalledOnce();
    expect(onArtworkWheel).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Zoom")).toHaveTextContent("1");
    fireEvent.keyDown(screen.getByLabelText("Artwork text"), { key: "+" });
    expect(screen.getByLabelText("Zoom")).toHaveTextContent("1");
    fireEvent.wheel(logo, { deltaY: -100, ctrlKey: true });
    expect(screen.getByLabelText("Zoom")).toHaveTextContent("1.1");
    expect(onArtworkWheel).toHaveBeenCalledOnce();
  });

  it("zooms over garment zones and keeps view buttons usable in hand mode", () => {
    render(<Preview panMode />);
    fireEvent.wheel(screen.getByText("Shirt body"), { deltaY: -100 });
    expect(screen.getByLabelText("Zoom")).toHaveTextContent("1.1");
    expect(fireEvent.pointerDown(screen.getByText("Front"), { button: 0 })).toBe(true);
  });

  it("fits the complete map inside short viewports without changing the export surface", () => {
    let resize;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<Preview />);
    const viewport = screen.getByRole("group", { name: "Production map viewport" });
    const content = container.querySelector('[data-production-transform]');
    Object.defineProperties(viewport, { clientWidth: { value: 800 }, clientHeight: { value: 200 } });
    Object.defineProperties(content, { offsetWidth: { value: 800 }, offsetHeight: { value: 400 } });
    act(() => resize());
    expect(content.style.transform).toBe("translate3d(0px, 0px, 0) scale(0.5)");
    expect(screen.getByText("Garment background").style.transform).toBe("");
  });

  it("pans over the garment in hand mode but preserves click-to-place", () => {
    const onArtworkDown = vi.fn();
    const { container, rerender } = render(<Preview panMode onArtworkDown={onArtworkDown} />);
    const viewport = screen.getByRole("group", { name: "Production map viewport" });
    fireEvent.pointerDown(screen.getByText("Team logo"), { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(viewport, { clientX: 40, clientY: 50 });
    fireEvent.pointerUp(viewport);
    expect(container.querySelector('[data-production-transform]').style.transform).toContain("translate3d(20px, 30px, 0)");
    expect(onArtworkDown).not.toHaveBeenCalled();
    rerender(<Preview panMode placingArtwork onArtworkDown={onArtworkDown} />);
    fireEvent.pointerDown(screen.getByText("Team logo"), { button: 0 });
    expect(onArtworkDown).toHaveBeenCalledOnce();
  });

  it("supports keyboard pan, zoom and reset", () => {
    const { container } = render(<Preview />);
    const viewport = screen.getByRole("group", { name: "Production map viewport" });
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    fireEvent.keyDown(viewport, { key: "+" });
    expect(container.querySelector('[data-production-transform]').style.transform).toBe("translate3d(16px, 0px, 0) scale(1.1)");
    fireEvent.keyDown(viewport, { key: "0" });
    expect(container.querySelector('[data-production-transform]').style.transform).toBe("translate3d(0px, 0px, 0) scale(1)");
  });

  it("pinches with two touches without moving artwork and recovers after cancellation", () => {
    const onArtworkDown = vi.fn();
    const { container } = render(<Preview panMode onArtworkDown={onArtworkDown} />);
    const viewport = screen.getByRole("group", { name: "Production map viewport" });
    fireEvent.pointerDown(viewport, { pointerId: 1, pointerType: "touch", clientX: 50, clientY: 50 });
    fireEvent.pointerDown(viewport, { pointerId: 2, pointerType: "touch", clientX: 150, clientY: 50 });
    fireEvent.pointerMove(viewport, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 50 });
    expect(screen.getByLabelText("Zoom")).toHaveTextContent("1.5");
    expect(onArtworkDown).not.toHaveBeenCalled();
    fireEvent.pointerCancel(viewport, { pointerId: 2, pointerType: "touch" });
    fireEvent.click(screen.getByText("Fit"));
    expect(container.querySelector('[data-production-transform]').style.transform).toContain("scale(1)");
  });
});
