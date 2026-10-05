const IMAGE_MIME_PREFIX = "image/";
const DEFAULT_MAX_IMAGES = 5;
const DEFAULT_MAX_INLINE_BYTES = 4 * 1024 * 1024;

export function isImageContentType(contentType) {
  return String(contentType ?? "")
    .toLowerCase()
    .startsWith(IMAGE_MIME_PREFIX);
}

export function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      filename: String(row.filename ?? "attachment").trim() || "attachment",
      contentType: String(row.contentType ?? row.mimeType ?? "").trim(),
      sizeBytes: Number(row.sizeBytes ?? row.size ?? 0) || 0,
    });
  }
  return out;
}

export function formatAttachmentsForTranscript(raw) {
  const attachments = normalizeAttachments(raw);
  if (attachments.length === 0) return "";
  const parts = attachments.map((row) => {
    const kind = isImageContentType(row.contentType) ? "image" : "file";
    return `[${kind}: ${row.filename}]`;
  });
  return parts.join(" ");
}

/**
 * Image attachments for the current turn (trigger message first), then recent thread.
 */
export function collectImageAttachments(messages, options = {}) {
  const maxImages = Number(
    process.env.PLANNING_MAX_IMAGES?.trim() || DEFAULT_MAX_IMAGES,
  );
  const triggerMessageId = options.triggerMessageId;
  const triggerAttachments = normalizeAttachments(options.triggerAttachments);
  const seen = new Set();
  const out = [];

  const push = (att) => {
    if (!isImageContentType(att.contentType)) return;
    if (seen.has(att.id)) return;
    seen.add(att.id);
    out.push(att);
  };

  for (const att of triggerAttachments) {
    push(att);
    if (out.length >= maxImages) return out;
  }

  const list = Array.isArray(messages) ? messages : [];
  if (triggerMessageId) {
    const trigger = list.find((row) => row.id === triggerMessageId);
    for (const att of normalizeAttachments(trigger?.attachments)) {
      push(att);
      if (out.length >= maxImages) return out;
    }
  }

  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i];
    if (row?.id === triggerMessageId) continue;
    for (const att of normalizeAttachments(row?.attachments)) {
      push(att);
      if (out.length >= maxImages) return out;
    }
  }

  return out;
}

export async function resolveSdkImages(client, attachments) {
  const maxInline = Number(
    process.env.PLANNING_IMAGE_MAX_BYTES?.trim() ||
      DEFAULT_MAX_INLINE_BYTES,
  );
  const images = [];

  for (const att of attachments) {
    try {
      const image = await attachmentToSdkImage(client, att, maxInline);
      if (image) images.push(image);
    } catch (error) {
      console.warn("attachment image skipped", att.id, error);
    }
  }

  return images;
}

async function attachmentToSdkImage(client, attachment, maxInlineBytes) {
  const meta = await client.get(
    `/attachments/${encodeURIComponent(attachment.id)}/download-url`,
  );
  const url = typeof meta?.url === "string" ? meta.url.trim() : "";
  const contentType =
    String(meta?.contentType ?? attachment.contentType ?? "").trim() ||
    "image/png";
  if (!url) return null;

  const forceInline = shouldInlineImageForCursor(url);

  if (forceInline || isImageContentType(contentType)) {
    const inlined = await fetchImageAsBase64(url, contentType, maxInlineBytes);
    if (inlined) return inlined;
    if (forceInline) {
      console.warn(
        `attachment ${attachment.id}: skipped (cloud needs inline image; max ${maxInlineBytes} bytes)`,
      );
      return null;
    }
  }

  return { url };
}

function shouldInlineImageForCursor(downloadUrl) {
  if (process.env.CURSOR_RUNTIME?.trim() === "cloud") return true;
  if (process.env.PLANNING_IMAGE_FORCE_INLINE?.trim() === "1") return true;
  try {
    const host = new URL(downloadUrl).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
  } catch {
    return true;
  }
  return false;
}

async function fetchImageAsBase64(url, contentType, maxInlineBytes) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxInlineBytes) return null;
  return {
    data: buffer.toString("base64"),
    mimeType: contentType.split(";")[0].trim() || "image/png",
  };
}

export function buildAgentUserMessage(text, images) {
  if (!images?.length) return text;
  return { text, images };
}
