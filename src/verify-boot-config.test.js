import { describe, expect, test } from "bun:test";
import {
  commandsFromVerifyBootConfig,
  parseVerifyBootConfig,
} from "./verify-boot-config.js";

describe("verify-boot-config", () => {
  test("parses packages into commands", () => {
    const config = parseVerifyBootConfig(`{
      "packages": ["apps/messages-api", "apps/web"],
      "globalBoot": true
    }`);
    expect(config?.packages).toEqual(["apps/messages-api", "apps/web"]);
    expect(commandsFromVerifyBootConfig(config)).toEqual([
      "bun install",
      "cd apps/messages-api && bun install && bun run build",
      "cd apps/web && bun install && bun run build",
    ]);
  });

  test("explicit commands win", () => {
    const config = parseVerifyBootConfig(`{
      "commands": ["bun install", "turbo build"]
    }`);
    expect(commandsFromVerifyBootConfig(config)).toEqual([
      "bun install",
      "turbo build",
    ]);
  });
});
