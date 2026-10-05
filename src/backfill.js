export function ticketsAssignedToBot(channels, botUserId) {
  const bot = String(botUserId ?? "").trim();
  if (!bot) return [];

  return (Array.isArray(channels) ? channels : []).flatMap((row) => {
    if (!row?.parentId) return [];
    if (row.assigneeId !== bot) return [];
    if (row.archivedAt) return [];
    const id = String(row.id ?? "").trim();
    return id ? [id] : [];
  });
}
