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
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Select a fit to continue to Team roster");
    fireEvent.click(screen.getAllByRole("button", { name: fit, exact: true })[0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
    const saved = JSON.parse(window.localStorage.getItem("c767:studio:soccer:blank-canvas"));
    expect(saved.fitType).toBe(fit);
    expect(saved.fitTypeConfirmed).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Continue to Team roster/ }));
    expect(progress.getByRole("button", { name: /Team roster/ })).toHaveAttribute("aria-current", "step");
  });

  it("uses one jersey number, fit-linked garment sizes and an order-level socks quantity", () => {
    const progress = openStudio("design");
    fireEvent.click(screen.getAllByRole("button", { name: "Men", exact: true })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    expect(screen.getAllByText("Fit type: Men").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("textbox", { name: "Jersey number" }).length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Shirt #")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Shorts #")).not.toBeInTheDocument();
    expect(screen.queryByText("Sock size")).not.toBeInTheDocument();
    expect(screen.queryByText("Shorts length")).not.toBeInTheDocument();
    expect(screen.queryByText("Role")).not.toBeInTheDocument();

    for (const select of screen.getAllByRole("combobox", { name: "Shirt Size" })) {
      expect(Array.from(select.options).map((option) => option.value)).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    }
    expect(screen.getAllByText("Socks").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("spinbutton", { name: "Socks quantity" }).length).toBeGreaterThan(0);
  });

  it("validates the player name and adds a completed roster row", () => {
    const progress = openStudio("design");
    fireEvent.click(screen.getAllByRole("button", { name: "Men", exact: true })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    const addButtons = screen.getAllByRole("button", { name: "Add player" });
    fireEvent.click(addButtons[0]);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Enter the player's name");

    const nameInputs = screen.getAllByRole("textbox", { name: "Name" });
    fireEvent.change(nameInputs[0], { target: { value: "Alex James" } });
    fireEvent.click(addButtons[0]);

    expect(screen.getAllByText("Alex James").length).toBeGreaterThan(0);
    expect(nameInputs[0]).toHaveValue("");
    expect(screen.queryByText("Enter the player's name before adding this roster row.")).not.toBeInTheDocument();
  });

  it("moves supporter jersey quantities to Team roster and uses the Step 1 Shirt Only price", () => {
    const progress = openStudio("design");
    const shirtOnlyButtons = screen.getAllByRole("button", { name: /^Shirt Only/ });
    expect(shirtOnlyButtons[0]).toHaveTextContent("$12.00");
    expect(shirtOnlyButtons[0]).toHaveTextContent("supporter jerseys use this price");
    expect(screen.queryByText("Add Fan/Supporter Jerseys")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Men", exact: true })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    const socksHeading = screen.getAllByText("Socks")[0];
    const supporterHeading = screen.getAllByText("Add Fan/Supporter Jerseys")[0];
    expect(socksHeading.compareDocumentPosition(supporterHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText("Shirt Only · $12.00 each").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Add Fan\/Supporter Jerseys/ })[0]);
    expect(screen.getAllByRole("combobox", { name: "Supporter jersey size 1" }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Minimum order" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add player" })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Review & quote/ }));
    expect(screen.queryByText("Add Fan/Supporter Jerseys")).not.toBeInTheDocument();
    expect(screen.getAllByText(/1 supporter jersey × \$12\.00/).length).toBeGreaterThan(0);
  });

  it("offers Short or Long for each player when Mixed team order is selected", () => {
    const progress = openStudio("design");
    fireEvent.click(screen.getAllByRole("button", { name: "Men", exact: true })[0]);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Mixed team order" })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    expect(screen.getAllByRole("textbox", { name: "Name" }).length).toBeGreaterThan(0);
    expect(screen.queryByPlaceholderText("Player name")).not.toBeInTheDocument();
    for (const select of screen.getAllByRole("combobox", { name: "Sleeve length" })) {
      expect(Array.from(select.options).map((option) => option.value)).toEqual(["Short", "Long"]);
    }
    fireEvent.change(screen.getAllByRole("combobox", { name: "Sleeve length" })[0], { target: { value: "Long" } });
    expect(screen.getAllByText("+$2.00 per kit").length).toBeGreaterThan(0);
  });

  it.each([false, true])("restores only a previously confirmed fit (confirmed: %s)", async (confirmed) => {
    window.localStorage.setItem("c767:studio:soccer:blank-canvas", JSON.stringify({ fitType: "Men", fitTypeConfirmed: confirmed, zoneModel: { front: [], back: [] } }));
    render(<MemoryRouter initialEntries={["/uniforms"]}><UniformStudioPage /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByRole("heading", { name: "Soccer", exact: true }).closest("button")); });
    const progress = within(screen.getByRole("navigation", { name: "Uniform order progress" }));
    if (confirmed) {
      expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
      expect(screen.queryByText("Select a fit to continue to Team roster.")).not.toBeInTheDocument();
    } else {
      expect(progress.getByRole("button", { name: /Design/ })).toBeEnabled();
      expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    }
  });
});
