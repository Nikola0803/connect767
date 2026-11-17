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
    applied: false,
    onApplyUniform: vi.fn(),
    artworkPreview: null,
    onPlaceArtwork: vi.fn(),
    onClearArtwork: vi.fn(),
    preservationControls: <div>Preservation settings</div>,
    canUndo: false,
    onUndo: vi.fn(),
    onNewChat: vi.fn(),
    onClearCurrentDesign: vi.fn(),
    ...overrides,
  };
  if (!("historyEntries" in overrides)) props.historyEntries = props.promptHistory;
  render(<AIUniformComposer {...props} />);
  return props;
}

describe("AIUniformComposer", () => {
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
    expect(props.onSend).toHaveBeenCalledTimes(1);
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

  it("keeps the design card off the side panel and exposes Apply design in the composer", () => {
    const props = renderComposer({
      uniformPlan: {
        name: "Riverside FC — Modern & Bold",
        summary: "A clean white soccer kit.",
        conceptImage: { src: "data:image/png;base64,preview" },
      },
    });

    expect(screen.queryByText("Current AI design")).not.toBeInTheDocument();
    expect(screen.queryByText("Riverside FC — Modern & Bold")).not.toBeInTheDocument();
    expect(screen.queryByText("A clean white soccer kit.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new direction/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText(/AI uniform concept/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply design/i }));
    expect(props.onApplyUniform).toHaveBeenCalledTimes(1);
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
