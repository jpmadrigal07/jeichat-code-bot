export const ASSIGN_PROMPT_DELAY_MS = 3_000;

export function createAssigneeDebouncer(options = {}) {
  const delayMs = options.delayMs ?? ASSIGN_PROMPT_DELAY_MS;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const timers = new Map();

  return {
    schedule(ticketId, run) {
      const existing = timers.get(ticketId);
      if (existing !== undefined) clearTimeoutFn(existing);
      const handle = setTimeoutFn(() => {
        timers.delete(ticketId);
        run();
      }, delayMs);
      timers.set(ticketId, handle);
    },
    cancel(ticketId) {
      const existing = timers.get(ticketId);
      if (existing === undefined) return;
      clearTimeoutFn(existing);
      timers.delete(ticketId);
    },
    has(ticketId) {
      return timers.has(ticketId);
    },
  };
}
