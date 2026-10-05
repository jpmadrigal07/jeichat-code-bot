import { describe, expect, it } from "bun:test";
import { parseCommand } from "./commands.js";

describe("parseCommand", () => {
  it("parses draft and build", () => {
    expect(parseCommand("draft")).toEqual({ name: "draft" });
    expect(parseCommand("build")).toEqual({ name: "build" });
    expect(parseCommand("status")).toEqual({ name: "status" });
    expect(parseCommand("base develop")).toEqual({
      name: "base",
      ref: "develop",
    });
  });

  it("returns null for free text", () => {
    expect(parseCommand("lets add dark mode")).toBeNull();
  });
});
