import { latestGitContextFromMessages } from "./git-context.js";
import { parseBranchFromSpec, suggestedBranchForTicket } from "./ticket-branch.js";

/**
 * Channel events are oldest-first; take the latest GitHub PR link.
 */
export function latestGithubPullRequestEvent(events) {
  const rows = Array.isArray(events) ? events : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row?.type !== "github_pull_request") continue;
    const to = row.toValue;
    if (!to || typeof to !== "object") continue;
    const htmlUrl =
      typeof to.htmlUrl === "string"
        ? to.htmlUrl
        : typeof to.html_url === "string"
          ? to.html_url
          : null;
    if (!htmlUrl) continue;
    return {
      prUrl: htmlUrl,
      prNumber: to.number ?? null,
      state: to.state ?? null,
    };
  }
  return null;
}

/**
 * @param {import("./client.js").JeiChat} client
 * @param {object} ticket
 * @param {{ branchHint?: string | null; botUserId?: string | null }} options
 */
export async function resolveTicketGitContext(client, ticket, options = {}) {
  const fromMessages = latestGitContextFromMessages(
    ticket.messageRows,
    options.botUserId,
  );

  let prFromEvents = null;
  const skipEvents =
    process.env.CODE_BOT_SKIP_CHANNEL_EVENTS?.trim() === "1" ||
    Boolean(options.branchHint && fromMessages?.branch);
  if (!skipEvents) {
    try {
      const events = await client.get(
        `/workspaces/${ticket.workspaceId}/channels/${ticket.id}/events`,
      );
      prFromEvents = latestGithubPullRequestEvent(events);
    } catch (error) {
      console.error("could not load ticket GitHub events", error);
    }
  }

  const prUrl = fromMessages?.prUrl ?? prFromEvents?.prUrl ?? null;
  const prNumber = prFromEvents?.prNumber ?? null;

  const branchHint =
    options.branchHint ||
    fromMessages?.branch ||
    parseBranchFromSpec(ticket.description) ||
    suggestedBranchForTicket({
      channel: ticket,
      boardTicketKey: ticket.ticketPrefix,
    }) ||
    null;

  if (!prUrl && !branchHint) return null;

  return {
    prUrl,
    prNumber,
    branch: branchHint,
  };
}
