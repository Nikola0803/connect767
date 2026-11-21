import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("keeps supported editorial markup", () => {
    const result = sanitizeHtml('<h2>Welcome</h2><p><strong>Local</strong> news</p><a href="https://example.com" target="_blank">Read</a>');
    expect(result).toContain("<h2>Welcome</h2>");
    expect(result).toContain("<strong>Local</strong>");
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("removes scripts, event handlers, and dangerous URLs", () => {
    const result = sanitizeHtml('<script>alert(1)</script><p onclick="alert(1)">Safe</p><a href="javascript:alert(1)">Bad</a><img src="data:text/html,evil">');
    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("<img");
    expect(result).toContain("<p>Safe</p>");
  });

  it("unwraps unknown formatting tags while preserving text", () => {
    expect(sanitizeHtml("<section><span>Useful text</span></section>")).toBe("Useful text");
  });
});
