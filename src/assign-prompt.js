export function formatPlanningAssignPrompt(botName, ticketLabel) {
  const m = botName ? `@${botName}` : "@Code";
  return [
    `Assigned to **${ticketLabel}**.`,
    `Mention ${m} to plan in this thread, then \`${m} draft\` → \`${m} build\` when ready.`,
    `(\`${m} help\` for commands.)`,
  ].join(" ");
}
