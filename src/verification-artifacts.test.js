import { describe, expect, test } from "bun:test";
import { pickVerificationArtifactPaths } from "./verification-artifacts.js";

describe("pickVerificationArtifactPaths", () => {
  test("prefers after-fix paths", () => {
    const paths = pickVerificationArtifactPaths(
      [
        { path: "/opt/cursor/artifacts/misc.png" },
        { path: "/opt/cursor/artifacts/after-fix/01-repro.png" },
      ],
      5,
    );
    expect(paths).toEqual(["/opt/cursor/artifacts/after-fix/01-repro.png"]);
  });
});
