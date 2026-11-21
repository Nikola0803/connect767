import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CollarAttachment from "./CollarAttachment";

describe("collar attachments", () => {
  it("reads an attachment with its filename and data and allows removal", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<CollarAttachment attachment={null} onChange={onChange} />);
    expect(container.querySelector(".ri-attachment-2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Attach collar logo or artwork"), { target: { files: [new File(["%PDF-1.4 collar logo"], "collar.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "collar.pdf", type: "application/pdf", src: expect.stringMatching(/^data:application\/pdf;base64,/) })));
    rerender(<CollarAttachment attachment={onChange.mock.calls[0][0]} onChange={onChange} />);
    expect(screen.getByText("collar.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove collar attachment" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it("rejects unsupported and oversized files without replacing the current attachment", () => {
    const onChange = vi.fn();
    render(<CollarAttachment onChange={onChange} />);
    const input = screen.getByLabelText("Attach collar logo or artwork");
    fireEvent.change(input, { target: { files: [new File(["text"], "file.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("PNG, JPG, WebP or PDF");
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(2097153)], "large.png", { type: "image/png" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("up to 2 MB");
    expect(onChange).not.toHaveBeenCalled();
  });
});
