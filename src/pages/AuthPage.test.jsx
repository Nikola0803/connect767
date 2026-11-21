import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AuthPage from "./AuthPage";

function renderAuth(path) {
  render(<MemoryRouter initialEntries={[path]}><AuthPage /></MemoryRouter>);
}

describe("AuthPage minimalist authentication layout", () => {
  it("shows the streamlined sign-in experience", () => {
    renderAuth("/auth/login");

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(screen.getByText("Manage your listings, orders, and uniform designs.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign In" })).toHaveClass("bg-primary-600", "text-white");
    expect(screen.getByRole("button", { name: "Sign in" })).not.toHaveTextContent("→");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/auth/register");
  });

  it("keeps Account Name and simplifies registration copy", () => {
    renderAuth("/auth/register");

    expect(screen.getByRole("heading", { name: "Create account" })).toBeVisible();
    expect(screen.getByLabelText("Account Name")).toBeVisible();
    expect(screen.getByLabelText("Confirm password")).toBeVisible();
    expect(screen.queryByText("At least 8 characters")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("Password"));
    expect(screen.getByText("At least 8 characters")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create account" })).not.toHaveTextContent("→");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login");
  });

  it("uses the same active green tab treatment in both states", () => {
    renderAuth("/auth/register");
    const tabs = screen.getByRole("button", { name: "Register" }).parentElement;
    expect(within(tabs).getByRole("button", { name: "Register" })).toHaveClass("bg-primary-600", "text-white");
  });

  it("keeps a safe studio return path while switching between sign in and registration", () => {
    renderAuth("/auth/login?redirect=%2Funiforms%3Fsport%3Dsoccer");

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/auth/register?redirect=%2Funiforms%3Fsport%3Dsoccer",
    );
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Funiforms%3Fsport%3Dsoccer",
    );
  });
});
