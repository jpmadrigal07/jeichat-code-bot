import { Agent, CursorAgentError } from "@cursor/sdk";
import { cursorAgentOptions } from "./cursor-options.js";
import { enrichGitContextFromPullRequest } from "./github-pr.js";
import { resolveRepoUrl } from "./github-repo.js";
import { ticketDisplayId } from "./plan-context.js";
import { verificationInstructions } from "./verify-instructions.js";
import { verifyRunTimeoutMs } from "./verify-timing.js";

const MAX_BODY = 3500;

function formatGitBlock(ctx) {
  const lines = [];
  if (ctx.prUrl) lines.push(`PR: ${ctx.prUrl}`);
  if (ctx.branch) lines.push(`Branch: ${ctx.branch}`);
  return lines.join("\n");
}

export function codeVerifyPrompt(ticket, ctx) {
  const pageUrl = ticket.pageUrl?.trim();
  const description = ticket.description?.trim() || "(empty)";
  const verifyBlock = verificationInstructions({
    pageUrl,
    description,
    runtime: process.env.CURSOR_RUNTIME,
  });

  const checkoutNote = ctx.usedBaseRefFallback && ctx.branch
    ? `First run: \`git fetch origin ${ctx.branch} && git checkout ${ctx.branch}\`.`
    : ctx.branch
      ? `You should already be on **${ctx.branch}** (or the PR head commit).`
      : "Find the feature branch from the PR linked on this ticket.";

  return `You are the JeiChat **code** bot running post-implementation verification after a build agent opened a pull request.

Ticket: ${ticket.displayId} ${ticket.name}
${ctx.prUrl ? `Pull request: ${ctx.prUrl}` : ""}
${checkoutNote}

Specification (validate against **Done when**):
${description}

Your job:
1. Inspect the **diff** on this branch vs its merge base. Summarize user-visible changes (paths, behavior).
2. Run the verification checklist below against the spec — especially **Done when**.
3. Reply in Markdown with:
   - **Changes** — bullet summary of the PR diff
   - **Verification** — commands you ran and what you checked in the browser
   - **Result:** PASS or FAIL — one line why

${verifyBlock}

Do not open a new PR. Do not push.`;
}

export function composeVerifyReply(modelText, ctx) {
  const body = String(modelText ?? "").trim();
  const gitBlock = formatGitBlock(ctx);
  if (!body && !gitBlock) {
    return "The verification run finished but returned no explanation.";
  }
  if (!gitBlock) {
    if (body.length <= MAX_BODY) return body;
    return `${body.slice(0, MAX_BODY)}\n\n_(truncated)_`;
  }
  if (!body) return gitBlock;
  const budget = Math.max(0, MAX_BODY - gitBlock.length - 2);
  const trimmed =
    body.length <= budget ? body : `${body.slice(0, budget)}\n\n_(truncated)_`;
  return `${trimmed}\n\n${gitBlock}`;
}

async function disposeAgent(agent) {
  if (!agent) return;
  if (typeof agent[Symbol.asyncDispose] === "function") {
    await agent[Symbol.asyncDispose]();
    return;
  }
  agent.close();
}

