const DEFAULT_WAIT_ATTEMPTS = 4;
const DEFAULT_WAIT_BASE_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isStreamUnavailableMessage(message) {
  const text = String(message ?? "");
  return (
    text.includes("stream is no longer available") ||
    text.includes("stream_unavailable")
  );
}

export function isStreamUnavailableResult(result) {
  if (!result || result.status !== "error") return false;
  const code = result.error?.code;
  const message = result.error?.message;
  if (code === "stream_unavailable") return true;
  return isStreamUnavailableMessage(message);
}

export function isRecoverableCursorRunError(error) {
  const message = errorMessage(error);
  return (
    isStreamUnavailableMessage(message) ||
    message.includes("Cursor run failed") ||
    message.includes("AgentExecStreamStartTimeout")
  );
}

function runStreamEnabled() {
  const raw = process.env.CURSOR_RUN_STREAM?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function waitAttempts() {
  const raw = process.env.CURSOR_RUN_WAIT_ATTEMPTS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_WAIT_ATTEMPTS;
}

async function collectStreamText(run) {
  let text = "";
  if (!run.supports("stream")) return text;
  try {
    for await (const event of run.stream()) {
      if (event.type !== "assistant") continue;
      for (const block of event.message.content) {
        if (block.type === "text") text += block.text;
      }
    }
  } catch (error) {
    console.warn("run.stream ended with error", error);
  }
  return text;
}

async function waitForRunResult(run) {
  const attempts = waitAttempts();
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await run.wait();
    if (!isStreamUnavailableResult(last)) return last;
    if (attempt < attempts - 1) {
      await sleep(DEFAULT_WAIT_BASE_MS * (attempt + 1));
    }
  }
  return last;
}

function textFromResult(result) {
  if (typeof result.result === "string") return result.result.trim();
  return "";
}

/**
 * Wait for a Cursor run and return assistant text.
 * Default: no SSE stream (stream then wait often yields stream_unavailable on cloud).
 */
export async function readAssistantText(run) {
  let text = "";

  if (runStreamEnabled()) {
    text = await collectStreamText(run);
  }

  const result = await waitForRunResult(run);
  if (!text.trim()) {
    text = textFromResult(result);
  }

  if (result.status === "error") {
    if (text.trim()) return text.trim();
    const detail = result.error?.message?.trim();
    const message = detail
      ? `Cursor run failed: ${detail}`
      : `Cursor run failed (${result.id ?? "unknown"})`;
    const err = new Error(message);
    if (detail) err.cause = result.error;
    throw err;
  }

  return text.trim();
}
