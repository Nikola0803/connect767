import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArtworkToolNavigation from "./ArtworkToolNavigation";

const artworkTools = [
  { key: "ai", label: "AI Designer", icon: "ri-sparkling-2-fill", hint: "Generate a complete design." },
  { key: "text", label: "Text", icon: "ri-font-size", hint: "Add names and numbers." },
  { key: "logo", label: "Logo", icon: "ri-image-add-line", hint: "Upload a logo." },
  { key: "skins", label: "Patterns", icon: "ri-shapes-line", hint: "Add a pattern." },
  { key: "layers", label: "Layers", icon: "ri-stack-line", hint: "Manage artwork." },
];

describe("ArtworkToolNavigation", () => {
  it("presents every supported Step 2 Design tool in the docked panel", () => {
    render(<ArtworkToolNavigation tools={artworkTools} activeTool="text" onSelect={() => {}} />);

    expect(screen.getByRole("navigation", { name: "Design tools" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 · Design")).toBeInTheDocument();
    for (const tool of artworkTools) {
      expect(screen.getByRole("button", { name: tool.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Text" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Add names and numbers.")).toBeInTheDocument();
  });

  it("renders only the capability-filtered tools supplied by the workspace", () => {
    render(<ArtworkToolNavigation tools={artworkTools.slice(0, 2)} activeTool="ai" onSelect={() => {}} />);

    expect(screen.queryByRole("button", { name: "Logo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI Designer" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches the active artwork tool", () => {
    const onSelect = vi.fn();
    render(<ArtworkToolNavigation tools={artworkTools} activeTool="text" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "AI Designer" }));
    expect(onSelect).toHaveBeenCalledWith("ai");
  });
});
