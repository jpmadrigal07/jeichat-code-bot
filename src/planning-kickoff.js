import { isCompleteTicketSpec } from "./ticket-branch.js";

function envFlag(name) {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Ticket already has enough spec — no need for the planning essay. */
export function ticketHasPlanningSpec(description) {
  const text = String(description ?? "").trim();
  if (!text) return false;
  if (isCompleteTicketSpec(text)) return true;
  if (/^##\s*Goal\s*$/im.test(text) && /^##\s*Done when\s*$/im.test(text)) {
    return true;
  }
  return text.length >= 200 && /##\s+Done when/i.test(text);
}

/**
 * @param {{ description?: string | null }} channel
 * @param {{ source: "assign" | "backfill" }} ctx
 */
export function shouldSendPlanningKickoff(channel, ctx) {
  if (envFlag("CODE_BOT_SKIP_PLANNING_KICKOFF")) return false;

  if (ctx.source === "backfill") {
    if (envFlag("CODE_BOT_SKIP_ASSIGN_BACKFILL")) return false;
    if (!envFlag("CODE_BOT_ASSIGN_BACKFILL")) return false;
  }

  if (ticketHasPlanningSpec(channel.description)) return false;

  return true;
}
