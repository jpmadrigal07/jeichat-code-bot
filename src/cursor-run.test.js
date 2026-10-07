import { describe, expect, test } from "bun:test";
import {
  isRecoverableCursorRunError,
  isStreamUnavailableResult,
} from "./cursor-run.js";

describe("cursor-run", () => {
  test("detects stream_unavailable results", () => {
    expect(
      isStreamUnavailableResult({
        status: "error",
        error: { code: "stream_unavailable", message: "Run stream is no longer available" },
      }),
    ).toBe(true);
  });

  test("treats stream errors as recoverable", () => {
    expect(
      isRecoverableCursorRunError(
        new Error("Cursor run failed: Run stream is no longer available"),
      ),
    ).toBe(true);
  });
});
