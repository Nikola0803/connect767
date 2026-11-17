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
    onNewDirection: vi.fn(),
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

  it("keeps the full AI concept image on the Studio canvas instead of duplicating it in the side panel", () => {
    renderComposer({
      uniformPlan: {
        name: "Riverside FC — Modern & Bold",
        summary: "A clean white soccer kit.",
        conceptImage: { src: "data:image/png;base64,preview" },
      },
    });

    expect(screen.getByText("Riverside FC — Modern & Bold")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply design/i })).toBeInTheDocument();
    expect(screen.queryByAltText(/AI uniform concept/i)).not.toBeInTheDocument();
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
});
