import { Agent, CursorAgentError } from "@cursor/sdk";
import { readAssistantText } from "./cursor-run.js";
import { truncateReply } from "./cursor-options.js";
import { resolveStartingRef } from "./base-ref.js";
import {
  DRAFT_FINAL_PROMPT,
  PLANNING_SEND,
  planningCursorOptions,
  resolvePlanningImages,
} from "./planning-agent.js";
import { buildAgentUserMessage } from "./message-attachments.js";
import {
  ensureSpecBranch,
  isCompleteTicketSpec,
  missingTicketSpecSections,
  suggestedBranchForTicket,
} from "./ticket-branch.js";

async function requestDraftSpec({
  agentId,
  agentOpts,
  draftBody,
  fallbackBody,
  context,
}) {
  if (agentId) {
    try {
      await using agent = await Agent.resume(agentId, {
        ...agentOpts,
      });
      const run = await agent.send(draftBody, PLANNING_SEND);
      const text = (await readAssistantText(run)).trim();
      if (isCompleteTicketSpec(text)) return text;
    } catch (error) {
      if (!(error instanceof CursorAgentError)) throw error;
    }
  }

  await using agent = await Agent.create({
    ...agentOpts,
    name: "JeiChat ticket planning",
  });
  const run = await agent.send(fallbackBody, PLANNING_SEND);
  const text = (await readAssistantText(run)).trim();
  if (!isCompleteTicketSpec(text)) {
    const missing = missingTicketSpecSections(text);
    throw new Error(
      `Draft was incomplete (missing ${missing.join(", ") || "sections"}). Try \`@… draft\` again, or paste Goal / Done when into the description manually.`,
    );
  }
  return text;
}

export async function runDraft({
  client,
  workspaceId,
  channelId,
  store,
  context,
}) {
  const agentId = await store.get(channelId);
  const startingRef = await resolveStartingRef(
    store,
    channelId,
    context.channel.description,
  );
  const images = await resolvePlanningImages(client, context);
  const featureBranch = suggestedBranchForTicket(context);
  const branchHint = featureBranch
    ? `\nFeature branch (## Branch must be exactly): ${featureBranch}`
    : "";
  const draftPrompt = `${DRAFT_FINAL_PROMPT}\n\nUse base ref: ${startingRef}${branchHint}`;
  const draftBody = buildAgentUserMessage(draftPrompt, images);
  const fallbackText = `${draftPrompt}\n\nThread:\n${context.transcript}`;
  const fallbackBody = buildAgentUserMessage(fallbackText, images);
  const agentOpts = planningCursorOptions(context, startingRef);

  const spec = await requestDraftSpec({
    agentId,
    agentOpts,
    draftBody,
    fallbackBody,
    context,
  });

  const description = ensureSpecBranch(spec, featureBranch);
  if (!isCompleteTicketSpec(description)) {
    const missing = missingTicketSpecSections(description);
    throw new Error(
      `Draft was incomplete after branch fix (missing ${missing.join(", ")}). Try \`@… draft\` again.`,
    );
  }

  await store.clear(channelId);
  await store.clearBaseRef(channelId);
  await client.patch(`/workspaces/${workspaceId}/channels/${channelId}`, {
    description,
  });

  const branchLine = featureBranch ? `\n**Branch:** \`${featureBranch}\`` : "";
  return truncateReply(
    "Updated the ticket **description** from our planning chat (see the ticket header). Review it, edit if needed, then `@… build` when you are ready for a PR." +
      branchLine,
  );
}
