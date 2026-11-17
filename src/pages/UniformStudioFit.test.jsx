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

  it("starts without a fit and blocks Step 2 and the AI shortcut with a visible warning", () => {
    const progress = openStudio("ai");
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Choose Men, Women or Youth to unlock Step 2.");
    for (const fit of ["Men", "Women", "Youth"]) {
      for (const choice of screen.getAllByRole("button", { name: fit, exact: true })) expect(choice).toHaveAttribute("aria-pressed", "false");
    }
    expect(progress.getByRole("button", { name: /Artwork/ })).toBeDisabled();
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Continue to Artwork/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /AI Designer/ })).toBeDisabled();
  });

  it.each(["Men", "Women", "Youth"])("unlocks Step 2 after explicitly selecting %s", (fit) => {
    const progress = openStudio("ai");
    fireEvent.click(screen.getAllByRole("button", { name: fit, exact: true })[0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Artwork/ })).toBeEnabled();
    expect(progress.getByRole("button", { name: /Uniform/ })).toHaveAttribute("aria-current", "step");
    const saved = JSON.parse(window.localStorage.getItem("c767:studio:soccer:blank-canvas"));
    expect(saved.fitType).toBe(fit);
    expect(saved.fitTypeConfirmed).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Continue to Artwork/ }));
    expect(progress.getByRole("button", { name: /Artwork/ })).toHaveAttribute("aria-current", "step");
  });

  it.each([false, true])("restores only a previously confirmed fit (confirmed: %s)", async (confirmed) => {
    window.localStorage.setItem("c767:studio:soccer:blank-canvas", JSON.stringify({ fitType: "Men", fitTypeConfirmed: confirmed, zoneModel: { front: [], back: [] } }));
    render(<MemoryRouter initialEntries={["/uniforms"]}><UniformStudioPage /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("heading", { name: "Soccer", exact: true }).closest("button")); });
    const progress = within(screen.getByRole("navigation", { name: "Uniform order progress" }));
    if (confirmed) {
      expect(progress.getByRole("button", { name: /Artwork/ })).toBeEnabled();
      expect(screen.queryByText("Fit selection required")).not.toBeInTheDocument();
    } else {
      expect(progress.getByRole("button", { name: /Artwork/ })).toBeDisabled();
      expect(screen.getAllByText("Fit selection required")[0]).toBeVisible();
    }
  });
});
