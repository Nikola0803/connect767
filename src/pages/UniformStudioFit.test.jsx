import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UniformStudioPage from "./UniformStudioPage";
import { defaultZoneColors } from "../data/uniforms";
import { CartProvider } from "../hooks/useCart";

vi.mock("../components/uniform-studio/JerseyStage", () => ({ default: () => <div>Uniform preview</div> }));

function openStudio(step = "design") {
  render(<MemoryRouter initialEntries={[`/uniforms?sport=soccer&mode=scratch&step=${step}`]}><UniformStudioPage /></MemoryRouter>);
  return within(screen.getByRole("navigation", { name: "Uniform order progress" }));
}

function openUniformSetup() {
  return within(screen.getByRole("complementary", { name: "Uniform & order setup" }));
}

function closeUniformSetup() {}

function sportsFromButtons(panel) {
  return within(panel.getByRole("list", { name: "Available sport categories" }))
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label").replace(/ category$/, ""));
}

describe("required uniform fit selection", () => {
  beforeEach(() => window.localStorage.clear());

  it.each(["soccer", "basketball", "netball", "cricket", "goalkeeper", "other"])("shows the distinct AI-generated %s example without production boundaries", (sport) => {
    render(<MemoryRouter initialEntries={[`/uniforms?sport=${sport}&mode=scratch`]}><UniformStudioPage /></MemoryRouter>);
    const image = screen.getByRole("img", { name: `AI-generated ${sport} uniform example, front, side and back` });
    expect(image).toHaveAttribute("src", `/uploads/ai-uniform-samples/${sport}-views.webp`);
    expect(screen.queryByLabelText("Garment views")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Editable garment tools")).not.toBeInTheDocument();
    expect(screen.getByTestId("uniform-foundation").querySelector("svg, [data-zone-id]")).toBeNull();
  });

  it("restores a saved AI preview on a direct studio link before autosave writes", () => {
    const src = "data:image/png;base64,test-preview";
    window.localStorage.setItem("c767:studio:soccer:blank-canvas", JSON.stringify({
      aiWorkspaceConcept: { src, name: "Saved team kit", backgroundBranding: "connect767-embossed-v1" },
      aiUniformPlan: { name: "Saved team kit", summary: "Saved direction" },
      layers: [], categoryConfirmed: true, fitType: "Women", fitTypeConfirmed: true,
    }));
    openStudio();
    expect(screen.getByRole("img", { name: /Saved team kit complete/ })).toHaveAttribute("src", src);
    expect(screen.getByTestId("protected-design-preview")).toHaveAttribute("data-protected-design-preview", "true");
    expect(screen.getByTestId("protected-design-watermark")).toBeVisible();
    fireEvent.keyDown(document, { key: "PrintScreen" });
    expect(screen.getByTestId("capture-shield")).toHaveTextContent("Screen capture, copying and printing are disabled");
    expect(JSON.parse(window.localStorage.getItem("c767:studio:soccer:blank-canvas")).aiWorkspaceConcept.src).toBe(src);
    expect(screen.queryByRole("combobox", { name: "Editable garment tools" })).not.toBeInTheDocument();
  });

  it.each(["design", "logo", "zones"])("restores legacy production projects as AI-only, including a direct %s link", (step) => {
    const src = "data:image/png;base64,test-preview";
    const saved = {
      aiUniformPlan: { name: "Saved kit", conceptImage: { src, backgroundBranding: "connect767-embossed-v1" }, collar: "Crew", sleeve: "Short", colors: defaultZoneColors, productionElements: [] },
      aiDesignApplied: true, layers: [{ id: "saved-logo", type: "logo", src, view: "front", x: 50, y: 35, size: 20 }], categoryConfirmed: true, fitType: "Men", fitTypeConfirmed: true,
    };
    window.localStorage.setItem("c767:studio:soccer:blank-canvas", JSON.stringify(saved));
    openStudio(step);
    expect(screen.getByTestId("studio-canvas").querySelector(".studio-canvas-image")).toHaveAttribute("src", src);
    expect(screen.getByRole("textbox", { name: "Message Connect767 AI" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Editable garment tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo garment edit" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Garment views")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Production map|Open Production Mode|SVG/i })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("c767:studio:soccer:blank-canvas")).layers).toHaveLength(1);
  });

  it("opens directly on the combined required Design step with the AI prompt chat", async () => {
    render(<MemoryRouter initialEntries={["/uniforms?mode=scratch"]}><UniformStudioPage /></MemoryRouter>);
    const progress = within(screen.getByRole("navigation", { name: "Uniform order progress" }));
    const studioHeader = within(screen.getByRole("button", { name: "Back" }).closest("header"));
    expect(studioHeader.queryByText("AI Uniform")).not.toBeInTheDocument();
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(progress.getAllByRole("button")).toHaveLength(3);
    const setup = openUniformSetup();
    const category = within(setup.getByRole("group", { name: "Uniform category (required)" }));
    expect(setup.getByText("Select a category to continue to Team roster.")).toBeVisible();
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    fireEvent.click(category.getByRole("button", { name: "Soccer category" }));
    expect(category.getByRole("button", { name: "Soccer category" })).toHaveAttribute("aria-pressed", "true");
    expect(setup.getByRole("group", { name: "Fit type (required)" })).toBeVisible();
    expect(screen.getAllByRole("complementary", { name: "AI prompt chat" })[0]).toBeVisible();
    expect(screen.getAllByRole("textbox", { name: "Message Connect767 AI" })[0]).toBeVisible();
  });

  it("keeps the existing AI Studio tile and adds the ready-made entry path", () => {
    render(<MemoryRouter initialEntries={["/uniforms"]}><CartProvider><UniformStudioPage /></CartProvider></MemoryRouter>);

    const entry = screen.getByRole("button", { name: "Start Designing" });
    expect(screen.getByTestId("uniform-entry-page")).toHaveClass("min-h-[100dvh]");
    expect(screen.queryByRole("link", { name: "Back to site" })).not.toBeInTheDocument();
    expect(entry).toBeVisible();
    expect(screen.getByRole("button", { name: "Browse Ready-Made Designs" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start from Scratch" })).not.toBeInTheDocument();
    const categoryImages = screen.getAllByTestId("studio-cover-category");
    expect(categoryImages).toHaveLength(6);
    categoryImages.forEach((image) => {
      expect(image).toHaveClass("object-contain");
    });
    const logo = screen.getByTestId("studio-entry-ai-logo");
    const brandTitle = screen.getByText("Design Your Kit", { selector: "span" });
    expect(screen.queryByText("Custom Uniforms & Clothing")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(screen.getByRole("navigation", { name: "Mobile menu" })).getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(logo).toHaveAttribute("src", "/connect767-ai-logo-transparent.png");
    expect(logo).toHaveAccessibleName("Connect767 AI");
    expect(logo).not.toHaveClass("grayscale", "opacity-30", "mix-blend-multiply");
    expect(logo).toHaveClass("h-12", "w-12", "sm:h-14", "sm:w-14", "shrink-0");
    expect(logo.compareDocumentPosition(brandTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("studio-entry-brand")).toContainElement(logo);
    expect(entry).not.toContainElement(logo);
    expect(screen.queryByText("Connect767 AI", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("One design studio")).not.toBeInTheDocument();
    expect(screen.queryByText("Every category. One workspace.")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter once, then choose the required category and fit inside the studio.")).not.toBeInTheDocument();
    expect(screen.queryByText("Designs save automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("One AI studio for every garment")).not.toBeInTheDocument();
    expect(screen.queryByText("What would you like to design?")).not.toBeInTheDocument();
    expect(screen.queryByText("Start with any category.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose a sport or clothing category/)).not.toBeInTheDocument();
    expect(screen.getByText("Design", { selector: "span" })).toBeVisible();
    expect(screen.getByText("Team roster", { selector: "span" })).toBeVisible();
    expect(screen.getByText("Review & quote", { selector: "span" })).toBeVisible();

    fireEvent.click(entry);
    const setup = openUniformSetup();
    expect(setup.getByRole("group", { name: "Uniform category (required)" })).toBeVisible();
  });

  it("filters ready-made designs and opens a protected AI-only working copy", () => {
    render(<MemoryRouter initialEntries={["/uniforms?entry=gallery"]}><CartProvider><UniformStudioPage /></CartProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Ready-Made Uniform Designs" })).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by sport" }), { target: { value: "basketball" } });
    expect(screen.getAllByRole("heading", { name: "Shooter Tank" })[0]).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Classic Crew" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Customize Design" })[0]);
    expect(screen.getByText("AI-Generated Preview — Edit with AI Only")).toBeVisible();
    expect(screen.queryByLabelText("Editable garment tools")).not.toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem("c767:selected-ready-made-template"))).toMatchObject({
      templateSlug: "shooter-tank",
      sport: "basketball",
    });
  });

  it("shows a generated example in the AI workspace without production or watermark overlays", () => {
    openStudio("ai");
    expect(screen.getByTestId("uniform-studio-workspace")).toHaveClass(
      "uniform-studio-shell",
    );
    expect(screen.queryByTestId("ai-workspace-watermark")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Design Will Appear Here" })).toBeVisible();
    expect(screen.getByTestId("uniform-foundation")).toHaveAttribute("aria-label", "AI-generated uniform example");
    expect(screen.getAllByRole("textbox", { name: "Message Connect767 AI" })).toHaveLength(1);
    expect(screen.queryByText("Use the AI panel to begin.")).not.toBeInTheDocument();
    expect(screen.queryByText("Your generated uniform will appear here")).not.toBeInTheDocument();
    expect(screen.queryByText("Reference", { selector: "strong" })).not.toBeInTheDocument();
  });

  it("switches the generated sample when the sport changes", () => {
    openStudio("ai");
    const setup = openUniformSetup();
    const categoryPanel = within(setup.getByRole("group", { name: "Uniform category (required)" }));
    for (const category of ["Soccer", "Basketball", "Netball", "Cricket", "Goalkeeper"]) {
      fireEvent.click(categoryPanel.getByRole("button", { name: `${category} category` }));
      const slug = category.toLowerCase();
      expect(screen.getByRole("img", { name: `AI-generated ${slug} uniform example, front, side and back` })).toHaveAttribute("src", `/uploads/ai-uniform-samples/${slug}-views.webp`);
    }
  });

  it("places every category tile above the required fit selection", () => {
    const progress = openStudio("design");
    const setup = openUniformSetup();
    const categoryPanel = within(setup.getByRole("group", { name: "Uniform category (required)" }));
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(progress.getAllByRole("button")).toHaveLength(3);
    expect(categoryPanel.getAllByRole("button").map((button) => button.getAttribute("aria-label").replace(/ category$/, ""))).toEqual([
      "Soccer",
      "Basketball",
      "Netball",
      "Cricket",
      "Goalkeeper",
      "Other Apparel",
    ]);

    const categoryTemplates = [
      ["basketball", "Shooter Tank"],
      ["netball", "Court Dress"],
      ["cricket", "Matchday Long Sleeve"],
      ["goalkeeper", "Guardian Pro"],
      ["other", "Performance Polo"],
      ["soccer", "Classic Crew"],
    ];
    for (const [sport, templateName] of categoryTemplates) {
      const label = sport === "goalkeeper" ? "Goalkeeper" : sport === "other" ? "Other Apparel" : `${sport[0].toUpperCase()}${sport.slice(1)}`;
      fireEvent.click(categoryPanel.getByRole("button", { name: `${label} category` }));
      const studioHeader = within(screen.getByRole("button", { name: "Back" }).closest("header"));
      expect(studioHeader.queryByText(templateName)).not.toBeInTheDocument();
      expect(studioHeader.queryByText(label, { exact: true })).not.toBeInTheDocument();
      expect(progress.getByRole("button", { name: /Design/ })).toHaveTextContent(`${label} · Fit required`);
    }
    const categoryElement = setup.getByRole("group", { name: "Uniform category (required)" });
    const fitElement = setup.getByRole("group", { name: "Fit type (required)" });
    for (const subtitle of ["Classic Crew", "Shooter Tank", "Court Dress", "Matchday Long Sleeve", "Guardian Pro", "Performance Polo"]) {
      expect(within(categoryElement).queryByText(subtitle)).not.toBeInTheDocument();
    }
    expect(categoryElement.closest("section")).toBe(fitElement.closest("section"));
    expect(categoryElement.compareDocumentPosition(fitElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("starts in the combined Design step and requires fit before Team roster", () => {
    const progress = openStudio("ai");
    const setup = openUniformSetup();
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: /Continue to Team roster/ })) expect(button).toBeEnabled();
    fireEvent.click(setup.getByRole("button", { name: /Continue to Team roster/ }));
    expect(setup.getByRole("group", { name: "Fit type (required)" })).toHaveAttribute("data-validation-highlight", "true");
    expect(screen.queryByRole("button", { name: /^Designer$/ })).not.toBeInTheDocument();
  });

  it("keeps Step 2 AI-only and hides the legacy manual design tools", () => {
    const progress = openStudio("ai");
    const header = within(screen.getByRole("button", { name: "Back" }).closest("header"));
    expect(header.queryByRole("button", { name: /^Designer$/ })).not.toBeInTheDocument();
    expect(header.getByRole("navigation", { name: "Uniform order progress" })).toBeVisible();
    expect(header.getByRole("button", { name: "Account and sign in" })).toBeVisible();
    expect(header.queryByText(/Auto-saved on device/)).not.toBeInTheDocument();
    expect(header.getByRole("button", { name: "Zoom out" })).toBeVisible();
    fireEvent.click(progress.getByRole("button", { name: /Design/ }));
    expect(header.getByRole("button", { name: "Zoom out" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Uniform setup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logo" })).not.toBeInTheDocument();
    const setup = within(screen.getByRole("complementary", { name: "Uniform & order setup" }));
    expect(setup.getByRole("heading", { name: "Uniform & order setup" })).toBeVisible();
    const productionExtras = screen.getByRole("region", { name: "Uniform options" });
    expect(setup.getByRole("button", { name: /^Full Kit/ })).toHaveTextContent("$35.00");
    expect(setup.getByRole("button", { name: /^Shirt Only/ })).toHaveTextContent("$15.00");
    expect(setup.getByRole("button", { name: /^Shirt Only/ })).toHaveTextContent("supporter jerseys use this price");
    expect(within(productionExtras).getByRole("group", { name: "Collar options" })).toBeVisible();
    expect(within(productionExtras).getByRole("group", { name: "Sleeve options" })).toBeVisible();
    expect(within(productionExtras).getByRole("checkbox", { name: /Embroidered team logo/ })).toBeVisible();
    expect(within(productionExtras).getByText(/Inside-collar logo or message/)).toBeVisible();
    expect(screen.queryByRole("group", { name: "Garment part colors" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Production Mode" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Save progress" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "SVG" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    const studioSettings = header.getByRole("button", { name: "Studio settings" });
    expect(studioSettings).toBeVisible();
    fireEvent.click(studioSettings);
    expect(screen.getByRole("dialog", { name: "AI Studio Settings" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Studio background" })).toBeVisible();
    expect(screen.getByLabelText("Custom studio background color")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close studio settings" }));
    expect(header.queryByRole("button", { name: "Open uniform and order setup" })).not.toBeInTheDocument();
    const aiPanel = screen.getByRole("complementary", { name: "AI prompt chat" });
    expect(within(aiPanel).queryByRole("heading", { name: "Design Studio" })).not.toBeInTheDocument();
    const promptTools = within(within(aiPanel).getByLabelText("AI prompt tools"));
    expect(promptTools.queryByRole("button", { name: "New design" })).not.toBeInTheDocument();
    expect(promptTools.getByRole("button", { name: "Tools" })).toHaveClass("bg-primary-700");
    fireEvent.click(promptTools.getByRole("button", { name: "Tools" }));
    const promptMenu = screen.getByRole("menu", { name: "AI prompt tools menu" });
    expect(within(promptMenu).getByRole("menuitem", { name: "History" })).toBeVisible();
    expect(within(promptMenu).getByRole("menuitem", { name: "Reference" })).toBeVisible();
    expect(within(promptMenu).getByRole("menuitem", { name: "Refine with AI" })).toBeVisible();
    expect(within(promptMenu).queryByRole("menuitem", { name: "Save design" })).not.toBeInTheDocument();
    expect(within(promptMenu).queryByRole("menuitem", { name: /Download|Unlock after payment/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: "AI command prompt" })[0]).toBeVisible();
    expect(screen.getAllByRole("textbox", { name: "Message Connect767 AI" })[0]).toBeVisible();
  });

  it.each(["Men", "Women", "Youth"])("unlocks Step 2 Team roster after selecting %s in Design", (fit) => {
    const progress = openStudio("ai");
    fireEvent.click(progress.getByRole("button", { name: /Design/ }));
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    const setup = openUniformSetup();
    expect(setup.queryByText("Select a fit to continue to Team roster.")).not.toBeInTheDocument();
    expect(setup.getByRole("group", { name: "Fit type (required)" })).toBeVisible();
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
      expect(button).toBeEnabled();
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

  it("highlights an unadded roster row when Continue cannot advance", () => {
    const progress = openStudio("design");
    fireEvent.click(openUniformSetup().getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));

    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Draft team row" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    const continueButton = screen.getAllByRole("button", { name: /Continue to Review & quote/ }).at(-1);
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(screen.getAllByText("Click Add player to include this row in the team total.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Click Add player to include this row in the team total.")[0].closest("div")).toHaveAttribute("data-validation-highlight", "true");
    expect(progress.getByRole("button", { name: /Team roster/ })).toHaveAttribute("aria-current", "step");
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

  it("moves supporter jersey quantities to Team roster and uses the Step 2 Shirt Only price", () => {
    const progress = openStudio("design");
    const setup = openUniformSetup();
    const shirtOnlyButton = setup.getByRole("button", { name: /^Shirt Only/ });
    expect(shirtOnlyButton).toHaveTextContent("$15.00");
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
    expect(screen.getAllByText("Shirt Only · $15.00 each").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Add Fan\/Supporter Jerseys/ })[0]);
    expect(screen.getAllByRole("combobox", { name: "Supporter jersey size 1" }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Minimum order" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add player" })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Review & quote/ }));
    expect(screen.queryByText("Add Fan/Supporter Jerseys")).not.toBeInTheDocument();
    expect(screen.getAllByText(/1 supporter jersey × \$15\.00/).length).toBeGreaterThan(0);
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

  it("saves the current item and starts another design in the same order", async () => {
    window.localStorage.setItem("connect767-ai-prompt-history:Soccer", JSON.stringify([{
      id: "prompt-1",
      prompt: "Create a navy and gold home kit",
      response: "Navy base with gold trim",
      createdAt: "2026-11-20T12:00:00.000Z",
    }]));
    const progress = openStudio("design");
    fireEvent.click(openUniformSetup().getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Minimum order" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add player" })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Review & quote/ }));

    expect(screen.getAllByRole("heading", { name: "Order Designs" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Save Design" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Save & Add Another Design" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 item").length).toBeGreaterThan(0);
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Save & Add Another Design" })[0]));
    const draft = JSON.parse(window.localStorage.getItem("c767:uniform-order-designs:v1"));
    expect(draft).toHaveLength(1);
    expect(draft[0].payload.sport).toBe("soccer");
    expect(draft[0].payload.aiPromptHistory[0].prompt).toBe("Create a navy and gold home kit");
    expect(window.localStorage.getItem("connect767-ai-prompt-history:Soccer")).toBeNull();
    expect(progress.getByRole("button", { name: /Design/ })).toHaveAttribute("aria-current", "step");
    expect(openUniformSetup().getByRole("group", { name: "Fit type (required)" })).toBeVisible();
  });

  it("uses the shipping contact by default and reveals a different order contact only when requested", () => {
    const progress = openStudio("design");
    fireEvent.click(openUniformSetup().getByRole("button", { name: "Men", exact: true }));
    fireEvent.click(progress.getByRole("button", { name: /Team roster/ }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "Name" })[0], { target: { value: "Minimum order" } });
    fireEvent.change(screen.getAllByRole("spinbutton", { name: "Player quantity" })[0], { target: { value: "22" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add player" })[0]);
    fireEvent.click(progress.getByRole("button", { name: /Review & quote/ }));

    expect(screen.getAllByRole("heading", { name: /Shipping Address/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Custom design uniforms are non-refundable.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Delivery address" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: "Shipping phone number" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /Order contact/ })).not.toBeInTheDocument();

    const differentContact = screen.getAllByRole("checkbox", { name: "Order Contact if different from above" })[0];
    fireEvent.click(differentContact);
    expect(screen.getAllByRole("heading", { name: /Order contact/ }).length).toBeGreaterThan(0);
    fireEvent.click(differentContact);
    expect(screen.queryByRole("heading", { name: "Order contact" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Request a quote instead" })[0]);
    expect(screen.getAllByRole("heading", { name: /Order contact/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Send quote request" }).length).toBeGreaterThan(0);
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
    window.localStorage.setItem("c767:studio:soccer:classic-crew", JSON.stringify({ fitType: "Men", fitTypeConfirmed: confirmed, zoneModel: { front: [], back: [] } }));
    render(<MemoryRouter initialEntries={["/uniforms?sport=soccer"]}><CartProvider><UniformStudioPage /></CartProvider></MemoryRouter>);
    const progress = within(await screen.findByRole("navigation", { name: "Uniform order progress" }));
    if (confirmed) {
      expect(progress.getByRole("button", { name: /Team roster/ })).toBeEnabled();
      expect(screen.queryByText("Select a fit to continue to Team roster.")).not.toBeInTheDocument();
    } else {
      expect(progress.getByRole("button", { name: /Design/ })).toBeEnabled();
      expect(progress.getByRole("button", { name: /Team roster/ })).toBeDisabled();
    }
  });
});
