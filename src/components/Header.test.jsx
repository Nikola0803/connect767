import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountAvatar } from "./Header";

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
