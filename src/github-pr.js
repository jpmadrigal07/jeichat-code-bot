export function parseGithubPullRequestUrl(prUrl) {
  const match = String(prUrl ?? "").match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i,
  );
  if (!match) return null;
  const repo = match[2].replace(/\.git$/i, "");
  const number = Number(match[3]);
  if (!Number.isInteger(number) || number <= 0) return null;
  return { owner: match[1], repo, number };
}

export function parseGithubRepoUrl(repoUrl) {
  const match = String(repoUrl ?? "").match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * @param {{ owner: string; repo: string; number: number }} target
 */
export async function fetchGithubPullRequest(target, options = {}) {
  const token = options.token?.trim() || process.env.GITHUB_TOKEN?.trim();
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "jeichat-code-bot",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://api.github.com/repos/${target.owner}/${target.repo}/pulls/${target.number}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GitHub pull request lookup failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
  return response.json();
}

/**
 * Prefer PR head SHA for Cursor cloud (branch-name validation can fail on fresh feature branches).
 * @param {{ prUrl?: string | null; branch?: string | null }} ctx
 * @param {string | null | undefined} repoUrl
 */
export async function enrichGitContextFromPullRequest(ctx, repoUrl) {
  const fromPr = parseGithubPullRequestUrl(ctx.prUrl);
  const prNumber = ctx.prNumber ?? fromPr?.number ?? null;
  if (!ctx?.prUrl && !prNumber) return ctx;

  if (!ctx?.prUrl && prNumber) {
    const fromRepo = parseGithubRepoUrl(repoUrl);
    if (fromRepo) {
      ctx = {
        ...ctx,
        prUrl: `https://github.com/${fromRepo.owner}/${fromRepo.repo}/pull/${prNumber}`,
      };
    }
  }

  const fromPrResolved = parseGithubPullRequestUrl(ctx.prUrl);
  const fromRepo = parseGithubRepoUrl(repoUrl);
  const owner = fromPrResolved?.owner ?? fromRepo?.owner;
  const repo = fromPrResolved?.repo ?? fromRepo?.repo;
  const number = fromPrResolved?.number ?? prNumber;
  if (!owner || !repo || !number) return ctx;

  const pr = await fetchGithubPullRequest({
    owner,
    repo,
    number,
  });

  const branch = pr?.head?.ref ?? ctx.branch ?? null;
  const headSha = pr?.head?.sha ?? null;
  const baseRef = pr?.base?.ref ?? null;
  const pullHeadRef = pullHeadGitRef(pr?.number ?? number);
  const startingRef = headSha ?? pullHeadRef ?? branch ?? null;

  return {
    ...ctx,
    prUrl: pr?.html_url ?? ctx.prUrl,
    branch,
    headSha,
    baseRef,
    prNumber: pr?.number ?? number,
    pullHeadRef,
    startingRef,
  };
}

export function pullHeadGitRef(prNumber) {
  const n = Number(prNumber);
  if (!Number.isInteger(n) || n <= 0) return null;
  return `refs/pull/${n}/head`;
}
