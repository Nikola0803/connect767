import { describe, expect, it } from "vitest";
import { isRecoverableAssetError } from "./ErrorBoundary";

describe("ErrorBoundary deployment recovery", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/DashboardPage-old.js",
    "Importing a module script failed.",
    "ChunkLoadError: Loading chunk 42 failed.",
    "Unable to preload CSS for /assets/index-old.css",
  ])("recognizes a stale deployment asset failure: %s", (message) => {
    expect(isRecoverableAssetError(new Error(message))).toBe(true);
  });

  it("does not reload for an ordinary application error", () => {
    expect(isRecoverableAssetError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});
