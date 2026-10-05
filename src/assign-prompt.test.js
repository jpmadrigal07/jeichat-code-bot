import { expect, test } from "bun:test";
import { formatPlanningAssignPrompt } from "./assign-prompt.js";

test("formatPlanningAssignPrompt mentions bot and ticket", () => {
  const text = formatPlanningAssignPrompt("Code", "GEN-12");
  expect(text).toContain("GEN-12");
  expect(text).toContain("@Code");
  expect(text).toContain("draft");
  expect(text).toContain("What should this ticket deliver?");
});
