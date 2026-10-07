import { describe, expect, test } from "bun:test";
import {
  parseRoutesFromSpec,
  parseVerifyScope,
  resolveVerifyBrowseUrls,
} from "./verify-spec.js";

const SPEC = `## Routes
http://localhost:3001/settings
/w/demo/inbox?settings=account

## Verify scope
static-only

## Verify commands
cd apps/web && bun run check-types
`;

describe("verify-spec", () => {
  test("parseVerifyScope detects static-only", () => {
    expect(parseVerifyScope(SPEC)).toBe("static-only");
    expect(parseVerifyScope("## Verify scope\nbrowser")).toBe("browser");
    expect(parseVerifyScope("")).toBe("browser");
  });

  test("parseRoutesFromSpec collects urls and paths", () => {
    expect(parseRoutesFromSpec(SPEC)).toEqual([
      "http://localhost:3001/settings",
      "/w/demo/inbox?settings=account",
    ]);
  });

  test("resolveVerifyBrowseUrls prefers routes", () => {
    expect(resolveVerifyBrowseUrls(SPEC, "https://app/ticket")).toEqual([
      "http://localhost:3001/settings",
      "/w/demo/inbox?settings=account",
    ]);
    expect(resolveVerifyBrowseUrls("", "https://app/ticket")).toEqual([
      "https://app/ticket",
    ]);
  });
});
