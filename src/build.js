import { Agent } from "@cursor/sdk";
import { isRecoverableCursorRunError } from "./cursor-run.js";
import { cursorAgentOptions, truncateReply } from "./cursor-options.js";
import { resolveStartingRef } from "./base-ref.js";
import { ticketDisplayId } from "./plan-context.js";
import { suggestedBranchForTicket } from "./ticket-branch.js";

function buildPrompt(context, description, startingRef) {
  const id = ticketDisplayId(context.channel);
  const featureBranch = suggestedBranchForTicket(context);
  return {
    id,
    featureBranch,
    text: [
      "Implement this JeiChat ticket in the linked repository.",
      `Ticket: ${id}`,
      `Ticket URL: ${context.ticketUrl}`,
      `Checkout base ref: ${startingRef}`,
      featureBranch
        ? `Create work on feature branch: ${featureBranch} (branch from base ref).`
        : "Use the ## Branch name from the specification for your feature branch.",
      "",
      "Specification:",
      description,
      "",
      "Open a PR when done. Put the ticket id and URL in the PR body.",
    ].join("\n"),
  };
}

async function startBuildAgent({ context, store, channelId, description, startingRef }) {
  const { text, id, featureBranch } = buildPrompt(
    context,
    description,
    startingRef,
  );

  await using agent = await Agent.create({
    ...cursorAgentOptions({
      autoCreatePR: true,
      context,
      mode: "agent",
      startingRef,
    }),
    name: "JeiChat ticket build",
  });

  const run = await agent.send(text, { mode: "agent" });
  const agentId = agent.id ?? agent.agentId ?? null;

  return {
    ticketId: id,
    featureBranch,
    startingRef,
    agentId,
    runId: run.id,
    runStatus: run.status,
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
  return truncateReply(lines.join("\n"));
}

export async function runBuild({ context, store, channelId }) {
  const description = context.channel.description?.trim();
  if (!description) {
    return "Add a spec first (`draft` after planning, or edit the description manually), then run `build`.";
  }

  const startingRef = await resolveStartingRef(store, channelId, description);

  try {
    const info = await startBuildAgent({
      context,
      store,
      channelId,
      description,
      startingRef,
    });
    return formatBuildStarted(info);
  } catch (error) {
    if (!isRecoverableCursorRunError(error)) throw error;
    console.warn("build failed, retrying once", error);
    const info = await startBuildAgent({
      context,
      store,
      channelId,
      description,
      startingRef,
    });
    return formatBuildStarted(info);
  }
}
