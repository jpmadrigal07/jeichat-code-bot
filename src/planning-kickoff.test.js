import { describe, expect, test } from "bun:test";
import {
  shouldSendPlanningKickoff,
  ticketHasPlanningSpec,
} from "./planning-kickoff.js";

describe("planning kickoff", () => {
  test("skips backfill unless CODE_BOT_ASSIGN_BACKFILL=1", () => {
    const prev = process.env.CODE_BOT_ASSIGN_BACKFILL;
    delete process.env.CODE_BOT_ASSIGN_BACKFILL;
    expect(
      shouldSendPlanningKickoff({ description: "" }, { source: "backfill" }),
    ).toBe(false);
    process.env.CODE_BOT_ASSIGN_BACKFILL = "1";
    expect(
      shouldSendPlanningKickoff({ description: "" }, { source: "backfill" }),
    ).toBe(true);
    if (prev === undefined) delete process.env.CODE_BOT_ASSIGN_BACKFILL;
    else process.env.CODE_BOT_ASSIGN_BACKFILL = prev;
  });

  test("skips when ticket has spec", () => {
    const desc = `## Goal
x
## Done when
- [ ] y`;
    expect(ticketHasPlanningSpec(desc)).toBe(true);
    expect(
      shouldSendPlanningKickoff({ description: desc }, { source: "assign" }),
    ).toBe(false);
  });
});
