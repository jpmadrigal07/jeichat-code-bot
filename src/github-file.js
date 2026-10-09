import { parseGithubRepoUrl } from "./github-pr.js";

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "jeichat-code-bot",
  };
  const t = token?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

/**
 * @param {{ owner: string; repo: string }} target
 * @param {string} path
 * @param {string} ref branch, tag, or commit sha
 */
export async function fetchGithubRepoFile(target, path, ref, options = {}) {
  const filePath = String(path ?? "").replace(/^\//, "");
  const gitRef = String(ref ?? "").trim();
  if (!filePath || !gitRef) return null;

  const url = new URL(
    `https://api.github.com/repos/${target.owner}/${target.repo}/contents/${filePath}`,
  );
  url.searchParams.set("ref", gitRef);

  const response = await fetch(url, { headers: githubHeaders(options.token) });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GitHub file ${filePath} (${response.status}): ${text.slice(0, 200)}`,
    );
  }

  const body = await response.json();
  if (!body || body.type !== "file" || !body.content) return null;
  const encoding = body.encoding === "base64" ? "base64" : null;
  if (!encoding) return null;
  return Buffer.from(body.content.replace(/\n/g, ""), "base64").toString(
    "utf8",
  );
}

/**
 * @param {string | null | undefined} repoUrl
 * @param {string | null | undefined} ref
 */
export async function fetchGithubRepoFileFromUrl(repoUrl, path, ref) {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed || !ref?.trim()) return null;
  return fetchGithubRepoFile(parsed, path, ref.trim());
}
