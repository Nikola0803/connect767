import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UniformStudioPage from "./UniformStudioPage";

vi.mock("../components/uniform-studio/JerseyStage", () => ({ default: () => <div>Uniform preview</div> }));

function openStudio(step = "design") {
  render(<MemoryRouter initialEntries={[`/uniforms?sport=soccer&mode=scratch&step=${step}`]}><UniformStudioPage /></MemoryRouter>);
  return within(screen.getByRole("navigation", { name: "Uniform order progress" }));
}

describe("required uniform fit selection", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts in the combined Design step and requires fit before Team roster", () => {
    const progress = openStudio("ai");
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Continue to Team roster/ })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: /AI Designer/ })) expect(button).toBeEnabled();
  });

  it("shows header controls only when the active mode has a working target", () => {
    const progress = openStudio("ai");
    const header = within(screen.getByRole("button", { name: "Back" }).closest("header"));
    expect(header.getByRole("button", { name: /AI Designer/ })).toBeEnabled();
    expect(header.queryByRole("button", { name: "Zoom out" })).not.toBeInTheDocument();
    fireEvent.click(progress.getByRole("button", { name: /Design/ }));
    expect(header.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    expect(header.getByRole("button", { name: "Zoom in" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Zoom out" })).toHaveLength(1);
  });

  it.each(["Men", "Women", "Youth"])("unlocks Step 2 Team roster after selecting %s in Design", (fit) => {
    const progress = openStudio("ai");
    fireEvent.click(progress.getByRole("button", { name: /Design/ }));
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("before continuing to Team roster");
    fireEvent.click(screen.getAllByRole("button", { name: fit, exact: true })[0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
    const saved = JSON.parse(window.localStorage.getItem("c767:studio:soccer:blank-canvas"));
    expect(saved.fitType).toBe(fit);
    expect(saved.fitTypeConfirmed).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Continue to Team roster/ }));
    expect(progress.getByRole("button", { name: /Team roster/ })).toHaveAttribute("aria-current", "step");
  });

  it.each([false, true])("restores only a previously confirmed fit (confirmed: %s)", async (confirmed) => {
    window.localStorage.setItem("c767:studio:soccer:blank-canvas", JSON.stringify({ fitType: "Men", fitTypeConfirmed: confirmed, zoneModel: { front: [], back: [] } }));
    render(<MemoryRouter initialEntries={["/uniforms"]}><UniformStudioPage /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("heading", { name: "Soccer", exact: true }).closest("button")); });
    const progress = within(screen.getByRole("navigation", { name: "Uniform order progress" }));
    if (confirmed) {
      expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
      expect(screen.queryByText("Fit selection required")).not.toBeInTheDocument();
    } else {
      expect(progress.getByRole("button", { name: /Design/ })).toBeEnabled();
      expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    }
  });
});
