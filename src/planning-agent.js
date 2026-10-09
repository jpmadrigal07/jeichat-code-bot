import { Agent, CursorAgentError } from "@cursor/sdk";
import { readAssistantText, isRecoverableCursorRunError } from "./cursor-run.js";
import { cursorAgentOptions, cursorSendOptions } from "./cursor-options.js";
import { defaultBaseRef, parseBaseRefFromMessage, resolveStartingRef } from "./base-ref.js";
import { resolveRepoUrl } from "./github-repo.js";
import {
  buildAgentUserMessage,
  collectImageAttachments,
  resolveSdkImages,
} from "./message-attachments.js";
import { ticketDisplayId } from "./plan-context.js";
import { suggestedBranchForTicket } from "./ticket-branch.js";

const PLANNING_SYSTEM = `You are a senior engineer planning a JeiChat ticket before implementation.
You have the linked GitHub repository and may search and read it to understand existing UI and code.

Base branch first: before scoping the feature, confirm which git branch the team will branch **from** (e.g. develop, main).
If the prompt says the base ref is not set yet, ask that as your **first** question and wait for an answer — do not jump into implementation details until the base branch is agreed (or they set \`@… base <branch>\`).
After the base ref is set, continue planning scope, repo exploration, and acceptance criteria.

When the user mentions UI, features, or behavior:
- Search the repo first and map informal language (e.g. "ticket title") to real components, routes, or files.
- Ground replies in what you find; cite file paths when it helps the team.
- When images are attached, use them for layout and UX planning.
- Ask clarifying questions only when code and thread still leave real ambiguity (e.g. copy URL vs ticket id vs title text).

PLANNING ONLY: do not edit files, run tests, commit, push, or open pull requests.
The team runs a separate \`build\` command when they want implementation.
Keep replies concise and conversational for a JeiChat thread.`;

export const PLANNING_SEND = { mode: "plan" };

export function planningCursorOptions(context, startingRef) {
  return cursorAgentOptions({
    autoCreatePR: false,
    context,
    startingRef,
  });
}

function planningAgentOptions(context, startingRef) {
  return planningCursorOptions(context, startingRef);
}

async function runPlanningAgentSend(agent, userMessage) {
  const run = await agent.send(userMessage, cursorSendOptions(PLANNING_SEND));
  return readAssistantText(run);
}

function planningRetryDelayMs(attempt) {
  return 2500 * (attempt + 1);
}

export async function sendPlanningTurn(params) {
  const maxAttempts = 3;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await sendPlanningTurnInner(params, {
        forceNewAgent: attempt > 0,
        textOnly: attempt > 0,
      });
    } catch (error) {
      lastError = error;
      if (!isRecoverableCursorRunError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      console.warn(
        `planning attempt ${attempt + 1} failed, retrying with a fresh cloud agent`,
        error,
      );
      await params.store.clear(params.channelId);
      await new Promise((resolve) =>
        setTimeout(resolve, planningRetryDelayMs(attempt)),
      );
    }
  }
  throw lastError;
}

async function sendPlanningTurnInner(
  {
    store,
    channelId,
    userText,
    context,
    client,
    triggerMessageId,
    triggerAttachments,
  },
  retry = {},
) {
  const parsedBase = parseBaseRefFromMessage(userText);
  if (parsedBase) {
    await store.setBaseRef(channelId, parsedBase);
  }

  const startingRef = await resolveStartingRef(
    store,
    channelId,
    context.channel.description,
  );
  const prompt = buildPlanningPrompt(userText, context, startingRef);
  const imageAttachments = collectImageAttachments(context.messages, {
    triggerMessageId,
    triggerAttachments,
  });
  const images =
    retry.textOnly || !client
      ? []
      : await resolveSdkImages(client, imageAttachments);
  const userMessage = buildAgentUserMessage(prompt, images);
  const textOnlyMessage = prompt;
  const bootstrapPrompt = `${PLANNING_SYSTEM}\n\n---\n\n${prompt}`;
  const createUserMessage = buildAgentUserMessage(bootstrapPrompt, images);
  let agentId = retry.forceNewAgent ? null : await store.get(channelId);

  try {
    if (agentId) {
      await using agent = await Agent.resume(agentId, {
        ...planningAgentOptions(context, startingRef),
      });
      let reply;
      try {
        reply = await runPlanningAgentSend(agent, userMessage);
      } catch (error) {
        if (images.length === 0) throw error;
        console.warn("planning with images failed, retrying text only", error);
        reply = await runPlanningAgentSend(agent, textOnlyMessage);
      }
      return { reply, agentId, resumed: true };
    }
  } catch (error) {
    if (error instanceof CursorAgentError) {
      await store.clear(channelId);
      agentId = null;
    } else if (isRecoverableCursorRunError(error)) {
      await store.clear(channelId);
      agentId = null;
    } else {
      throw error;
    }
  }

  await using agent = await Agent.create({
    ...planningAgentOptions(context, startingRef),
    name: "JeiChat ticket planning",
  });
  let reply;
  try {
    reply = await runPlanningAgentSend(agent, createUserMessage);
  } catch (error) {
    if (images.length === 0) throw error;
    console.warn("planning with images failed, retrying text only", error);
    reply = await runPlanningAgentSend(agent, bootstrapPrompt);
  }
  const id = agent.id ?? agent.agentId;
  if (!id) {
    throw new Error("Cursor did not return a planning agent id");
  }
  await store.set(channelId, id);
  return { reply, agentId: id, resumed: false };
}

