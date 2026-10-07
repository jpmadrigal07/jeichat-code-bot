import { contentTypeForFilename, maxVerificationScreenshots } from "./screenshots.js";
import { VERIFICATION_SCREENSHOT_PREFIX } from "./verify-instructions.js";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

function basename(path) {
  const normalized = String(path ?? "").replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "screenshot.png";
}

function isPreferredVerificationPath(path) {
  const normalized = String(path ?? "").replace(/\\/g, "/").toLowerCase();
  if (!IMAGE_EXT.test(normalized)) return false;
  if (normalized.includes(`/${VERIFICATION_SCREENSHOT_PREFIX}/`)) return true;
  if (normalized.includes(`${VERIFICATION_SCREENSHOT_PREFIX}-`)) return true;
  return false;
}

/**
 * @param {import("@cursor/sdk").SDKArtifact[]} artifacts
 * @param {number} max
 */
export function pickVerificationArtifactPaths(artifacts, max = 5) {
  const rows = Array.isArray(artifacts) ? artifacts : [];
  const preferred = rows.filter((row) => isPreferredVerificationPath(row.path));
  const pool =
    preferred.length > 0
      ? preferred
      : rows.filter((row) => IMAGE_EXT.test(row.path ?? ""));
  return pool
    .slice()
    .sort((a, b) => String(a.path).localeCompare(String(b.path)))
    .slice(0, max)
    .map((row) => row.path);
}

/**
 * @param {import("@cursor/sdk").SDKAgent | null | undefined} agent
 * @param {{ max?: number }} options
 * @returns {Promise<Array<{ filename: string; contentType: string; bytes: Buffer }>>}
 */
export async function downloadVerificationArtifacts(agent, options = {}) {
  if (!agent || typeof agent.listArtifacts !== "function") return [];
  const max = options.max ?? maxVerificationScreenshots();
  let artifacts;
  try {
    artifacts = await agent.listArtifacts();
  } catch (error) {
    console.error("could not list Cursor artifacts", error);
    return [];
  }

  const paths = pickVerificationArtifactPaths(artifacts, max);
  const files = [];

  for (const path of paths) {
    try {
      const bytes = await agent.downloadArtifact(path);
      const filename = basename(path);
      const contentType = contentTypeForFilename(filename) ?? "image/png";
      files.push({ filename, contentType, bytes });
    } catch (error) {
      console.error(`could not download artifact ${path}`, error);
    }
  }

  return files;
}

export function postVerificationScreenshotsEnabled() {
  const raw = process.env.REVIEWER_POST_SCREENSHOTS?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}
