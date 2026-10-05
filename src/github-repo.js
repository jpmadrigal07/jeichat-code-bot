export function boardChannelId(channel) {
  return channel.parentId ?? channel.id;
}

export function githubRepoUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}`;
}

export async function fetchBoardGithubLink(client, workspaceId, channel) {
  const boardId = boardChannelId(channel);
  const link = await client.get(
    `/integrations/github/workspaces/${workspaceId}/channels/${boardId}/link`,
  );
  if (!link?.owner || !link?.repo) return null;
  return {
    boardChannelId: boardId,
    owner: link.owner,
    repo: link.repo,
    repoUrl: githubRepoUrl(link.owner, link.repo),
  };
}

export function resolveRepoUrl(context) {
  const linked = context.github?.repoUrl?.trim();
  if (linked) return linked;
  const fallback = process.env.CURSOR_REPO_URL?.trim();
  if (fallback) return fallback;
  return null;
}

export const MISSING_GITHUB_LINK_MESSAGE =
  "No GitHub repo is linked to this ticket board. On the **board channel** (not the thread), open Channel settings → GitHub and connect a repo, or run `@github connect owner repo` there.";
