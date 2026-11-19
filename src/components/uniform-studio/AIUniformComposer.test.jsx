import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import AIUniformComposer from "./AIUniformComposer";

function renderComposer(overrides = {}) {
  const props = {
    sport: "Soccer",
    mode: "uniform",
    onModeChange: vi.fn(),
    connection: "connected",
    brandName: "Riverside FC",
    onBrandNameChange: vi.fn(),
    prompt: "Create a modern green kit",
    onPromptChange: vi.fn(),
    isRefinement: false,
    generating: false,
    canSend: true,
    onSend: vi.fn(),
    onStop: vi.fn(),
    style: "Modern & Bold",
    styles: ["Modern & Bold", "Minimal & Elegant"],
    onStyleChange: vi.fn(),
    reference: null,
    onReferenceFile: vi.fn(),
    onRemoveReference: vi.fn(),
    promptHistory: [],
    historyEntries: [],
    onReusePrompt: vi.fn(),
    onClearHistory: vi.fn(),
    error: "",
    onRetry: vi.fn(),
    uniformPlan: null,
    artworkPreview: null,
    onPlaceArtwork: vi.fn(),
    onClearArtwork: vi.fn(),
    preservationControls: <div>Preservation settings</div>,
    canUndo: false,
    onUndo: vi.fn(),
    onNewChat: vi.fn(),
    onClearCurrentDesign: vi.fn(),
    versions: [],
    onRestoreVersion: vi.fn(),
    onCompareVersions: vi.fn(),
    onGenerateVariation: vi.fn(),
    ...overrides,
  };
  if (!("historyEntries" in overrides)) props.historyEntries = props.promptHistory;
  render(<AIUniformComposer {...props} />);
  return props;
}

