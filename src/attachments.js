import { maxVerificationScreenshots } from "./screenshots.js";

/**
 * Presign → PUT → post message with attachmentIds (bot auth).
 * @param {import("./client.js").JeiChat} client
 * @param {string} channelId
 * @param {string} content
 * @param {Array<{ filename: string; contentType: string; bytes: Buffer }>} files
 */
export async function sendMessageWithAttachments(
  client,
  channelId,
  content,
  files,
) {
  const batch = (Array.isArray(files) ? files : []).slice(
    0,
    maxVerificationScreenshots(),
  );
  if (batch.length === 0) {
    return client.send(channelId, content);
  }

  const attachmentIds = [];
  for (const file of batch) {
    const presign = await client.post("/attachments/presign", {
      channelId,
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.bytes.length,
    });

    const uploadUrl = presign.uploadUrl;
    const attachmentId = presign.attachmentId ?? presign.id;
    if (!uploadUrl || !attachmentId) {
      throw new Error("Presign response missing uploadUrl or attachment id");
    }

    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.bytes.length),
      },
      body: file.bytes,
    });
    if (!upload.ok) {
      throw new Error(
        `R2 upload failed for ${file.filename} (${upload.status})`,
      );
    }

    attachmentIds.push(attachmentId);
  }

  return client.post(`/channels/${channelId}/messages`, {
    content,
    attachmentIds,
  });
}
