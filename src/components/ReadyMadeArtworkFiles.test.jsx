import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReadyMadeArtworkFiles from "./ReadyMadeArtworkFiles";
import { ARTWORK_MAX_FILE_BYTES, ARTWORK_MAX_TOTAL_BYTES, readyMadeArtworkIssue } from "../lib/readyMadeArtwork";

function Harness() {
  const [files, setFiles] = useState([]);
  const [reading, setReading] = useState(false);
  return <ReadyMadeArtworkFiles items={[{ key: "home", slug: "home", title: "Home kit" }, { key: "away", slug: "away", title: "Away kit" }]} files={files} setFiles={setFiles} ready reading={reading} setReading={setReading} />;
}

describe("ready-made team and sponsor artwork", () => {
  it("attaches multiple files, retains placement/design choices and removes only the chosen file", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Add team logos"), { target: { files: [new File(["team"], "crest.png", { type: "image/png" }), new File(["alt"], "alternate.png", { type: "image/png" })] } });
    await screen.findByText("crest.png");
    await screen.findByText("alternate.png");
    fireEvent.change(screen.getByLabelText("Placement notes for crest.png"), { target: { value: "Left chest" } });
    fireEvent.change(screen.getByLabelText("Design for crest.png"), { target: { value: "home" } });
    fireEvent.change(screen.getByLabelText("Add sponsor files"), { target: { files: [new File(["%PDF-1.4"], "sponsor.pdf", { type: "application/pdf" })] } });
    await screen.findByText("sponsor.pdf");
    expect(screen.getByText("Sponsor file")).toBeInTheDocument();
    expect(screen.getByLabelText("Placement notes for crest.png")).toHaveValue("Left chest");
    expect(screen.getByLabelText("Design for crest.png")).toHaveValue("home");
    fireEvent.click(screen.getByRole("button", { name: "Remove alternate.png" }));
    await waitFor(() => expect(screen.queryByText("alternate.png")).not.toBeInTheDocument());
    expect(screen.getByText("crest.png")).toBeInTheDocument();
    expect(screen.getByText("sponsor.pdf")).toBeInTheDocument();
  });

  it("rejects unsupported and oversized files without adding them", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Add sponsor files"), { target: { files: [new File(["bad"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("PNG, JPG, WebP or PDF");
    fireEvent.change(screen.getByLabelText("Add team logos"), { target: { files: [new File([new Uint8Array(ARTWORK_MAX_FILE_BYTES + 1)], "large.png", { type: "image/png" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("no larger than 2 MB");
    expect(screen.queryByText("large.png")).not.toBeInTheDocument();
    expect(screen.queryByText("logo.svg")).not.toBeInTheDocument();
  });

  it("enforces cumulative limits and rejects a design removed from the cart", () => {
    const file = { name: "logo.png", type: "image/png", size: ARTWORK_MAX_TOTAL_BYTES / 2 + 1 };
    expect(readyMadeArtworkIssue([file, file])).toContain("3 MB");
    expect(readyMadeArtworkIssue(Array(11).fill({ ...file, size: 10 }))).toContain("10");
    expect(readyMadeArtworkIssue([{ ...file, productSlug: "old" }], [{ slug: "home" }])).toContain("current design");
    expect(readyMadeArtworkIssue([])).toBe("");
  });
});
