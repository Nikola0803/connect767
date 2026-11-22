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

function schemaGraph() {
  return JSON.parse(document.head.querySelector("#connect767-route-schema")?.textContent || "{}")?.["@graph"] || [];
}

afterEach(() => {
  document.head.innerHTML = "";
});

describe("RouteSeo", () => {
  it("publishes one consistently named shop destination in primary navigation metadata", async () => {
    renderRoute("/");
    await waitFor(() => expect(document.title).toBe("Connect767 | Dominica’s Online Directory"));

    const shopItems = schemaGraph().filter(
      (item) => item?.["@type"] === "SiteNavigationElement" && item.url === "https://connect767.com/shop",
    );
    expect(shopItems).toHaveLength(1);
    expect(shopItems[0].name).toBe("Shop");
  });

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

  it("uses the correct title for the combined account and listing signup route", async () => {
    renderRoute("/auth/register");
    await waitFor(() =>
      expect(document.title).toBe("Create Your Account & Listing | Connect767"),
    );
    expect(description()).toContain("choose a listing plan");
    expect(robots()).toBe("noindex, nofollow");
  });

  it.each([
    ["/auth/login", "Sign In | Connect767"],
    ["/auth/forgot-password", "Reset Your Password | Connect767"],
    ["/auth/reset-password", "Choose a New Password | Connect767"],
    ["/checkout", "Secure Checkout | Connect767"],
    ["/checkout/thank-you", "Order Confirmation | Connect767"],
    ["/dashboard", "Account Dashboard | Connect767"],
    ["/messages", "Messages | Connect767"],
    ["/saved", "Saved Listings | Connect767"],
    ["/shop/customize", "Customize Your Product | Connect767"],
    ["/design-studio", "AI Clothing Design Studio | Connect767"],
    ["/listings/example/edit", "Edit Your Listing | Connect767"],
  ])("assigns valid private route %s a real page title", async (path, title) => {
    renderRoute(path);
    await waitFor(() => expect(document.title).toBe(title));
    expect(document.title).not.toContain("Page Not Found");
    expect(robots()).toBe("noindex, nofollow");
  });

  it("keeps private messaging and profile editing out of search results", async () => {
    const messages = renderRoute("/messages");
    await waitFor(() => expect(robots()).toBe("noindex, nofollow"));
    messages.unmount();

    renderRoute("/listings/example/edit");
    await waitFor(() => expect(robots()).toBe("noindex, nofollow"));
  });

  it("indexes real storefront routes with a self-referencing canonical", async () => {
    renderRoute("/listings/jmwa/shop");
    await waitFor(() => expect(document.title).toBe("Listing Storefront | Connect767"));
    expect(canonical()).toBe("https://connect767.com/listings/jmwa/shop");
    expect(robots()).toBe("index, follow, max-image-preview:large");
  });

  it("preserves generated CMS metadata while hydrating a dynamic route", async () => {
    document.head.innerHTML = `
      <link rel="canonical" href="https://connect767.com/listings/matrix-capital-group" />
      <script id="connect767-route-schema" type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            url: "https://connect767.com/listings/matrix-capital-group",
            name: "Matrix Capital Group | Connect767 Directory",
            description: "Construction, finance and real estate services in Houston.",
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [{ position: 2, name: "Matrix Capital Group" }],
          },
        ],
      })}</script>
    `;

    renderRoute("/listings/matrix-capital-group");
    await waitFor(() =>
      expect(document.title).toBe("Matrix Capital Group | Connect767 Directory"),
    );
    expect(description()).toBe("Construction, finance and real estate services in Houston.");
    expect(canonical()).toBe("https://connect767.com/listings/matrix-capital-group");
  });

  it("marks unknown routes as not found and prevents indexing", async () => {
    renderRoute("/this-page-does-not-exist");
    await waitFor(() => expect(document.title).toBe("Page Not Found | Connect767"));
    expect(robots()).toBe("noindex, nofollow");
  });

  it("keeps filtered collection URLs out of the index while preserving their canonical page", async () => {
    renderRoute("/listings?category=fitness");
    await waitFor(() => expect(robots()).toBe("noindex, follow"));
    expect(canonical()).toBe("https://connect767.com/listings");
  });
});
