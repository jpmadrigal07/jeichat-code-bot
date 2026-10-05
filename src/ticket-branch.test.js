import { describe, expect, test } from "bun:test";
import {
  ensureSpecBranch,
  isCompleteTicketSpec,
  suggestedTicketBranchName,
} from "./ticket-branch.js";

describe("suggestedTicketBranchName", () => {
  test("matches JeiChat GitHub panel format", () => {
    expect(
      suggestedTicketBranchName("gen", 19, "code bot test 123"),
    ).toBe("GEN-19-code-bot-test-123");
  });

  test("returns null without key or number", () => {
    expect(suggestedTicketBranchName("", 19, "x")).toBeNull();
    expect(suggestedTicketBranchName("GEN", null, "x")).toBeNull();
  });
});

describe("ensureSpecBranch", () => {
  test("replaces cursor-style branch with ticket code", () => {
    const spec = `## Base ref
develop

## Branch
cursor/ticket-title-copy-cd34

## Goal
Copy title
`;
    expect(ensureSpecBranch(spec, "GEN-19-code-bot-test-123")).toContain(
      "## Branch\nGEN-19-code-bot-test-123",
    );
    expect(ensureSpecBranch(spec, "GEN-19-code-bot-test-123")).not.toContain(
      "cursor/",
    );
  });
});

describe("isCompleteTicketSpec", () => {
  test("requires all section headings", () => {
    expect(isCompleteTicketSpec("## Branch\nx\n## Goal\ny")).toBe(false);
    expect(
      isCompleteTicketSpec(`## Base ref
develop
## Branch
GEN-1-a
## Goal
g
## Done when
- [ ] x
## UI refs
path`),
    ).toBe(true);
  });
});
