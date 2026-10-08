import { describe, expect, test } from "bun:test";
import { resolveCursorModelSelection } from "./cursor-options.js";

describe("resolveCursorModelSelection", () => {
  test("composer-2.5 defaults to non-fast variant", () => {
    const prevModel = process.env.CURSOR_MODEL;
    const prevFast = process.env.CURSOR_MODEL_FAST;
    process.env.CURSOR_MODEL = "composer-2.5";
    delete process.env.CURSOR_MODEL_FAST;
    expect(resolveCursorModelSelection()).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "false" }],
    });
    if (prevModel === undefined) delete process.env.CURSOR_MODEL;
    else process.env.CURSOR_MODEL = prevModel;
    if (prevFast === undefined) delete process.env.CURSOR_MODEL_FAST;
    else process.env.CURSOR_MODEL_FAST = prevFast;
  });

  test("CURSOR_MODEL_FAST=1 enables fast", () => {
    const prevModel = process.env.CURSOR_MODEL;
    const prevFast = process.env.CURSOR_MODEL_FAST;
    process.env.CURSOR_MODEL = "composer-2.5";
    process.env.CURSOR_MODEL_FAST = "1";
    expect(resolveCursorModelSelection().params).toEqual([
      { id: "fast", value: "true" },
    ]);
    if (prevModel === undefined) delete process.env.CURSOR_MODEL;
    else process.env.CURSOR_MODEL = prevModel;
    if (prevFast === undefined) delete process.env.CURSOR_MODEL_FAST;
    else process.env.CURSOR_MODEL_FAST = prevFast;
  });
});
