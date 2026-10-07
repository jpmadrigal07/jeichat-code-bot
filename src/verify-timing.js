export function cursorAgentUrl(agentId) {
  const id = String(agentId ?? "").trim();
  if (!id) return null;
  return `https://cursor.com/agents/${id}`;
}

export function verifyRunTimeoutMs() {
  const raw = process.env.REVIEWER_RUN_TIMEOUT_MS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 20 * 60 * 1000;
}

export function buildWaitTimeoutMs() {
  const raw = process.env.CODE_BUILD_WAIT_TIMEOUT_MS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 45 * 60 * 1000;
}

export function verifyAfterBuildEnabled() {
  const raw = process.env.CODE_VERIFY_AFTER_BUILD?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}
