import { describe, expect, test } from "bun:test";
import {
  parseBaseRefFromDescription,
  parseBaseRefFromMessage,
  sanitizeBaseRef,
} from "./base-ref.js";

describe("base ref", () => {
  test("sanitizeBaseRef", () => {
    expect(sanitizeBaseRef("develop")).toBe("develop");
    expect(sanitizeBaseRef("origin/main")).toBe("main");
    expect(sanitizeBaseRef("bad branch")).toBeNull();
  });

  test("parseBaseRefFromMessage", () => {
    expect(parseBaseRefFromMessage("base develop")).toBe("develop");
    expect(parseBaseRefFromMessage("we'll be branching from release/1.2")).toBe(
      "release/1.2",
    );
  });

  test("parseBaseRefFromDescription", () => {
    const md = `## Base ref
develop

## Branch
feat/x`;
    expect(parseBaseRefFromDescription(md)).toBe("develop");
  });
});
