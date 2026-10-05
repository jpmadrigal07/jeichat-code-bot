export function isRecoverableCursorRunError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("stream is no longer available") ||
    message.includes("Cursor run failed") ||
    message.includes("AgentExecStreamStartTimeout")
  );
}

export async function readAssistantText(run) {
  let text = "";

  if (run.supports("stream")) {
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
  }

  const result = await run.wait();
  if (!text.trim() && typeof result.result === "string") {
    text = result.result;
  }

  if (result.status === "error") {
    const detail = result.error?.message?.trim();
    if (text.trim()) return text.trim();
    const message = detail
      ? `Cursor run failed: ${detail}`
      : `Cursor run failed (${result.id ?? "unknown"})`;
    const err = new Error(message);
    if (detail) err.cause = result.error;
    throw err;
  }

  return text.trim();
}
