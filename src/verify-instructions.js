import { cursorCloudEnvVerifyBullet, isCloudRuntime } from "./cloud-env-hint.js";
import { maxVerificationScreenshots } from "./screenshots.js";
import {
  parseVerifyCommands,
  parseVerifyScope,
  resolveVerifyBrowseUrls,
} from "./verify-spec.js";
import { verifyDevStack } from "./verify-stack.js";

/** Cursor Cloud stores run outputs under this directory (also visible via Agent.listArtifacts). */
export const CLOUD_ARTIFACTS_DIR = "/opt/cursor/artifacts";

export const VERIFICATION_SCREENSHOT_PREFIX = "after-fix";

/**
 * Prompt block: run the app, exercise the ticket spec, save proof screenshots.
 * Shared with jeichat-reviewer-bot.
 * @param {{ pageUrl?: string | null; runtime?: string; description?: string | null; verifyScope?: 'browser' | 'static-only'; browseUrls?: string[]; verifyCommands?: string | null }} ctx
 */
function lightVerifyEnabled() {
  const raw = process.env.REVIEWER_LIGHT_VERIFY?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  return true;
}

function formatBrowseUrls(urls) {
  if (!urls?.length) return null;
  if (urls.length === 1) {
    return `   - Open **${urls[0]}** (from the ticket **## Routes**).`;
  }
  const list = urls.map((u) => `     - ${u}`).join("\n");
  return `   - Open these URLs/paths from **## Routes**:\n${list}`;
}

/** Screenshots are posted to the ticket as proof — capture only when UI is ready. */
function screenshotProofBullets(isCloud, artifactDir, maxShots, localDir) {
  const pathLine = isCloud
    ? `   - Save up to **${maxShots}** PNG proof screenshots under \`${artifactDir}/\` (e.g. \`${artifactDir}/01-done-when.png\`). The code bot posts them to the ticket (max ${maxShots}).`
    : `   - Save up to **${maxShots}** PNG proof screenshots under \`./${localDir}/\` in the repo root.`;

  return [
    pathLine,
    "   - **Screenshot proof:** Each PNG must show the **Done when** behavior clearly. Reviewers treat these as evidence — unusable shots count as incomplete verification.",
    "   - **Wait before capture:** Do not screenshot while the page is still loading. Wait until spinners/skeletons are gone, main content and images are visible, and dialogs or sheets are fully open. Use browser snapshot/polling and **retry** after a few seconds if anything still says Loading or looks empty.",
    "   - Re-navigate or reopen the flow and capture again if the first shot was mid-transition, blurred, or missing the element under test.",
  ];
}

export function verificationInstructions(ctx = {}) {
  const description = ctx.description ?? "";
  const verifyScope =
    ctx.verifyScope ?? parseVerifyScope(description);
  const staticOnly = verifyScope === "static-only";
  const browseUrls =
    ctx.browseUrls ??
    resolveVerifyBrowseUrls(description, ctx.pageUrl?.trim());
  const verifyCommands =
    ctx.verifyCommands ?? parseVerifyCommands(description);

  const isCloud = isCloudRuntime(ctx.runtime);
  const artifactDir = `${CLOUD_ARTIFACTS_DIR}/${VERIFICATION_SCREENSHOT_PREFIX}`;
  const maxShots = maxVerificationScreenshots();
  const light = lightVerifyEnabled();
  const { web, healthUrl } = verifyDevStack();

  const envBullet = cursorCloudEnvVerifyBullet(ctx);
  const browseBullet = staticOnly ? null : formatBrowseUrls(browseUrls);

  const commandsBullet = verifyCommands
    ? `   - Run these **## Verify commands** from the spec (adjust only if the diff clearly requires more):\n\`\`\`\n${verifyCommands}\n\`\`\``
    : "   - Run the smallest commands that prove the change (see **## Verify commands** in the spec when present).";

  const lines = [];

  if (staticOnly) {
    lines.push(
      "Before you finish verification (**static-only** per ticket — no browser, no `bun run dev` unless a command requires it):",
      ...(envBullet ? [envBullet] : []),
      "   - Read the PR diff first.",
      commandsBullet,
      "   - Do **not** start the dev server or walk UI unless the spec or diff proves you must.",
    );
  } else if (light) {
    lines.push(
      "Before you finish verification (keep this **lean** — aim to finish in under ~15 minutes):",
      ...(envBullet ? [envBullet] : []),
      "   - Read the PR diff first. Only run commands needed for the files you changed.",
      commandsBullet,
      "   - Prefer targeted checks over the full monorepo suite unless the diff is wide.",
      "   - Start `bun run dev` **only** if you must exercise UI; skip DB migrate unless the diff touches schema/migrations.",
      "   - When auth is required, sign in with **## Test account** in the ticket spec (do not invent credentials or commit them).",
      browseBullet ??
        "   - Open the routes in **## Routes** (or the flow in **Done when**).",
    );
  } else {
    lines.push(
      "Before you finish verification:",
      ...(envBullet ? [envBullet] : []),
      "   - Run `bun run test` from the monorepo root (or the smallest relevant package tests).",
      commandsBullet,
      "   - Apply DB migrations if schema changed: `cd apps/api && bun run db:migrate`.",
      `   - Start the stack: \`bun run dev\` (web ${web}). Wait until \`curl -sf ${healthUrl}\` succeeds.`,
      "   - Walk through **Done when** in the browser. Use **## Test account** when auth is required.",
      browseBullet ??
        "   - Open the routes in **## Routes** or the flow in the ticket spec.",
    );
  }

  if (!staticOnly) {
    lines.push(
      ...screenshotProofBullets(
        isCloud,
        artifactDir,
        maxShots,
        VERIFICATION_SCREENSHOT_PREFIX,
      ),
    );
  }

  lines.push(
    staticOnly
      ? "   - In your final reply, include a **Verification** section listing commands run and **Result:** PASS or FAIL."
      : "   - In your final reply, include a **Verification** section listing what you ran and the screenshot filenames.",
  );

  return lines.join("\n");
}
