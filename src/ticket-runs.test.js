import { describe, expect, test } from "bun:test";
import { createTicketRunTracker } from "./ticket-runs.js";

describe("ticket-runs", () => {
  test("blocks overlapping verify", () => {
    const runs = createTicketRunTracker();
    expect(runs.tryStart("ch-1", "verify").ok).toBe(true);
    const second = runs.tryStart("ch-1", "verify");
    expect(second.ok).toBe(false);
    expect(second.current?.phase).toBe("verify");
  });

  test("blocks build while verify runs", () => {
    const runs = createTicketRunTracker();
    runs.tryStart("ch-1", "verify");
    expect(runs.tryStart("ch-1", "build").ok).toBe(false);
  });

  test("end releases channel", () => {
    const runs = createTicketRunTracker();
    runs.tryStart("ch-1", "build");
    runs.end("ch-1", "build");
    expect(runs.tryStart("ch-1", "verify").ok).toBe(true);
  });
});
