import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  config: { customApiUrl: "https://admin.connect767.test/wp-json/connect767/v1" },
  isLiveApi: true,
}));

import { trackMarketingEvent, trackMarketingEventOnce } from "./marketingAnalytics";

describe("privacy-minimized marketing analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/auth/register?utm_source=facebook&utm_medium=social&utm_campaign=dominica-launch");
    Object.defineProperty(document, "referrer", { configurable: true, value: "" });
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "0" });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it("sends only allow-listed events with opaque IDs and UTM attribution", async () => {
    await trackMarketingEvent("registration_started");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toContain("/marketing/events");
    expect(body).toMatchObject({
      event: "registration_started",
      source: "facebook",
      medium: "social",
      campaign: "dominica-launch",
    });
    expect(body.visitorId).toBeTruthy();
    expect(body.sessionId).toBeTruthy();
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("ip");
  });

  it("does not send arbitrary event names", async () => {
    expect(await trackMarketingEvent("publish_campaign")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("honors browser Do Not Track", async () => {
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" });
    expect(await trackMarketingEvent("page_view")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("records a funnel start once per browser session", () => {
    trackMarketingEventOnce("listing_started", "listing_form");
    trackMarketingEventOnce("listing_started", "listing_form");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