function buildPlanningPrompt(userText, context, startingRef) {
  const id = ticketDisplayId(context.channel);
  const featureBranch = suggestedBranchForTicket(context);
  const stored = startingRef?.trim();
  const envDefault = defaultBaseRef();
  const baseLine = stored
    ? `Base ref (branch out from): ${stored}`
    : `Base ref: not set yet — ask which branch to branch from before scoping (bot default if unset: ${envDefault})`;
  const branchLine = featureBranch
    ? `Feature branch (for PR — same as GitHub panel copy): ${featureBranch}`
    : "Feature branch: (set board ticket key to get GEN-19-title-slug style name)";
  const parts = [
    `Ticket: ${id}`,
    `URL: ${context.ticketUrl}`,
    formatRepoContext(context, startingRef),
    baseLine,
    branchLine,
    context.channel.description
      ? `Current description:\n${context.channel.description}`
      : "Current description: (empty)",
    "",
    "Thread so far:",
    context.transcript || "(no messages yet)",
    "",
    `Latest message from the team:\n${userText}`,
    "",
    "Planning turn only — explore the repo read-only, then reply with scope and questions. No code changes or PRs.",
  ];
  return parts.join("\n");
}

function formatRepoContext(context, startingRef) {
  const ref = startingRef?.trim() || defaultBaseRef();
  const hints = process.env.PLANNING_REPO_HINTS?.trim();
  const lines = [];

  if (context.github?.owner && context.github?.repo) {
    lines.push(
      `Repository: ${context.github.owner}/${context.github.repo} @ ${ref}`,
    );
    lines.push(`Repo URL: ${context.github.repoUrl}`);
  } else {
    const url = resolveRepoUrl(context);
    if (url) lines.push(`Repository: ${url} @ ${ref}`);
  }

  if (hints) lines.push(`Repo layout hints: ${hints}`);

  if (lines.length === 0) {
    return "Repository: (not configured on this ticket board)";
  }
  return lines.join("\n");
}

export async function resolvePlanningImages(client, context, options = {}) {
  const imageAttachments = collectImageAttachments(context.messages, options);
  if (!client || imageAttachments.length === 0) return [];
  return resolveSdkImages(client, imageAttachments);
}

export const DRAFT_FINAL_PROMPT = `Write the final ticket specification as markdown with these sections only:
## Base ref
## Branch
## Goal
## Done when
## UI refs
## Test account
## Routes
## Verify commands
## Verify scope

Base ref is the git branch to branch FROM (not the feature branch name).
Under ## Branch put ONLY the exact feature branch name given in the prompt (JeiChat ticket branch code, e.g. GEN-19-my-title-slug). Never use cursor/… or other agent-invented branch names.
Output the full markdown now — all nine sections with real content from the planning thread. No status lines (e.g. "Verifying…"), no preamble, no placeholders.
Use checkboxes under Done when.
Under UI refs, list repo anchors you verified: file paths, component names, and/or app routes (use "N/A" only for non-UI work).
Under ## Test account: sign-in email and password for browser verification, or "N/A" if no auth.
Under ## Routes: full http://localhost… URLs and/or app paths to open when verifying (one per line). Use "N/A" for non-UI work.
Under ## Verify commands: start with `bun install`, then builds/tests for packages the diff touches (e.g. `cd apps/messages-api && bun run build`). Prefer the smallest set that proves the change.
Under ## Verify scope: either \`browser\` (exercise UI) or \`static-only\` (typecheck/tests only — no dev server).
Reference any screenshots from the thread when describing UI. Base everything on this planning conversation, the thread, and the codebase. No preamble.`;