function startingRefCandidates(ctx) {
  const seen = new Set();
  const list = [];
  for (const ref of [
    ctx.startingRef,
    ctx.headSha,
    ctx.pullHeadRef,
    ctx.branch,
    ctx.baseRef,
  ]) {
    const value = String(ref ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    list.push(value);
  }
  return list;
}

function isMissingRefError(error) {
  if (!(error instanceof CursorAgentError)) return false;
  return /does not exist/i.test(error.message);
}

async function waitForRun(run, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `verification timed out after ${Math.round(timeoutMs / 60000)} minutes`,
          ),
        ),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([run.wait(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function createVerifyAgent(ticket, ctx) {
  const repoUrl = ticket.repoUrl;
  const candidates = startingRefCandidates(ctx);
  if (candidates.length === 0) {
    throw new Error(
      "No git ref to clone (need PR on the ticket or a Branch line in the thread).",
    );
  }

  let lastError;
  for (const startingRef of candidates) {
    try {
      const agent = await Agent.create(
        cursorAgentOptions({
          context: ticket.planContext,
          mode: "agent",
          startingRef,
          autoCreatePR: false,
          repoUrl,
        }),
      );
      return {
        agent,
        promptCtx: {
          ...ctx,
          usedBaseRefFallback: startingRef === ctx.baseRef,
        },
      };
    } catch (error) {
      if (isMissingRefError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  const hint = ctx.prUrl
    ? ` Could not clone from PR ${ctx.prUrl}${ctx.githubResolveError ? ` (${ctx.githubResolveError})` : ""}.`
    : "";
  if (lastError instanceof CursorAgentError) {
    throw new CursorAgentError(
      `${lastError.message}${hint} Check that the PR branch exists on GitHub and the board repo matches the linked GitHub repo.`,
      { cause: lastError },
    );
  }
  throw lastError;
}

/**
 * @param {object} ticket
 * @param {{ prUrl?: string | null; branch?: string | null }} ctx
 * @param {{ onAgent?: (agent: import("@cursor/sdk").SDKAgent) => void; onRunStarted?: (info: { agentId?: string | null }) => void }} options
 */
export async function runCodeVerification(ticket, ctx, options = {}) {
  let enriched = { ...ctx };
  try {
    enriched = await enrichGitContextFromPullRequest(enriched, ticket.repoUrl);
  } catch (error) {
    console.error("could not resolve PR from GitHub", error);
    enriched.githubResolveError =
      error instanceof Error ? error.message : "GitHub PR lookup failed";
  }

  if (!enriched.branch && !enriched.prUrl && !enriched.startingRef) {
    return "I need a linked **GitHub PR** on this ticket or a known feature branch before I can verify.";
  }

  let agent;
  let promptCtx = enriched;
  try {
    const created = await createVerifyAgent(ticket, enriched);
    agent = created.agent;
    promptCtx = created.promptCtx;
    const agentId = agent.id ?? agent.agentId ?? null;
    if (typeof options.onAgent === "function") {
      options.onAgent(agent);
    }
    if (typeof options.onRunStarted === "function") {
      options.onRunStarted({ agentId });
    }
    const run = await agent.send(codeVerifyPrompt(ticket, promptCtx), {
      mode: "agent",
    });
    const result = await waitForRun(run, verifyRunTimeoutMs());
    if (result.status !== "finished") {
      return `Verification did not finish (${result.status}${
        result.error?.message ? `: ${result.error.message}` : ""
      }).`;
    }
    return composeVerifyReply(result.result, promptCtx);
  } catch (error) {
    if (error instanceof CursorAgentError) {
      return `Could not start Cursor verification: ${error.message}`;
    }
    if (error instanceof Error && /timed out/i.test(error.message)) {
      return `${error.message}. The cloud agent may still be running on [Cursor](https://cursor.com/agents). Run \`@… verify\` after it finishes, or raise \`REVIEWER_RUN_TIMEOUT_MS\`.`;
    }
    throw error;
  } finally {
    await disposeAgent(agent);
  }
}

/**
 * @param {import("./client.js").JeiChat} client
 * @param {import("./plan-context.js").TicketThreadContext} context
 * @param {{ branchHint?: string | null; botUserId?: string | null }} options
 */
export async function loadTicketForVerify(client, context, options = {}) {
  const workspaceId = client.user?.workspaceId;
  const channel = context.channel;
  const messages = context.messages ?? [];

  return {
    id: channel.id,
    workspaceId,
    parentId: channel.parentId,
    ticketNumber: channel.ticketNumber ?? null,
    ticketPrefix: context.boardTicketKey,
    displayId: ticketDisplayId(channel),
    name: channel.name,
    description: channel.description,
    messageRows: [...messages].reverse(),
    pageUrl: context.ticketUrl,
    repoUrl: resolveRepoUrl(context),
    planContext: context,
  };
}
