import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import ScrollToTop from "./ScrollToTop";

function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/a"]}>
      <ScrollToTop />
      <Link to="/b">Go to B</Link>
      <BackButton />
      <Routes>
        <Route path="/a" element={<div>Page A</div>} />
        <Route path="/b" element={<div>Page B</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe("ScrollToTop", () => {
  it("does not scroll on the initial mount", () => {
    render(<TestApp />);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the top on a forward (PUSH) navigation", () => {
    render(<TestApp />);
    fireEvent.click(screen.getByText("Go to B"));

    expect(screen.getByText("Page B")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("does not force-scroll on back/forward (POP) navigation, leaving the browser's own restore in place", () => {
    render(<TestApp />);
    fireEvent.click(screen.getByText("Go to B"));
    window.scrollTo.mockClear();

    fireEvent.click(screen.getByText("Go back"));

    expect(screen.getByText("Page A")).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
