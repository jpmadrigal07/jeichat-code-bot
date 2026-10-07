import { describe, expect, test } from "bun:test";

// Retry helpers are module-private; document expected backoff via client behavior in integration.
describe("JeiChat client", () => {
  test("ApiError exposes 429 status", async () => {
    const { ApiError } = await import("./client.js");
    const err = new ApiError(429, { message: "Too Many Requests" });
    expect(err.status).toBe(429);
    expect(err.message).toBe("Too Many Requests");
  });
});
