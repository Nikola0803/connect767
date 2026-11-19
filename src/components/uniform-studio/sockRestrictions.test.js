import { describe, expect, it } from "vitest";
import {
  isRestrictedSoccerSockPlacement,
  removeRestrictedSoccerSockLayers,
} from "./sockRestrictions";

describe("soccer sock artwork restrictions", () => {
  it("blocks artwork in soccer sock zones while allowing shirt artwork", () => {
    expect(isRestrictedSoccerSockPlacement({ sport: "soccer", view: "front", zone: "socks", y: 55 })).toBe(true);
    expect(isRestrictedSoccerSockPlacement({ sport: "soccer", view: "back", y: 78 })).toBe(true);
    expect(isRestrictedSoccerSockPlacement({ sport: "soccer", view: "front", zone: "body", y: 28 })).toBe(false);
  });

  it("does not impose the soccer rule on other garments or sleeve windows", () => {
    expect(isRestrictedSoccerSockPlacement({ sport: "goalkeeper", view: "front", zone: "socks", y: 78 })).toBe(false);
    expect(isRestrictedSoccerSockPlacement({ sport: "soccer", view: "sleeve-left", y: 78 })).toBe(false);
  });

  it("removes incompatible legacy layers from soccer designs", () => {
    expect(removeRestrictedSoccerSockLayers([
      { id: "chest", view: "front", y: 25 },
      { id: "sock-logo", view: "front", y: 76 },
    ], "soccer")).toEqual([{ id: "chest", view: "front", y: 25 }]);
  });
});
