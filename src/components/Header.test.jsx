import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CartProvider } from "../hooks/useCart";
import { describe, expect, it } from "vitest";
import Header, { AccountAvatar } from "./Header";

it("keeps five mobile destinations outside the blurred header and retains Saved in the menu", () => {
  localStorage.clear();
  render(<MemoryRouter initialEntries={["/listings"]}><CartProvider><Header /></CartProvider></MemoryRouter>);
  const bar = screen.getByRole("navigation", { name: "Mobile quick navigation" });
  expect(bar.closest("header")).toBeNull();
  expect(within(bar).getAllByRole("link").map(link => link.textContent.trim())).toEqual(["Home", "Directory", "Shop", "Community", "Account"]);
  expect(within(bar).getByRole("link", { name: "Account" })).toHaveAttribute("href", "/auth/login");
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  const menu = screen.getByRole("navigation", { name: "Mobile menu" });
  for (const label of ["Directory", "Shop", "Community", "Uniform Studio", "Blog", "Saved"]) expect(within(menu).getByRole("link", { name: label })).toBeInTheDocument();
  fireEvent.click(within(menu).getByRole("link", { name: "Shop", exact: true }));
  expect(screen.queryByRole("navigation", { name: "Mobile menu" })).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Mobile quick navigation" })).toBeInTheDocument();
});

it("does not mark Shop active while the Ready-Made storefront is selected", () => {
  render(<MemoryRouter initialEntries={["/shop?category=ready-made-designs"]}><CartProvider><Header /></CartProvider></MemoryRouter>);
  const mainNavigation = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(mainNavigation).getByRole("link", { name: "Shop" })).not.toHaveClass("bg-primary-50");
  const quickNavigation = screen.getByRole("navigation", { name: "Mobile quick navigation" });
  expect(within(quickNavigation).getByRole("link", { name: "Shop" })).not.toHaveAttribute("aria-current");
});

describe("AccountAvatar", () => {
  it("shows the signed-in user's saved profile photo with its crop", () => {
    render(
      <AccountAvatar
        email="owner@example.com"
        src="https://example.com/profile.jpg"
        position="25% 70%"
        zoom={1.3}
      />,
    );

    const image = screen.getByRole("img", { name: "Profile photo" });
    expect(image).toHaveAttribute("src", "https://example.com/profile.jpg");
    expect(image).toHaveStyle({
      objectPosition: "25% 70%",
      transform: "scale(1.3)",
      transformOrigin: "25% 70%",
    });
  });

  it("falls back to the email initial when the photo cannot load", () => {
    render(<AccountAvatar email="owner@example.com" src="https://example.com/missing.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Profile photo" }));
    expect(screen.queryByRole("img", { name: "Profile photo" })).not.toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
  });
});
