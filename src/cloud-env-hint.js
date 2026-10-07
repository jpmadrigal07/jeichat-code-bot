export function isCloudRuntime(runtime) {
  return (runtime ?? process.env.CURSOR_RUNTIME ?? "cloud") === "cloud";
}

/**
 * @param {{ runtime?: string }} [ctx]
 * @returns {string} empty when not cloud
 */
export function cursorCloudEnvDirections(ctx = {}) {
  if (!isCloudRuntime(ctx.runtime)) return "";

  return [
    "Environment (Cursor Cloud):",
    "Repo infrastructure secrets (`DATABASE_URL`, auth keys, storage, etc.) are already injected into this VM as **process environment variables** from the linked repo's **Cursor Cloud Environment** secrets.",
    "Use `.env.example` as a checklist of variable **names** only — do not create, paste, or commit a `.env` file for secrets.",
    "UI test login is in the **ticket specification** (below), not in cloud secrets.",
  ].join("\n");
}

/** One checklist line for verify prompts. */
export function cursorCloudEnvVerifyBullet(ctx = {}) {
  if (!isCloudRuntime(ctx.runtime)) return "";
  return (
    "   - **Config:** Infrastructure secrets are already in `process.env` from **Cursor Cloud Environment**; use `.env.example` for names only. Do not commit `.env`."
  );
}
