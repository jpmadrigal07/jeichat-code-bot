/**
 * Matches JeiChat `suggestedTicketBranchName` (GitHub panel copy button).
 */
export function suggestedTicketBranchName(
  ticketKey,
  ticketNumber,
  title,
) {
  if (!ticketKey?.trim() || ticketNumber == null) return null;
  const key = ticketKey.trim().toUpperCase();
  const slug =
    String(title ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "work";
  return `${key}-${ticketNumber}-${slug}`;
}

export function resolveBoardTicketKey(context) {
  const fromBoard = context.boardTicketKey?.trim();
  if (fromBoard) return fromBoard;
  const onChannel = context.channel?.ticketKey?.trim();
  if (onChannel) return onChannel;
  return null;
}

export function suggestedBranchForTicket(context) {
  const channel = context.channel;
  return suggestedTicketBranchName(
    resolveBoardTicketKey(context),
    channel?.ticketNumber,
    channel?.name,
  );
}

export const TICKET_SPEC_SECTIONS = [
  "## Base ref",
  "## Branch",
  "## Goal",
  "## Done when",
  "## UI refs",
];

export function missingTicketSpecSections(spec) {
  const text = String(spec ?? "");
  return TICKET_SPEC_SECTIONS.filter((heading) => !text.includes(heading));
}

export function isCompleteTicketSpec(spec) {
  return missingTicketSpecSections(spec).length === 0;
}

/** Force ## Branch to the ticket branch code (not cursor/… agent names). */
export function ensureSpecBranch(spec, branchName) {
  const trimmed = String(spec ?? "").trim();
  if (!branchName?.trim() || !trimmed) return trimmed;

  const branchBlock = `## Branch\n${branchName.trim()}\n`;
  const sectionRe = /^## Branch\s*\n[\s\S]*?(?=^## |\s*$)/m;
  if (sectionRe.test(trimmed)) {
    return trimmed.replace(sectionRe, branchBlock);
  }

  const baseRefRe = /^## Base ref\s*\n[\s\S]*?(?=^## |\s*$)/m;
  if (baseRefRe.test(trimmed)) {
    return trimmed.replace(baseRefRe, (match) => `${match}\n${branchBlock}`);
  }

  return `${branchBlock}\n${trimmed}`;
}
