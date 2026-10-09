import { describe, expect, test } from "bun:test";
import {
  globalBootCommands,
  globalBootRequired,
  verifyBootPackagePaths,
} from "./verify-boot.js";

function withEnv(overrides, fn) {
  const prev = {};
  for (const [key, value] of Object.entries(overrides)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("verify-boot", () => {
  test("repo config takes priority over env", () => {
    withEnv({ VERIFY_BOOT_PACKAGES: "apps/other" }, () => {
      const cmds = globalBootCommands({
        packages: ["apps/messages-api"],
        sourcePath: ".jeichat/verify-boot.json",
      });
      expect(cmds).toContain("cd apps/messages-api && bun install && bun run build");
      expect(cmds.some((c) => c.includes("apps/other"))).toBe(false);
      expect(globalBootRequired({ sourcePath: ".jeichat/verify-boot.json", packages: ["apps/a"] })).toBe(true);
    });
  });

  test("env fallback when no repo config", () => {
    withEnv(
      {
        VERIFY_BOOT_PACKAGES: "apps/web",
        VERIFY_GLOBAL_BOOT_COMMANDS: undefined,
      },
      () => {
        expect(verifyBootPackagePaths()).toEqual(["apps/web"]);
        expect(globalBootCommands(null).length).toBeGreaterThan(0);
      },
    );
  });

  test("VERIFY_GLOBAL_BOOT_COMMANDS enables required boot without VERIFY_GLOBAL_BOOT", () => {
    withEnv(
      {
        VERIFY_GLOBAL_BOOT_COMMANDS: "bun install|bun run build",
        VERIFY_BOOT_PACKAGES: undefined,
      },
      () => {
        expect(globalBootRequired(null)).toBe(true);
        expect(globalBootCommands(null)).toEqual([
          "bun install",
          "bun run build",
        ]);
      },
    );
  });
});
