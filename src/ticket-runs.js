export function formatElapsed(startedAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const PHASE_LABEL = {
  build: "Cursor **build** (and auto-verify when enabled)",
  verify: "Cursor **verification**",
};

/**
 * One long-running Cursor pipeline per ticket channel (build and/or verify).
 */
export function createTicketRunTracker() {
  /** @type {Map<string, { phase: 'build' | 'verify'; startedAt: number; agentId?: string | null }>} */
  const runs = new Map();

  return {
    get(channelId) {
      return runs.get(String(channelId)) ?? null;
    },

    isActive(channelId) {
      return runs.has(String(channelId));
    },

    /**
     * @param {'build' | 'verify'} phase
     */
    tryStart(channelId, phase, meta = {}) {
      const id = String(channelId);
      const current = runs.get(id);
      if (current) {
        return { ok: false, current };
      }
      runs.set(id, {
        phase,
        startedAt: Date.now(),
        agentId: meta.agentId ?? null,
      });
      return { ok: true };
    },

    update(channelId, patch) {
      const id = String(channelId);
      const current = runs.get(id);
      if (!current) return;
      runs.set(id, { ...current, ...patch });
    },

    /**
     * @param {'build' | 'verify'} [phase] when set, only clears if phase matches
     */
    end(channelId, phase) {
      const id = String(channelId);
      const current = runs.get(id);
      if (!current) return;
      if (phase && current.phase !== phase) return;
      runs.delete(id);
    },

    conflictMessage(current) {
      const label = PHASE_LABEL[current.phase] ?? current.phase;
      const elapsed = formatElapsed(current.startedAt);
      const agent = current.agentId ? ` Agent \`${current.agentId}\`.` : "";
      return `Already running ${label} on this ticket (for **${elapsed}**).${agent} I will post here when it finishes — no need to run the command again.`;
    },

    statusLine(channelId) {
      const current = runs.get(String(channelId));
      if (!current) return "Long-running Cursor job: none.";
      const label = PHASE_LABEL[current.phase] ?? current.phase;
      const elapsed = formatElapsed(current.startedAt);
      const agent = current.agentId ? ` · agent \`${current.agentId}\`` : "";
      return `Long-running Cursor job: **${label}** (running **${elapsed}**${agent}).`;
    },
  };
}
