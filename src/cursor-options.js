import { MISSING_GITHUB_LINK_MESSAGE, resolveRepoUrl } from "./github-repo.js";

export function cursorAgentOptions(overrides = {}) {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "CURSOR_API_KEY is missing. Create one at https://cursor.com/dashboard/integrations",
    );
  }

  const model = { id: process.env.CURSOR_MODEL?.trim() || "composer-2.5" };
  const repoUrl =
    overrides.repoUrl?.trim() ||
    (overrides.context ? resolveRepoUrl(overrides.context) : null) ||
    process.env.CURSOR_REPO_URL?.trim();
  const startingRef =
    overrides.startingRef?.trim() ||
    process.env.CURSOR_REPO_REF?.trim() ||
    "main";
  const runtime =
    process.env.CURSOR_RUNTIME?.trim() || (repoUrl ? "cloud" : "local");

  if (runtime === "cloud") {
    if (!repoUrl) {
      throw new Error(
        overrides.context
          ? MISSING_GITHUB_LINK_MESSAGE
          : "CURSOR_REPO_URL is required when CURSOR_RUNTIME=cloud (or pass a ticket with a linked GitHub repo)",
      );
    }
    const cloudEnvName = process.env.CURSOR_CLOUD_ENVIRONMENT?.trim();
    const cloud = {
      repos: [{ url: repoUrl, startingRef }],
      autoCreatePR: Boolean(overrides.autoCreatePR),
      skipReviewerRequest: true,
    };
    if (cloudEnvName) {
      cloud.env = { type: "cloud", name: cloudEnvName };
    }
    const options = { apiKey, model, cloud };
    if (overrides.mode) options.mode = overrides.mode;
    return options;
  }

  const cwd = process.env.CURSOR_REPO_PATH?.trim();
  if (!cwd) {
    throw new Error("CURSOR_REPO_PATH is required when CURSOR_RUNTIME=local");
  }
  const options = { apiKey, model, local: { cwd } };
  if (overrides.mode) options.mode = overrides.mode;
  return options;
}

const MAX_REPLY = 3500;

export function truncateReply(text) {
  if (text.length <= MAX_REPLY) return text;
  return `${text.slice(0, MAX_REPLY)}\n\n_(truncated)_`;
}