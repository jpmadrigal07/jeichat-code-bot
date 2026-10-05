import { describe, expect, test } from "bun:test";
import {
  buildAgentUserMessage,
  collectImageAttachments,
  formatAttachmentsForTranscript,
  isImageContentType,
  normalizeAttachments,
} from "./message-attachments.js";

describe("message attachments", () => {
  test("normalizeAttachments keeps id and mime", () => {
    expect(
      normalizeAttachments([
        { id: "a1", filename: "mock.png", contentType: "image/png", sizeBytes: 100 },
      ]),
    ).toEqual([
      {
        id: "a1",
        filename: "mock.png",
        contentType: "image/png",
        sizeBytes: 100,
      },
    ]);
  });

  test("formatAttachmentsForTranscript labels images", () => {
    expect(
      formatAttachmentsForTranscript([
        { id: "a1", filename: "ui.png", contentType: "image/png" },
        { id: "a2", filename: "spec.pdf", contentType: "application/pdf" },
      ]),
    ).toBe("[image: ui.png] [file: spec.pdf]");
  });

  test("collectImageAttachments prefers trigger message", () => {
    const messages = [
      {
        id: "m1",
        attachments: [
          { id: "old", filename: "old.png", contentType: "image/png" },
        ],
      },
      {
        id: "m2",
        attachments: [
          { id: "new", filename: "new.png", contentType: "image/png" },
        ],
      },
    ];
    const picked = collectImageAttachments(messages, {
      triggerMessageId: "m2",
    });
    expect(picked.map((row) => row.id)).toEqual(["new", "old"]);
  });

  test("buildAgentUserMessage passes images when present", () => {
    expect(buildAgentUserMessage("hello", [])).toBe("hello");
    expect(buildAgentUserMessage("hello", [{ url: "https://x/y.png" }])).toEqual({
      text: "hello",
      images: [{ url: "https://x/y.png" }],
    });
  });

  test("isImageContentType", () => {
    expect(isImageContentType("image/webp")).toBe(true);
    expect(isImageContentType("application/pdf")).toBe(false);
  });
});
