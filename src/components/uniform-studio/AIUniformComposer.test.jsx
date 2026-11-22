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
    onGenerateProof: vi.fn(),
    onSaveDesign: vi.fn(),
    onDownloadDesign: vi.fn(),
    onDownloadPrompts: vi.fn(),
    onOpenBackgroundRemoval: vi.fn(),
    ...overrides,
  };
  if (!("historyEntries" in overrides)) props.historyEntries = props.promptHistory;
  render(<AIUniformComposer {...props} />);
  return props;
}

describe("AIUniformComposer", () => {
  it("sends from the touch-accessible button without a hardware Enter key", () => {
    const props = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(props.onSend).toHaveBeenCalledWith("preview", "uniform", props.prompt);
  });

  it("does not show fabricated zero credits when a usage check fails", () => {
    const props = renderComposer({ canSend: false, securityError: "Usage is offline", onRetrySetup: vi.fn() });
    expect(screen.getByText("AI allowance unavailable")).toBeVisible();
    expect(screen.queryByText("0 of 0 remaining")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
    expect(props.onRetrySetup).toHaveBeenCalledOnce();
  });

  it("keeps guests locked despite a positive backend allowance", () => {
    renderComposer({ accountRequired: true, aiQuota: { authenticated: false, limit: 3, remaining: 3 } });
    expect(screen.getByText("3 of 3 remaining")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", expect.stringContaining("redirect="));
  });
  it("allows a confirmed exhausted allowance to be refreshed without generating", () => {
    const props = renderComposer({ canSend: false, aiQuota: { authenticated: true, limit: 10, remaining: 0 }, onRetrySetup: vi.fn() });
    expect(screen.getByText("0 of 10 remaining")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh allowance" }));
    expect(props.onRetrySetup).toHaveBeenCalledOnce();
    expect(props.onSend).not.toHaveBeenCalled();
  });
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
    expect(screen.getByText("Design Your Uniform")).toBeInTheDocument();
  });

  it("submits with Enter and preserves Shift + Enter for multiline prompts", () => {
    const props = renderComposer();
    const message = screen.getByLabelText("Message Connect767 AI");

    fireEvent.keyDown(message, { key: "Enter", shiftKey: true });
    expect(props.onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(message, { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledWith("preview", "uniform", "Create a modern green kit");
    expect(props.onPromptChange).toHaveBeenCalledWith("");
  });

  it("uses Enter as the only generation action", () => {
    renderComposer();
    const promptRegion = screen.getByRole("region", { name: "AI command prompt" });
    expect(within(promptRegion).queryByText("Full uniform")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Render high-quality proof" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate Changes" })).not.toBeInTheDocument();
    expect(screen.getByText(/Enter creates a fast preview/i)).toBeVisible();
  });

  it("routes account actions through the real auth pages and preserves the studio return path", () => {
    window.history.replaceState({}, "", "/uniforms?sport=soccer&step=design");
    renderComposer({ accountRequired: true });

    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Funiforms%3Fsport%3Dsoccer%26step%3Ddesign",
    );
    expect(screen.getByRole("link", { name: "Create Account" })).toHaveAttribute(
      "href",
      "/auth/register?redirect=%2Funiforms%3Fsport%3Dsoccer%26step%3Ddesign",
    );
  });

  it("routes background-removal prompts to the transparent-file utility without redesigning", () => {
    const props = renderComposer({ prompt: "remove background make transparent" });
    fireEvent.keyDown(screen.getByLabelText("Message Connect767 AI"), { key: "Enter" });

    expect(props.onOpenBackgroundRemoval).toHaveBeenCalledTimes(1);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(props.onPromptChange).toHaveBeenCalledWith("");
  });

  it("automatically routes explicit transparent-artwork prompts without a mode selection", () => {
    const props = renderComposer({ prompt: "Create a transparent team crest" });
    fireEvent.keyDown(screen.getByLabelText("Message Connect767 AI"), { key: "Enter" });

    expect(props.onModeChange).toHaveBeenCalledWith("artwork");
    expect(props.onSend).toHaveBeenCalledWith("preview", "artwork", "Create a transparent team crest");
  });

  it("automatically routes uniform prompts from artwork mode", () => {
    const props = renderComposer({ mode: "artwork", prompt: "Design a basketball uniform with front side and back views" });
    fireEvent.keyDown(screen.getByLabelText("Message Connect767 AI"), { key: "Enter" });

    expect(props.onModeChange).toHaveBeenCalledWith("uniform");
    expect(props.onSend).toHaveBeenCalledWith("preview", "uniform", "Design a basketball uniform with front side and back views");
  });

  it("offers a high-quality final proof after a fast preview", () => {
    const props = renderComposer({ uniformPlan: { name: "Riverside FC" }, renderTier: "preview" });
    fireEvent.click(screen.getByRole("button", { name: "Final proof" }));
    expect(props.onGenerateProof).toHaveBeenCalledTimes(1);
  });

  it("labels the transparent artwork workspace clearly", () => {
    renderComposer({ mode: "artwork" });
    expect(screen.getByRole("heading", { name: "Create Transparent Artwork" })).toBeInTheDocument();
    expect(screen.getByText(/Uniform Design Assistant · Transparent artwork/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "AI command prompt" })).queryByText("Transparent artwork")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe the crest, graphic or pattern you want…")).toBeInTheDocument();
  });

  it("shows only tools supported by the uniform AI backend", () => {
    renderComposer();
    fireEvent.click(screen.getByLabelText("Add attachment or AI tool"));

    expect(screen.getByText("Upload Inspiration Image")).toBeInTheDocument();
    expect(screen.queryByText("Design Full Uniform")).not.toBeInTheDocument();
    expect(screen.getByText("Create Transparent Artwork")).toBeInTheDocument();
    expect(screen.queryByText("Search the Web")).not.toBeInTheDocument();
    expect(screen.queryByText("Analyze Document")).not.toBeInTheDocument();
  });

  it("keeps stop generation and mobile design controls accessible", () => {
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    const props = renderComposer({ generating: true, toolbarTarget });
    fireEvent.click(screen.getByLabelText("Stop generating"));
    expect(props.onStop).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole("button", { name: "AI design settings" })).not.toBeInTheDocument();
    fireEvent.click(within(toolbarTarget).getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(screen.getByText("Design Controls")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Riverside FC")).toBeInTheDocument();
    toolbarTarget.remove();
  });

  it("reuses a saved conversation from the history drawer", () => {
    const entry = {
      id: "prompt-1",
      kind: "Refinement",
      prompt: "Make the shorts black",
      createdAt: new Date("2026-11-16T12:00:00Z").toISOString(),
    };
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    const props = renderComposer({ promptHistory: [entry], toolbarTarget });
    fireEvent.click(within(toolbarTarget).getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "History" }));
    fireEvent.click(within(screen.getByLabelText("AI design conversation history")).getByText("Make the shorts black"));
    expect(props.onReusePrompt).toHaveBeenCalledWith(entry);
    toolbarTarget.remove();
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
    const props = renderComposer({ toolbarTarget, uniformPlan: current, versions: [original, current] });
    const toolbar = within(toolbarTarget);

    expect(toolbar.getByRole("button", { name: "AI tools" })).toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "New design" })).not.toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "Reference" })).not.toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "Refine with AI" })).not.toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "AI controls" })).not.toBeInTheDocument();
    expect(toolbar.queryByRole("button", { name: "Save design" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Refine with AI" })).not.toBeInTheDocument();

    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    const toolsMenu = screen.getByRole("menu", { name: "AI prompt tools menu" });
    expect(within(toolsMenu).getByRole("menuitem", { name: "History" })).toBeInTheDocument();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Reference" })).toBeInTheDocument();
    expect(within(toolsMenu).queryByRole("menuitem", { name: "Create artwork" })).not.toBeInTheDocument();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Remove background / Make transparent" })).toBeInTheDocument();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Save design" })).toBeInTheDocument();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Download design" })).toBeInTheDocument();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Download prompts" })).toBeDisabled();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(within(toolsMenu).getByRole("menuitem", { name: "Previous version" })).toBeInTheDocument();

    fireEvent.click(within(toolsMenu).getByRole("menuitem", { name: "Save design" }));
    expect(props.onSaveDesign).toHaveBeenCalledTimes(1);
    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove background / Make transparent" }));
    expect(props.onOpenBackgroundRemoval).toHaveBeenCalledTimes(1);

    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    expect(screen.getByRole("menu", { name: "AI prompt tools menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Refine with AI" }));
    expect(screen.getByRole("textbox", { name: "Message Connect767 AI" })).toHaveFocus();

    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    expect(screen.getByRole("menu", { name: "AI prompt tools menu" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "AI prompt tools menu" })).not.toBeInTheDocument();

    toolbarTarget.remove();
  });

  it("preserves AI versions for comparison, rejection and restoration", () => {
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    const original = { name: "Original", conceptImage: { src: "data:image/png;base64,one" } };
    const current = { name: "Current", conceptImage: { src: "data:image/png;base64,two" } };
    const props = renderComposer({ toolbarTarget, uniformPlan: current, versions: [original, current] });
    const toolbar = within(toolbarTarget);

    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Compare versions" }));
    expect(props.onCompareVersions).toHaveBeenCalledWith(original);
    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Previous version" }));
    expect(props.onRestoreVersion).toHaveBeenCalledWith(original);
    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore original" }));
    expect(props.onRestoreVersion).toHaveBeenLastCalledWith(original);
    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New variation" }));
    expect(props.onGenerateVariation).toHaveBeenCalledTimes(1);
    toolbarTarget.remove();
  });

  it("keeps history and clear-design controls in AI tools", () => {
    const entry = {
      id: "prompt-1",
      kind: "Full uniform",
      prompt: "Create a green kit",
      createdAt: new Date("2026-11-16T12:00:00Z").toISOString(),
    };
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    const props = renderComposer({
      promptHistory: [entry],
      uniformPlan: { name: "Green kit", summary: "A green uniform concept." },
      toolbarTarget,
    });
    const toolbar = within(toolbarTarget);

    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /clear current design/i }));
    expect(props.onClearCurrentDesign).toHaveBeenCalledTimes(1);

    fireEvent.click(toolbar.getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "History" }));
    fireEvent.click(within(screen.getByLabelText("AI design conversation history")).getByRole("button", { name: "Clear" }));
    expect(props.onClearHistory).toHaveBeenCalledTimes(1);
    toolbarTarget.remove();
  });

  it("dismisses open popovers when the user clicks the command area", () => {
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    renderComposer({ toolbarTarget });
    const message = screen.getByLabelText("Message Connect767 AI");

    fireEvent.click(within(toolbarTarget).getByRole("button", { name: "AI tools" }));
    expect(screen.getByRole("menu", { name: "AI prompt tools menu" })).toBeInTheDocument();
    fireEvent.pointerDown(message);
    expect(screen.queryByRole("menu", { name: "AI prompt tools menu" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Add attachment or AI tool"));
    expect(screen.getByRole("menu", { name: "AI composer tools" })).toBeInTheDocument();
    fireEvent.pointerDown(message);
    expect(screen.queryByRole("menu", { name: "AI composer tools" })).not.toBeInTheDocument();

    fireEvent.click(within(toolbarTarget).getByRole("button", { name: "AI tools" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(screen.getByText("Design Controls")).toBeInTheDocument();
    fireEvent.pointerDown(message);
    expect(screen.queryByText("Design Controls")).not.toBeInTheDocument();
    toolbarTarget.remove();
  });

  it("shows generated artwork without offering manual placement in the AI-only studio", () => {
    renderComposer({ artworkPreview: { src: "data:image/png;base64,artwork" }, onPlaceArtwork: undefined });
    expect(screen.getByRole("img", { name: "Generated transparent uniform artwork" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place on uniform/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove artwork preview" })).toBeEnabled();
  });

  it("keeps AI commands available without project or file actions", () => {
    const toolbarTarget = document.createElement("div");
    document.body.appendChild(toolbarTarget);
    renderComposer({ toolbarTarget, allowFileActions: false, uniformPlan: { name: "AI kit" }, downloadUnlocked: false });
    fireEvent.click(within(toolbarTarget).getByRole("button", { name: "AI tools" }));
    const menu = within(screen.getByRole("menu", { name: "AI prompt tools menu" }));
    for (const name of ["History", "Reference", "Refine with AI", "Remove background / Make transparent", "Settings"]) expect(menu.getByRole("menuitem", { name })).toBeEnabled();
    for (const name of ["Save design", "Download design", "Download prompts", "Unlock after payment"]) expect(menu.queryByRole("menuitem", { name })).not.toBeInTheDocument();
    expect(screen.getByText("Your AI design is ready. Continue to complete your uniform order.")).toBeInTheDocument();
    expect(screen.queryByText(/production-ready design files/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close AI tools" }));
    expect(screen.queryByRole("menu", { name: "AI prompt tools menu" })).not.toBeInTheDocument();
    toolbarTarget.remove();
  });
});