describe("AIUniformComposer", () => {
  it("fits the complete composer inside its docked panel", () => {
    renderComposer();

    const composer = screen.getByLabelText("Connect767 AI uniform designer");
    expect(composer).toHaveClass("h-full", "min-h-0", "flex-1", "overflow-hidden");
    expect(composer).not.toHaveClass("min-h-[620px]");
    expect(screen.getByLabelText("Message Connect767 AI")).toBeInTheDocument();
  });

  it("uses the transparent Connect767 AI logo instead of visible brand-name text", () => {
    renderComposer();

    const logos = screen.getAllByRole("img", { name: "Connect767 AI" });
    expect(logos.length).toBeGreaterThanOrEqual(2);
    expect(logos.some((logo) => logo.getAttribute("src")?.includes("connect767-ai-command-logo.png"))).toBe(true);
    expect(screen.queryByText("Connect767 AI")).not.toBeInTheDocument();
    expect(screen.getByText("Design your uniform")).toBeInTheDocument();
  });

  it("submits with Enter and preserves Shift + Enter for multiline prompts", () => {
    const props = renderComposer();
    const message = screen.getByLabelText("Message Connect767 AI");

    fireEvent.keyDown(message, { key: "Enter", shiftKey: true });
    expect(props.onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(message, { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledWith("proof");
  });

  it("uses highest-quality output for the standard preview action", () => {
    const props = renderComposer();

    expect(screen.queryByRole("button", { name: "Render high-quality proof" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(props.onSend).toHaveBeenCalledWith("proof");
  });

  it("shows only tools supported by the uniform AI backend", () => {
    renderComposer();
    fireEvent.click(screen.getByLabelText("Add attachment or AI tool"));

    expect(screen.getByText("Upload inspiration image")).toBeInTheDocument();
    expect(screen.queryByText("Design full uniform")).not.toBeInTheDocument();
    expect(screen.getByText("Create transparent artwork")).toBeInTheDocument();
    expect(screen.queryByText("Search the Web")).not.toBeInTheDocument();
    expect(screen.queryByText("Analyze Document")).not.toBeInTheDocument();
  });

  it("keeps stop generation and mobile design controls accessible", () => {
    const props = renderComposer({ generating: true });
    fireEvent.click(screen.getByLabelText("Stop generating"));
    expect(props.onStop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Controls"));
    expect(screen.getByText("Design controls")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Riverside FC")).toBeInTheDocument();
  });

  it("reuses a saved conversation from the history drawer", () => {
    const entry = {
      id: "prompt-1",
      kind: "Refinement",
      prompt: "Make the shorts black",
      createdAt: new Date("2026-11-16T12:00:00Z").toISOString(),
    };
    const props = renderComposer({ promptHistory: [entry] });
    fireEvent.click(screen.getByLabelText("Open design reset options"));
    fireEvent.click(screen.getByRole("menuitem", { name: /design history/i }));
    fireEvent.click(within(screen.getByLabelText("AI design conversation history")).getByText("Make the shorts black"));
    expect(props.onReusePrompt).toHaveBeenCalledWith(entry);
  });

  it("keeps the 3D preview output AI-controlled instead of exposing manual apply", () => {
    const version = {
      name: "Riverside FC — Modern & Bold",
      summary: "A clean white soccer kit.",
      conceptImage: { src: "data:image/png;base64,preview" },
    };
    const props = renderComposer({
      uniformPlan: version,
      versions: [version],
    });

    expect(screen.queryByText("Current AI design")).not.toBeInTheDocument();
    expect(screen.queryByText("Riverside FC — Modern & Bold")).not.toBeInTheDocument();
    expect(screen.queryByText("A clean white soccer kit.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new direction/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText(/AI uniform concept/i)).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /apply design/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Preview Only")).not.toBeInTheDocument();
    expect(screen.queryByText("AI Editing Available")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Refine with AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Editable Design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save image to project" })).not.toBeInTheDocument();
  });

  it("relocates AI commands and version actions into the studio banner", () => {
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    const original = { name: "Original", conceptImage: { src: "data:image/png;base64,one" } };
    const current = { name: "Current", conceptImage: { src: "data:image/png;base64,two" } };
    renderComposer({ toolbarTarget, uniformPlan: current, versions: [original, current] });
    const toolbar = within(toolbarTarget);

    expect(toolbar.getByRole("button", { name: "New design" })).toBeInTheDocument();
    expect(toolbar.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(toolbar.getByRole("button", { name: "Reference" })).toBeInTheDocument();
    expect(toolbar.getByRole("button", { name: "Refine with AI" })).toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "AI controls" })).not.toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "Save design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Refine with AI" })).not.toBeInTheDocument();

    fireEvent.click(toolbar.getByLabelText("Open design reset options"));
    expect(screen.getByRole("menu", { name: "Design reset options" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "Design reset options" })).not.toBeInTheDocument();

    fireEvent.click(toolbar.getByRole("button", { name: "Versions" }));
    expect(screen.getByRole("menu", { name: "Version controls" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "Version controls" })).not.toBeInTheDocument();

    toolbarTarget.remove();
  });

  it("preserves AI versions for comparison, rejection and restoration", () => {
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    const original = { name: "Original", conceptImage: { src: "data:image/png;base64,one" } };
    const current = { name: "Current", conceptImage: { src: "data:image/png;base64,two" } };
    const props = renderComposer({ toolbarTarget, uniformPlan: current, versions: [original, current] });
    const toolbar = within(toolbarTarget);

    fireEvent.click(toolbar.getByRole("button", { name: "Versions" }));
    fireEvent.click(screen.getByRole("button", { name: "Compare versions" }));
    expect(props.onCompareVersions).toHaveBeenCalledWith(original);
    fireEvent.click(screen.getByRole("button", { name: "Previous version" }));
    expect(props.onRestoreVersion).toHaveBeenCalledWith(original);
    fireEvent.click(screen.getByRole("button", { name: "Restore original" }));
    expect(props.onRestoreVersion).toHaveBeenLastCalledWith(original);
    fireEvent.click(screen.getByRole("button", { name: "New variation" }));
    expect(props.onGenerateVariation).toHaveBeenCalledTimes(1);
    toolbarTarget.remove();
  });

  it("provides explicit controls for starting over and clearing saved AI state", () => {
    const entry = {
      id: "prompt-1",
      kind: "Full uniform",
      prompt: "Create a green kit",
      createdAt: new Date("2026-11-16T12:00:00Z").toISOString(),
    };
    const props = renderComposer({
      promptHistory: [entry],
      uniformPlan: { name: "Green kit", summary: "A green uniform concept." },
    });

    fireEvent.click(screen.getByRole("button", { name: "New design" }));
    expect(props.onNewChat).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Open design reset options"));
    fireEvent.click(screen.getByRole("menuitem", { name: /clear current design/i }));
    expect(props.onClearCurrentDesign).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Open design reset options"));
    fireEvent.click(screen.getByRole("menuitem", { name: /design history/i }));
    fireEvent.click(within(screen.getByLabelText("AI design conversation history")).getByRole("button", { name: "Clear" }));
    expect(props.onClearHistory).toHaveBeenCalledTimes(1);
  });

  it("starts full-uniform and transparent-artwork designs from the New design menu", () => {
    const props = renderComposer();

    expect(screen.queryByRole("button", { name: "Full uniform" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Open design reset options"));
    fireEvent.click(screen.getByRole("menuitem", { name: /transparent artwork/i }));
    expect(props.onModeChange).toHaveBeenCalledWith("artwork");
    expect(props.onNewChat).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Open design reset options"));
    fireEvent.click(screen.getByRole("menuitem", { name: /full uniform/i }));
    expect(props.onModeChange).toHaveBeenCalledWith("uniform");
    expect(props.onNewChat).toHaveBeenCalledTimes(2);
  });

  it("dismisses open popovers when the user clicks the command area", () => {
    renderComposer();
    const message = screen.getByLabelText("Message Connect767 AI");

    fireEvent.click(screen.getByLabelText("Open design reset options"));
    expect(screen.getByRole("menu", { name: "Design reset options" })).toBeInTheDocument();
    fireEvent.pointerDown(message);
    expect(screen.queryByRole("menu", { name: "Design reset options" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Add attachment or AI tool"));
    expect(screen.getByRole("menu", { name: "AI composer tools" })).toBeInTheDocument();
    fireEvent.pointerDown(message);
    expect(screen.queryByRole("menu", { name: "AI composer tools" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Controls"));
    expect(screen.getByText("Design controls")).toBeInTheDocument();
    fireEvent.pointerDown(message);
    expect(screen.queryByText("Design controls")).not.toBeInTheDocument();
  });
});
