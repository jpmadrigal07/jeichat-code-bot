import { sendMessageWithAttachments } from "./attachments.js";
import { resolveTicketGitContext } from "./ticket-git-context.js";
import { ticketDisplayId } from "./plan-context.js";
import {
  downloadVerificationArtifacts,
  postVerificationScreenshotsEnabled,
} from "./verification-artifacts.js";
import { endTicketRun, ticketRuns } from "./ticket-run-guard.js";
import { loadTicketForVerify, runCodeVerification } from "./verify-run.js";
import { buildWaitTimeoutMs, cursorAgentUrl } from "./verify-timing.js";

async function disposeAgent(agent) {
  if (!agent) return;
  if (typeof agent[Symbol.asyncDispose] === "function") {
    await agent[Symbol.asyncDispose]();
    return;
  }
  agent.close();
}

async function waitForBuildRun(run, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `build timed out after ${Math.round(timeoutMs / 60000)} minutes`,
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

async function runVerificationForTicket(client, context, channelId, hints, options = {}) {
  let verifyAgentRef = null;
  const ticket = await loadTicketForVerify(client, context, {
    branchHint: hints.branchHint,
    botUserId: client.user?.userId,
  });
  ticket.displayId = ticketDisplayId(context.channel);

  const git = await resolveTicketGitContext(client, ticket, {
    branchHint: hints.branchHint,
    botUserId: client.user?.userId,
  });
  if (!git?.branch && !git?.prUrl) {
    return "I need a linked **GitHub PR** on this ticket, or a `Branch:` line / ## Branch in the spec, before I can verify.";
  }

  if (!options.skipStatusMessage) {
    await client.send(
      channelId,
      `Verifying ${git.branch ? `\`${git.branch}\`` : "the PR"}${git.prUrl ? ` (${git.prUrl})` : ""}…`,
    );
  }

  const summary = await runCodeVerification(ticket, git, {
    onAgent(agent) {
      verifyAgentRef = agent;
    },
    onRunStarted({ agentId }) {
      ticketRuns.update(channelId, { agentId });
      const url = cursorAgentUrl(agentId);
      if (url) {
        void client.send(channelId, `Verification agent: ${url}`);
      }
    },
  });

  if (
    postVerificationScreenshotsEnabled() &&
    verifyAgentRef &&
    typeof verifyAgentRef.listArtifacts === "function"
  ) {
    const files = await downloadVerificationArtifacts(verifyAgentRef);
    if (files.length > 0) {
      await sendMessageWithAttachments(client, channelId, summary, files);
      return null;
    }
  }

  return summary;
}

/**
 * After the build agent finishes, run verification and post screenshots (reviewer-bot flow).
 * Caller must already hold the per-ticket **build** run lock.
 */
export async function runPostBuildVerification(
  client,
  context,
  channelId,
  buildAgent,
  buildRun,
  hints = {},
) {
  try {
    const buildResult = await waitForBuildRun(
      buildRun,
      buildWaitTimeoutMs(),
    );
    if (buildResult.status !== "finished") {
      await client.send(
        channelId,
        `Build agent ended with status **${buildResult.status}** — skipping automatic verification. Run \`verify\` manually once the PR is ready.`,
      );
      return;
    }

    await client.send(
      channelId,
      "Build finished — running tests and capturing verification screenshots (often **10–25 min** on Cursor cloud)…",
    );

    const ticket = await loadTicketForVerify(client, context, {
      branchHint: hints.branchHint,
      botUserId: client.user?.userId,
    });
    ticket.displayId = ticketDisplayId(context.channel);

    const git = await resolveTicketGitContext(client, ticket, {
      branchHint: hints.branchHint,
      botUserId: client.user?.userId,
    });
    if (!git?.branch && !git?.prUrl) {
      await client.send(
        channelId,
        "Build finished but I could not find a **PR** or **branch** yet — run `@… verify` once the GitHub panel shows the pull request.",
      );
      return;
    }

    await runVerificationForTicket(client, context, channelId, hints, {
      skipStatusMessage: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("post-build verification failed", error);
    await client.send(
      channelId,
      `Post-build verification failed: ${detail}. Try \`@… verify\` when the PR is ready.`,
    );
  } finally {
    await disposeAgent(buildAgent);
    endTicketRun(channelId, "build");
  }
}

/** Release build lock when auto-verify is off but the cloud build agent is still running. */
export async function releaseWhenBuildDone(channelId, buildAgent, buildRun) {
  try {
    await waitForBuildRun(buildRun, buildWaitTimeoutMs());
  } catch (error) {
    console.error("build run wait failed", error);
  } finally {
    await disposeAgent(buildAgent);
    endTicketRun(channelId, "build");
  }
}

/**
 * Manual `verify` command — same verification flow without waiting on a build agent.
 */
export async function runManualVerification(
  client,
  context,
  channelId,
  hints = {},
  options = {},
) {
  const lock = ticketRuns.tryStart(channelId, "verify");
  if (!lock.ok) {
    return ticketRuns.conflictMessage(lock.current);
  }

  try {
    const summary = await runVerificationForTicket(
      client,
      context,
      channelId,
      hints,
      { skipStatusMessage: options.skipStatusMessage },
    );
    return summary;
  } finally {
    endTicketRun(channelId, "verify");
  }
}
