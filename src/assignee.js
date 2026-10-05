export function assignedUserId(toValue) {
  if (!toValue || typeof toValue !== "object") return null;
  if (!("id" in toValue)) return null;
  const id = toValue.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function ticketIdFromEvent(event) {
  return event.ticket?.id ?? event.channelId;
}

export function isAssignedToBot(event, botUserId) {
  return (
    event.type === "assignee_changed" &&
    assignedUserId(event.toValue) === botUserId
  );
}

export function isUnassignedFromBot(event, botUserId) {
  return (
    event.type === "assignee_changed" &&
    assignedUserId(event.fromValue) === botUserId &&
    assignedUserId(event.toValue) !== botUserId
  );
}
