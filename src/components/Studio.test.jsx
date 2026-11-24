import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Studio from "./Studio";

describe("Studio entry links", () => {
  it("offers distinct routes for pre-designed and custom uniforms", () => {
    render(<MemoryRouter><Studio /></MemoryRouter>);

    expect(screen.getByRole("link", { name: /Pre-Design Uniforms/i })).toHaveAttribute(
      "href",
      "/shop?category=ready-made-designs",
    );
    expect(screen.getByRole("link", { name: "Design Your Own Uniform" })).toHaveAttribute(
      "href",
      "/uniforms?mode=scratch",
    );

    const preview = screen.getByRole("img", { name: /Emerald green and white number 10 uniform/i });
    expect(preview).toHaveAttribute("src", "/uploads/uniform-studio-green-white-ai-emboss-v2.png");
    expect(preview).toHaveClass("object-contain");
    expect(preview).not.toHaveClass("object-cover");
  });
});
