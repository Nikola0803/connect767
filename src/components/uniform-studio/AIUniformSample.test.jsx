import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const emboss = vi.hoisted(() => vi.fn());
vi.mock("./aiConceptEmboss", () => ({ embossConnect767ConceptBackground: emboss }));
import AIUniformSample from "./AIUniformSample";

it("preserves the selected sample during asynchronous branding, caches the result, and falls back on failure", async () => {
  let soccerReady;
  let basketballReady;
  emboss.mockImplementation((source) => new Promise((resolve, reject) => {
    if (source.includes("soccer")) soccerReady = resolve;
    if (source.includes("basketball")) basketballReady = resolve;
    if (source.includes("cricket")) reject(new Error("Image unavailable"));
  }));
  const { rerender } = render(<AIUniformSample sport="soccer" />);
  expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/ai-uniform-samples/soccer-views.webp");
  rerender(<AIUniformSample sport="basketball" />);
  await act(async () => soccerReady("data:image/png;base64,soccer"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/ai-uniform-samples/basketball-views.webp");
  await act(async () => basketballReady("data:image/png;base64,basketball"));
  expect(screen.getByRole("img")).toHaveAttribute("data-background-branding", "connect767-embossed-v1");
  expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/png;base64,basketball");
  rerender(<AIUniformSample sport="soccer" />);
  await act(async () => {});
  expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/png;base64,soccer");
  expect(emboss).toHaveBeenCalledTimes(2);
  rerender(<AIUniformSample sport="cricket" />);
  await act(async () => {});
  expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/ai-uniform-samples/cricket-views.webp");
  expect(screen.getByRole("img")).not.toHaveAttribute("data-background-branding");
  rerender(<AIUniformSample sport="soccer" backgroundColor="#ffffff" />);
  expect(emboss).toHaveBeenLastCalledWith("/uploads/ai-uniform-samples/soccer-views.webp", { backgroundColor: "#ffffff" });
  await act(async () => soccerReady("data:image/png;base64,soccer-white-background"));
  expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/png;base64,soccer-white-background");
});
