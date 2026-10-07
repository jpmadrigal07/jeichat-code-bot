import { fetchBoardGithubLink } from "./github-repo.js";
import { formatAttachmentsForTranscript } from "./message-attachments.js";

const MAX_MESSAGES = 80;

export async function fetchChannel(client, workspaceId, channelId) {
  return client.get(`/workspaces/${workspaceId}/channels/${channelId}`);
}

export async function loadTicketThread(client, workspaceId, channelId) {
  const channel = await fetchChannel(client, workspaceId, channelId);
  let boardTicketKey = channel.ticketKey?.trim() || null;
  if (channel.parentId) {
    const parent = await fetchChannel(client, workspaceId, channel.parentId);
    boardTicketKey = parent.ticketKey?.trim() || boardTicketKey;
  }
  const github = await fetchBoardGithubLink(client, workspaceId, channel);
  const messages = await listMessages(client, channelId);
  const transcript = formatTranscript(messages, client.user?.userId);
  const webOrigin = (
    process.env.JEICHAT_WEB_ORIGIN ?? "http://localhost:3001"
  ).replace(/\/$/, "");

  const ticketUrl = channel.parentId
    ? `${webOrigin}/w/${workspaceId}/c/${channel.parentId}/b/${channelId}`
    : `${webOrigin}/w/${workspaceId}/c/${channelId}`;

  return {
    channel,
    boardTicketKey,
    github,
    messages,
    transcript,
    ticketUrl,
    isTicket: Boolean(channel.parentId),
  };
}

async function listMessages(client, channelId) {
  const collected = [];
  let cursor;

  while (collected.length < MAX_MESSAGES) {
    const limit = Math.min(50, MAX_MESSAGES - collected.length);
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set("cursor", cursor);
    const page = await client.get(
      `/channels/${channelId}/messages?${query.toString()}`,
    );
    const batch = page.data ?? [];
    if (batch.length === 0) break;
    collected.push(...batch);
    if (!page.nextCursor || batch.length < limit) break;
    cursor = page.nextCursor;
  }

  return collected.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function formatTranscript(messages, botUserId) {
  return messages
    .map((row) => formatTranscriptLine(row, botUserId))
    .filter((line) => line.length > 2)
    .join("\n");
}

function formatTranscriptLine(row, botUserId) {
  const name = row.sender?.name ?? "Unknown";
  const prefix = row.senderId === botUserId ? "[bot]" : name;
  const attachmentNote = formatAttachmentsForTranscript(row.attachments);
  let body = String(row.content ?? "").trim();
  if (attachmentNote) {
    body = body ? `${body} ${attachmentNote}` : attachmentNote;
  }
  return `${prefix}: ${body}`;
}

export function ticketDisplayId(channel) {
  if (!channel.parentId || channel.ticketNumber == null) {
    return channel.name ?? channel.id;
  }
  const key = channel.ticketKey?.trim();
  if (key) return `${key}-${channel.ticketNumber}`;
  return `#${channel.ticketNumber}`;
}
