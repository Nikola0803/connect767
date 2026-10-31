import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import RouteSeo from "./RouteSeo";

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteSeo />
    </MemoryRouter>,
  );
}

function description() {
  return document.head.querySelector('meta[name="description"]')?.getAttribute("content");
}

function canonical() {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");
}

function robots() {
  return document.head.querySelector('meta[name="robots"]')?.getAttribute("content");
}

afterEach(() => {
  document.head.innerHTML = "";
});

describe("RouteSeo", () => {
  it("uses distinct metadata for public site sections", async () => {
    const shop = renderRoute("/shop");
    await waitFor(() => expect(document.title).toBe("Shop Dominican Products & Apparel | Connect767"));
    const shopDescription = description();
    shop.unmount();

    renderRoute("/uniforms");
    await waitFor(() => expect(document.title).toBe("3D Custom Uniform Studio | Connect767"));
    expect(description()).not.toBe(shopDescription);
    expect(canonical()).toBe("https://connect767.com/uniforms");
  });

  it("gives the listing signup page its own indexable search metadata", async () => {
    renderRoute("/listings/submit");
    await waitFor(() =>
      expect(document.title).toBe("List Your Business or Professional Profile | Connect767"),
    );
    expect(description()).toContain("Free and Classified listing plans");
    expect(canonical()).toBe("https://connect767.com/listings/submit");
    expect(robots()).toBe("index, follow, max-image-preview:large");
  });

  it("keeps private messaging and profile editing out of search results", async () => {
    const messages = renderRoute("/messages");
    await waitFor(() => expect(robots()).toBe("noindex, nofollow"));
    messages.unmount();

    renderRoute("/listings/example/edit");
    await waitFor(() => expect(robots()).toBe("noindex, nofollow"));
  });
});
