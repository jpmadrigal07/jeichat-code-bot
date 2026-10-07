const DEFAULT_MAX_SCREENSHOTS = 5;

/** Max verification PNGs downloaded from Cursor and posted to JeiChat (also planning cap default). */
export function maxVerificationScreenshots() {
  const raw = process.env.REVIEWER_MAX_SCREENSHOTS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return Math.min(parsed, 10);
    }
  }
  return DEFAULT_MAX_SCREENSHOTS;
}

export const MAX_SCREENSHOTS = DEFAULT_MAX_SCREENSHOTS;

const IMAGE_EXT = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export function contentTypeForFilename(name) {
  const ext = String(name ?? "")
    .slice(String(name ?? "").lastIndexOf("."))
    .toLowerCase();
  return IMAGE_EXT.get(ext) ?? null;
}
