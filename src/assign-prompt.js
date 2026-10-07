export function formatPlanningAssignPrompt(botName, ticketLabel) {
  const mention = botName ? `@${botName}` : "@Code";
  return [
    `I'm assigned to **${ticketLabel}** — let's **plan** before anyone runs \`build\`.`,
    "",
    "**What should we plan?** Reply in this thread with your goal, scope, constraints, and screenshots if you have them.",
    "",
    `Example: \`${mention} we need to add export on the settings page — here's the layout…\``,
    "",
    "When we're aligned:",
    `- \`${mention} base <branch>\` — git branch to branch **from** (I'll ask if unset)`,
    `- Keep chatting with \`${mention}\` — same planning session, repo-aware`,
    `- \`${mention} draft\` — write the full spec (incl. test account, routes, verify commands) into the ticket`,
    `- \`${mention} build\` — **only** when the description is ready for a PR`,
    "",
    "What should this ticket deliver?",
  ].join("\n");
}
