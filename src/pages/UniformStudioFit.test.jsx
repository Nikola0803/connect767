import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UniformStudioPage from "./UniformStudioPage";

vi.mock("../components/uniform-studio/JerseyStage", () => ({ default: () => <div>Uniform preview</div> }));

function openStudio(step = "design") {
  render(<MemoryRouter initialEntries={[`/uniforms?sport=soccer&mode=scratch&step=${step}`]}><UniformStudioPage /></MemoryRouter>);
  return within(screen.getByRole("navigation", { name: "Uniform order progress" }));
}

function openUniformSetup() {
  return within(screen.getByRole("complementary", { name: "Uniform & order setup" }));
}

function closeUniformSetup() {}

describe("required uniform fit selection", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts in the combined Design step and requires fit before Team roster", () => {
    const progress = openStudio("ai");
    const setup = openUniformSetup();
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: /Continue to Team roster/ })) expect(button).toBeDisabled();
    expect(setup.getByRole("button", { name: /Continue to Team roster/ })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: /AI Designer/ })) expect(button).toBeEnabled();
  });

  it("keeps Step 1 AI-only and hides the legacy manual design tools", () => {
    const progress = openStudio("ai");
    const header = within(screen.getByRole("button", { name: "Back" }).closest("header"));
    expect(header.getByRole("button", { name: /AI Designer/ })).toBeEnabled();
    expect(header.queryByRole("button", { name: "Zoom out" })).not.toBeInTheDocument();
    fireEvent.click(progress.getByRole("button", { name: /Design/ }));
    expect(header.queryByRole("button", { name: "Zoom out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uniform setup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logo" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Uniform & order setup" })).toBeVisible();
    const productionExtras = screen.getByRole("region", { name: "Production extras" });
    expect(within(productionExtras).getByRole("group", { name: "Collar options" })).toBeVisible();
    expect(within(productionExtras).getByRole("group", { name: "Sleeve options" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Garment part colors" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Production Mode" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Save progress" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "SVG" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Open uniform and order setup" })).not.toBeInTheDocument();
    const promptTools = within(screen.getAllByLabelText("AI prompt tools")[0]);
    expect(promptTools.getByRole("button", { name: "New design" })).toBeVisible();
    expect(promptTools.getByRole("button", { name: "AI tools" })).toBeVisible();
    fireEvent.click(promptTools.getByRole("button", { name: "AI tools" }));
    const promptMenu = screen.getByRole("menu", { name: "AI prompt tools menu" });
    expect(within(promptMenu).getByRole("menuitem", { name: "History" })).toBeVisible();
    expect(within(promptMenu).getByRole("menuitem", { name: "Reference" })).toBeVisible();
    expect(within(promptMenu).getByRole("menuitem", { name: "Artwork" })).toBeVisible();
    expect(within(promptMenu).getByRole("menuitem", { name: "Refine with AI" })).toBeVisible();
    expect(screen.getAllByRole("region", { name: "AI command prompt" })[0]).toBeVisible();
    expect(screen.getAllByRole("textbox", { name: "Message Connect767 AI" })[0]).toBeVisible();
  });

  it.each(["Men", "Women", "Youth"])("unlocks Step 2 Team roster after selecting %s in Design", (fit) => {
    const progress = openStudio("ai");
    fireEvent.click(progress.getByRole("button", { name: /Design/ }));
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    const setup = openUniformSetup();
    expect(setup.getByRole("alert")).toHaveTextContent("Select a fit to continue to Team roster");
    fireEvent.click(setup.getByRole("button", { name: fit, exact: true }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
    expect(setup.getByRole("button", { name: /Continue to Team roster/ })).toBeEnabled();
    const saved = JSON.parse(window.localStorage.getItem("c767:studio:soccer:blank-canvas"));
    expect(saved.fitType).toBe(fit);
    expect(saved.fitTypeConfirmed).toBe(true);
    fireEvent.click(setup.getByRole("button", { name: /Continue to Team roster/ }));
    expect(progress.getByRole("button", { name: /Team roster/ })).toHaveAttribute("aria-current", "step");
  });

  it("requires an inside-collar message or attachment before Step 2", () => {
    const progress = openStudio("design");
    const setup = openUniformSetup();
    fireEvent.click(setup.getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(setup.getByRole("button", { name: "Yes", exact: true }));

    expect(setup.getByRole("alert")).toHaveTextContent("Enter an inside-collar message or attach a logo/artwork file.");
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: /Continue to Team roster/ })) {
      expect(button).toBeDisabled();
    }

    fireEvent.change(setup.getByPlaceholderText("Message for the inside collar"), { target: { value: "ONE TEAM" } });
    expect(setup.queryByRole("alert")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
    expect(setup.getByRole("button", { name: /Continue to Team roster/ })).toBeEnabled();
    fireEvent.click(setup.getByRole("button", { name: /Continue to Team roster/ }));
    expect(progress.getByRole("button", { name: /Team roster/ })).toHaveAttribute("aria-current", "step");
  });

  it("uses one jersey number, fit-linked garment sizes and an order-level socks quantity", () => {
    const progress = openStudio("design");
    fireEvent.click(openUniformSetup().getByRole("button", { name: "Men", exact: true }));
    closeUniformSetup();
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

  it("requires one socks quantity per full kit before Review & quote", () => {
    const progress = openStudio("design");
    fireEvent.click(openUniformSetup().getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Minimum team" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add player" })[0]);

    const socksInput = screen.getAllByRole("spinbutton", { name: "Socks quantity" })[0];
    expect(socksInput).toHaveValue(22);
    expect(socksInput).toHaveAttribute("min", "22");
    expect(socksInput).toHaveAttribute("max", "22");
    expect(progress.getByRole("button", { name: /Review & quote/ })).toBeEnabled();

    fireEvent.change(socksInput, { target: { value: "0" } });
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Socks quantity must be 22 to match the full-kit order.");
    expect(progress.getByRole("button", { name: /Review & quote/ })).toBeDisabled();

    fireEvent.change(socksInput, { target: { value: "22" } });
    expect(screen.queryByText("Socks quantity must be 22 to match the full-kit order.")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Review & quote/ })).toBeEnabled();
  });

  it("validates the player name and adds a completed roster row", () => {
    const progress = openStudio("design");
    fireEvent.click(openUniformSetup().getByRole("button", { name: "Men", exact: true }));
    closeUniformSetup();
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
    const setup = openUniformSetup();
    const shirtOnlyButton = setup.getByRole("button", { name: /^Shirt Only/ });
    expect(shirtOnlyButton).toHaveTextContent("$12.00");
    expect(shirtOnlyButton).toHaveTextContent("supporter jerseys use this price");
    expect(setup.queryByText("Add extra shirts to your full-kit team order.")).not.toBeInTheDocument();
    expect(setup.queryByLabelText("Extra shirt quantity 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Add Fan/Supporter Jerseys")).not.toBeInTheDocument();

    fireEvent.click(setup.getByRole("button", { name: "Men", exact: true }));
    closeUniformSetup();
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

  it("does not add a hidden extra-shirt charge when Shirt Only pricing is viewed", () => {
    const progress = openStudio("design");
    const setup = openUniformSetup();
    fireEvent.click(setup.getByRole("button", { name: /^Shirt Only/ }));
    fireEvent.click(setup.getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Minimum order" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add player" })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Review & quote/ }));

    expect(screen.queryByText(/^\d+ extra shirts? × \$12\.00$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/22 full kits/).length).toBeGreaterThan(0);
  });

  it("offers Short or Long for each player when Mixed Sleeve Team Order is selected", () => {
    const progress = openStudio("design");
    const setup = openUniformSetup();
    fireEvent.click(setup.getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(setup.getByRole("checkbox", { name: "Mixed Sleeve Team Order" }));
    closeUniformSetup();
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
