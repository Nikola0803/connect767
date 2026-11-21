import { beforeEach, describe, expect, it } from "vitest";
import {
  createUniformOrderDesign,
  designOrderUnitCount,
  loadUniformOrderDesigns,
  persistUniformOrderDesigns,
  removeUniformOrderDesign,
  upsertUniformOrderDesign,
} from "./uniformOrderDraft";

describe("uniform multi-design order draft", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists, updates, and removes separate design items", () => {
    const first = createUniformOrderDesign({ sport: "soccer", template: "Home" }, "design-1");
    const second = createUniformOrderDesign({ sport: "netball", template: "Away" }, "design-2");
    expect(persistUniformOrderDesigns([first, second])).toBe(true);
    expect(loadUniformOrderDesigns()).toHaveLength(2);
    const updated = createUniformOrderDesign({ sport: "soccer", template: "Updated" }, "design-1");
    const items = upsertUniformOrderDesign(loadUniformOrderDesigns(), updated);
    expect(items).toHaveLength(2);
    expect(items[0].payload.template).toBe("Updated");
    expect(removeUniformOrderDesign(items, "design-2")).toEqual([updated]);
  });

  it("counts every shippable unit in a saved design", () => {
    expect(designOrderUnitCount({
      roster: [{ quantity: 10 }, { quantity: 2 }],
      extraTeamShirts: [{ quantity: 3 }],
      fanJerseyAdded: true,
      supporterJerseys: [{ quantity: 4 }],
    })).toBe(19);
  });
});
