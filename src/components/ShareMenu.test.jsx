import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ShareMenu from "./ShareMenu";

describe("ShareMenu", () => {
  it("offers the complete web sharing menu for every listing profile", () => {
    render(<ShareMenu title="James Local Fruits" url="https://connect767.com/listings/james-local-fruits" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    const destinations = [
      "WhatsApp",
      "Facebook",
      "X / Twitter",
      "LinkedIn",
      "Threads",
      "Bluesky",
      "Telegram",
      "Reddit",
      "Pinterest",
      "Email",
      "Text message",
    ];

    destinations.forEach((name) => {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    });
    expect(screen.getByRole("menuitem", { name: "Copy link" })).toBeInTheDocument();
  });

  it("includes the listing title and URL in share destinations", () => {
    render(<ShareMenu title="James Local Fruits" url="https://connect767.com/listings/james-local-fruits" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("menuitem", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("James%20Local%20Fruits"),
    );
    expect(screen.getByRole("menuitem", { name: "Telegram" })).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("https://connect767.com/listings/james-local-fruits")),
    );
  });

  it("provides mobile-safe scrolling and an explicit close control", () => {
    render(<ShareMenu title="Connect767 listing plans" url="https://connect767.com/listings/submit" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("menu")).toHaveClass("touch-pan-y", "overscroll-contain");
    const closeButtons = screen.getAllByRole("button", { name: "Close share menu" });
    expect(closeButtons).toHaveLength(2);

    fireEvent.click(closeButtons[1]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
