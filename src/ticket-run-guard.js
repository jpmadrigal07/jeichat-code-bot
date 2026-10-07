import { createTicketRunTracker } from "./ticket-runs.js";

export const ticketRuns = createTicketRunTracker();

/**
 * @param {string} channelId
 * @param {'build' | 'verify'} phase
 */
export function beginTicketRun(channelId, phase, meta = {}) {
  return ticketRuns.tryStart(channelId, phase, meta);
}

export function endTicketRun(channelId, phase) {
  ticketRuns.end(channelId, phase);
}
