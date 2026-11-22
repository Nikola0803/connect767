import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import StudioAccountMenu from "./StudioAccountMenu";

const state = vi.hoisted(() => ({ isAuthenticated: false, name: "" }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => state }));

afterEach(() => { state.isAuthenticated = false; state.name = ""; });

it("keeps sign-in and registration accessible with the studio return path", () => {
  render(<MemoryRouter initialEntries={["/uniforms?mode=scratch&sport=cricket"]}><StudioAccountMenu /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Account and sign in" }));
  expect(screen.getByRole("menuitem", { name: "Sign In" })).toHaveAttribute("href", "/auth/login?redirect=%2Funiforms%3Fmode%3Dscratch%26sport%3Dcricket");
  expect(screen.getByRole("menuitem", { name: "Create Account" })).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("identifies the verified account and still offers switching accounts", () => {
  state.isAuthenticated = true; state.name = "Test member";
  render(<MemoryRouter><StudioAccountMenu verified /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Account and sign in" }));
  expect(screen.getByText("Signed in as Test member")).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Sign in / switch account" })).toBeVisible();
});
