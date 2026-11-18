import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIArtworkPanel } from "./StudioPanels";

const colors = {
  body: "#123456",
  sleeve: "#234567",
  collar: "#345678",
  shorts: "#456789",
  socks: "#56789A",
  shirtStrip: "#6789AB",
  sleeveStrip: "#789ABC",
  shortsStrip: "#89ABCD",
};

const plan = {
  name: "Exact colour kit",
  summary: "A production-first uniform.",
  collar: "Crew",
  sleeve: "Short",
  colors,
  pattern: { enabled: false, key: "none", view: "all" },
  crestSuggestion: "",
  productionElements: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AI production-first preview", () => {
  it("returns the structured plan without requesting a separate concept image", async () => {
    const onUniformPlanChange = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
      if (!options.method) return { ok: true, json: async () => ({ configured: true }) };
      if (url === "/api/generate-uniform-design") {
        return { ok: true, json: async () => ({ plan }) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(
      <AIArtworkPanel
        sport="Soccer"
        colors={colors}
        collar="Crew"
        sleeve="Short"
        collarOptions={["Crew", "V-Neck"]}
        sleeveOptions={["Short", "Long"]}
        onUniformPlanChange={onUniformPlanChange}
        onReferenceChange={() => {}}
        onModeChange={() => {}}
        onPlace={() => {}}
        onApplyUniform={() => {}}
        onUndoUniform={() => {}}
      />,
    );

    const prompt = screen.getByLabelText("Message Connect767 AI");
    fireEvent.change(prompt, { target: { value: "Create a navy and gold kit" } });
    const send = screen.getByLabelText("Send message");
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await waitFor(() => expect(onUniformPlanChange).toHaveBeenLastCalledWith(plan));
    const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts.map(([url]) => url)).toEqual(["/api/generate-uniform-design"]);
    expect(onUniformPlanChange.mock.calls.at(-1)[0]).not.toHaveProperty("conceptImage");
  });
});
