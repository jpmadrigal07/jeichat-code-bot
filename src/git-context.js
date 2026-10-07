const PR_LINE = /^PR:\s*(\S+)/im;
const BRANCH_LINE = /^Branch:\s*(\S+)/im;
const BRANCH_BACKTICK = /\bbranch\s+`([^`]+)`/i;
const BRANCH_MARKDOWN = /\*\*branch:\*\*\s*`([^`]+)`/i;

export function parsePrUrl(text) {
  const plain = String(text ?? "").replace(/\*/g, "");
  const match = plain.match(PR_LINE);
  if (!match?.[1]) return null;
  const url = match[1].replace(/[)\]>.,]+$/g, "");
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  return url;
}

export function parseBranchName(text) {
  const raw = String(text ?? "");
  const plain = raw.replace(/\*/g, "");

  const lineMatch = plain.match(BRANCH_LINE);
  if (lineMatch?.[1]) {
    const branch = lineMatch[1].replace(/[)\]>.,]+$/g, "").trim();
    if (branch.length > 0) return branch;
  }

  for (const pattern of [BRANCH_MARKDOWN, BRANCH_BACKTICK]) {
    const match = raw.match(pattern);
    const branch = match?.[1]?.trim();
    if (branch) return branch;
  }

  return null;
}

function gitFromMessage(row) {
  const prUrl = parsePrUrl(row?.content);
  const branch = parseBranchName(row?.content);
  if (!prUrl && !branch) return null;
  return { prUrl, branch, message: row };
}

/**
 * Newest PR URL and newest branch hint may appear in different messages.
 */
export function mergeGitContextFromMessages(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  let prUrl = null;
  let prMessage = null;
  let branch = null;
  let branchMessage = null;

  for (const row of rows) {
    if (!prUrl) {
      const url = parsePrUrl(row?.content);
      if (url) {
        prUrl = url;
        prMessage = row;
      }
    }
    if (!branch) {
      const name = parseBranchName(row?.content);
      if (name) {
        branch = name;
        branchMessage = row;
      }
    }
    if (prUrl && branch) break;
  }

  if (!prUrl && !branch) return null;
  return {
    prUrl,
    branch,
    message: prMessage ?? branchMessage,
  };
}

/**
 * `messages` must be newest-first (JeiChat default).
 */
export function latestGitContextFromMessages(messages, preferredBotUserId) {
  const botId = String(preferredBotUserId ?? "").trim();
  const rows = Array.isArray(messages) ? messages : [];

  if (botId) {
    for (const row of rows) {
      if (row?.senderId !== botId) continue;
      const ctx = gitFromMessage(row);
      if (ctx) return ctx;
    }
  }

  for (const row of rows) {
    const ctx = gitFromMessage(row);
    if (ctx) return ctx;
  }

  return mergeGitContextFromMessages(rows);
}
