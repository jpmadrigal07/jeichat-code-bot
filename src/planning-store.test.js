import { describe, expect, it } from "bun:test";
import { createPlanningStore } from "./planning-store.js";

describe("planning store (memory)", () => {
  it("stores and clears agent ids", async () => {
    const store = createPlanningStore();
    await store.set("ch-1", "bc-agent-1");
    await expect(store.get("ch-1")).resolves.toBe("bc-agent-1");
    await store.clear("ch-1");
    await expect(store.get("ch-1")).resolves.toBeNull();
  });

  it("stores base ref per channel", async () => {
    const store = createPlanningStore();
    await store.setBaseRef("ch-1", "develop");
    await expect(store.getBaseRef("ch-1")).resolves.toBe("develop");
    await store.clearBaseRef("ch-1");
    await expect(store.getBaseRef("ch-1")).resolves.toBeNull();
  });
});
