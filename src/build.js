import { Agent, CursorAgentError } from "@cursor/sdk";
import { isRecoverableCursorRunError } from "./cursor-run.js";
import {
  cursorAgentOptions,
  cursorSendOptions,
  truncateReply,
} from "./cursor-options.js";
import { resolveStartingRef } from "./base-ref.js";
import { ticketDisplayId } from "./plan-context.js";
import { suggestedBranchForTicket } from "./ticket-branch.js";
import {
  releaseWhenBuildDone,
  runPostBuildVerification,
} from "./post-build-verify.js";
import { endTicketRun, ticketRuns } from "./ticket-run-guard.js";
import { verifyAfterBuildEnabled } from "./verify-timing.js";
import { cursorCloudEnvDirections } from "./cloud-env-hint.js";

function buildPrompt(context, description, startingRef) {
  const id = ticketDisplayId(context.channel);
  const featureBranch = suggestedBranchForTicket(context);
  const envBlock = cursorCloudEnvDirections();
  const parts = [
    "Implement this JeiChat ticket in the linked repository.",
    `Ticket: ${id}`,
    `Ticket URL: ${context.ticketUrl}`,
    `Checkout base ref: ${startingRef}`,
    featureBranch
      ? `Create work on feature branch: ${featureBranch} (branch from base ref).`
      : "Use the ## Branch name from the specification for your feature branch.",
  ];
  if (envBlock) parts.push("", envBlock);
  parts.push(
    "",
    "Specification:",
    description,
    "",
    "Implement against **Goal** and **Done when**. For UI work, use **UI refs** and **Routes** from the spec.",
    "Do **not** start `bun run dev`, run browser automation, or capture verification screenshots — a separate **verify** agent tests the PR after you open it. Focus on code, targeted typecheck/lint for files you touch, and the PR.",
    "Open a PR when done. Put the ticket id and URL in the PR body.",
  );

  return {
    id,
    featureBranch,
    text: parts.join("\n"),
  };
}

async function startBuildAgent({ context, store, channelId, description, startingRef }) {
  const { text, id, featureBranch } = buildPrompt(
    context,
    description,
    startingRef,
  );

  const agent = await Agent.create({
    ...cursorAgentOptions({
      autoCreatePR: true,
      context,
      startingRef,
    }),
    name: "JeiChat ticket build",
  });

  const run = await agent.send(text, cursorSendOptions({ mode: "agent" }));
  const agentId = agent.id ?? agent.agentId ?? null;

  return {
    ticketId: id,
    featureBranch,
    startingRef,
    agentId,
    runId: run.id,
    runStatus: run.status,
    agent,
    run,
  };
}

function formatBuildStarted(info) {
  const lines = [
    "Build agent **started** on Cursor cloud (this chat does not wait for the PR).",
    "",
    `Ticket **${info.ticketId}** · base \`${info.startingRef}\``,
  ];
  if (info.featureBranch) {
    lines.push(`Branch \`${info.featureBranch}\``);
  }
  if (info.agentId) {
    lines.push(`Agent \`${info.agentId}\`${info.runId ? ` · run \`${info.runId}\`` : ""}`);
  }
  lines.push(
    "",
    "Watch this ticket’s **GitHub** section and your repo for the pull request. If nothing shows up after several minutes, run `@… build` again.",
  );
  if (verifyAfterBuildEnabled()) {
    lines.push(
      "",
      "When the build agent finishes, I will automatically run **verification** (tests + browser checks) and post screenshots here.",
    );
  }
  return truncateReply(lines.join("\n"));
}

export async function runBuild({ client, context, store, channelId }) {
  const description = context.channel.description?.trim();
  if (!description) {
    return "Add a spec first (`draft` after planning, or edit the description manually), then run `build`.";
  }

  const startingRef = await resolveStartingRef(store, channelId, description);

  const lock = ticketRuns.tryStart(channelId, "build");
  if (!lock.ok) {
    return ticketRuns.conflictMessage(lock.current);
  }

  try {
    const info = await startBuildAgent({
      context,
      store,
      channelId,
      description,
      startingRef,
    });
    ticketRuns.update(channelId, { agentId: info.agentId });
    schedulePostBuildVerification({ client, context, channelId, info });
    return formatBuildStarted(info);
  } catch (error) {
    if (!isRecoverableCursorRunError(error)) {
      endTicketRun(channelId, "build");
      throw formatBuildError(error);
    }
    console.warn("build failed, retrying once", error);
    try {
      const info = await startBuildAgent({
        context,
        store,
        channelId,
        description,
        startingRef,
      });
      ticketRuns.update(channelId, { agentId: info.agentId });
      schedulePostBuildVerification({ client, context, channelId, info });
      return formatBuildStarted(info);
    } catch (retryError) {
      endTicketRun(channelId, "build");
      throw formatBuildError(retryError);
    }
  }
}

function formatBuildError(error) {
  if (error instanceof CursorAgentError) {
    return new Error(
      `Could not start the Cursor build agent: ${error.message}. Check CURSOR_API_KEY, repo access, and CURSOR_CLOUD_ENVIRONMENT.`,
    );
  }
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function schedulePostBuildVerification({ client, context, channelId, info }) {
  if (!info.agent || !info.run) {
    endTicketRun(channelId, "build");
    return;
  }
  if (!client?.user) {
    endTicketRun(channelId, "build");
    return;
  }
  if (verifyAfterBuildEnabled()) {
    void runPostBuildVerification(
      client,
      context,
      channelId,
      info.agent,
      info.run,
      { branchHint: info.featureBranch },
    );
    return;
  }
  void releaseWhenBuildDone(channelId, info.agent, info.run);
}
