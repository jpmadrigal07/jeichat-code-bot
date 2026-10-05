import { ApiError } from "./client.js";

export const HELP_TEXT = [
  "Planning bot — shape work in the ticket thread, then implement.",
  "",
  "`help` — this message",
  "`status` — planning session + description snapshot",
  "`base <branch>` — git branch to branch **from** for this ticket (e.g. `base develop`)",
  "`draft` — write Base ref / Branch / Goal / Done when / UI refs into the ticket description (ends planning session)",
  "`build` — new Cursor coding run + PR from the description (only when you ask)",
  "",
  "Or mention me with normal text to continue the **same** planning conversation.",
  "Fixer assignee flow is `jeichat-fixer-bot`, not this bot.",
].join("\n");

export function parseCommand(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const head = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (!head) return null;
  if (head === "help") return { name: "help" };
  if (head === "status") return { name: "status" };
  if (head === "base") {
    const ref = trimmed.split(/\s+/).slice(1).join(" ").trim();
    return ref ? { name: "base", ref } : { name: "base", ref: null };
  }
  if (head === "draft") return { name: "draft" };
  if (head === "build") return { name: "build" };
  return null;
}

export function commandError(error) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Command failed.";
}
