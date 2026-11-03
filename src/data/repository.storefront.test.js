import { beforeEach, describe, expect, it } from "vitest";
import { getMyStorefrontSettings, updateMyStorefrontSettings } from "./repository";

describe("local storefront settings persistence", () => {
  beforeEach(() => localStorage.clear());

  it("keeps every layout choice when the design preview is reopened", async () => {
    const saved = await updateMyStorefrontSettings("preview-listing", {
      headline: "Island store",
      welcomeText: "Welcome",
      accentColor: "#0f6b4f",
      aboutText: "",
      shippingMessage: "Pickup available",
      policies: "Final sale",
      productGrid: "4",
      imageRatio: "landscape",
      cardCorners: "square",
      contentWidth: "wide",
      defaultTab: "overview",
      featuredProductIds: [11],
      productOrder: [11, 12],
    });

    expect(saved).toMatchObject({
      productGrid: "4",
      imageRatio: "landscape",
      cardCorners: "square",
      contentWidth: "wide",
      defaultTab: "overview",
    });
    await expect(getMyStorefrontSettings("preview-listing")).resolves.toMatchObject(saved);
  });
});
