import {
  isAssignedToBot,
  isUnassignedFromBot,
  ticketIdFromEvent,
} from "./assignee.js";
import { formatPlanningAssignPrompt } from "./assign-prompt.js";
import { ticketsAssignedToBot } from "./backfill.js";
import { defaultBaseRef, sanitizeBaseRef } from "./base-ref.js";
import { runBuild } from "./build.js";
import { runManualVerification } from "./post-build-verify.js";
import { suggestedBranchForTicket } from "./ticket-branch.js";
import { ApiError, JeiChat } from "./client.js";
import { commandError, HELP_TEXT, parseCommand } from "./commands.js";
import { createAssigneeDebouncer } from "./debounce.js";
import { runDraft } from "./draft.js";
import { isBotMentioned, stripBotMentions } from "./mention.js";
import { fetchChannel, loadTicketThread, ticketDisplayId } from "./plan-context.js";
import { createPlanningStore } from "./planning-store.js";
import { sendPlanningTurn } from "./planning-agent.js";
import { startPlanServer } from "./plan-server.js";
import { ticketRuns } from "./ticket-run-guard.js";

const token = process.env.JEICHAT_BOT_TOKEN?.trim();
if (!token) {
  console.error("Set JEICHAT_BOT_TOKEN (create a bot in JeiChat Settings → Bots).");
  process.exit(1);
}

const client = new JeiChat({
  apiUrl: process.env.JEICHAT_API_URL ?? "http://localhost:3002",
});

const store = createPlanningStore();
const busy = new Set();
const assignDebouncer = createAssigneeDebouncer();

client.on("ready", () => {
  console.log(
    `Code bot ready as ${client.user?.name} in workspace ${client.user?.workspaceId}`,
  );
  console.log(
    `In a ticket thread: @${client.user?.name} <message> | base | draft | build | help`,
  );
  console.log(
    "Assign me to a ticket to get a planning kickoff message in the thread.",
  );
  startPlanServer(client, store);
  if (process.env.CODE_BOT_SKIP_ASSIGN_BACKFILL?.trim() !== "1") {
    void backfillAssignedTickets();
  } else {
    console.log("Assign backfill skipped (CODE_BOT_SKIP_ASSIGN_BACKFILL=1).");
  }
});

client.on("ticketUpdate", (event) => {
  const botUserId = client.user?.userId;
  if (!botUserId) return;
  const ticketId = ticketIdFromEvent(event);

  if (isUnassignedFromBot(event, botUserId)) {
    assignDebouncer.cancel(ticketId);
    return;
  }
  if (!isAssignedToBot(event, botUserId)) return;

  assignDebouncer.schedule(ticketId, () => {
    void promptPlanningStart(ticketId);
  });
});

async function promptPlanningStart(ticketId) {
  const botUserId = client.user?.userId;
  const workspaceId = client.user?.workspaceId;
  const botName = client.user?.name ?? "Code";
  if (!botUserId || !workspaceId) return;

  try {
    const channel = await fetchChannel(client, workspaceId, ticketId);
    if (!channel.parentId) return;
    if (channel.assigneeId !== botUserId) return;

    const label = ticketDisplayId(channel);
    await client.send(
      ticketId,
      formatPlanningAssignPrompt(botName, label),
    );
  } catch (error) {
    console.error("promptPlanningStart failed", error);
    try {
      await client.send(
        ticketId,
        "I'm assigned but couldn't load ticket details — mention me with what you want to plan.",
      );
    } catch (sendError) {
      console.error("planning kickoff fallback failed", sendError);
    }
  }
}

async function backfillAssignedTickets() {
  const workspaceId = client.user?.workspaceId;
  const botUserId = client.user?.userId;
  if (!workspaceId || !botUserId) return;

  try {
    const channels = await client.get(`/workspaces/${workspaceId}/channels`);
    const ids = ticketsAssignedToBot(channels, botUserId);
    console.log(
      ids.length > 0
        ? `Backfill: ${ids.length} ticket(s) already assigned to me — sending planning prompts.`
        : "Backfill: no tickets assigned to me.",
    );
    for (const id of ids) {
      assignDebouncer.schedule(id, () => {
        void promptPlanningStart(id);
      });
    }
  } catch (error) {
    console.error("assigned-ticket backfill failed", error);
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const botName = client.user?.name ?? "";
  if (!botName || !isBotMentioned(message.content, botName)) return;

  const workspaceId = client.user?.workspaceId;
  if (!workspaceId) return;

  const body = stripBotMentions(message.content, botName);
  const command = parseCommand(body);

  if (command?.name === "help") {
    await message.reply(HELP_TEXT);
    return;
  }

  let context;
  try {
    context = await loadTicketThread(client, workspaceId, message.channelId);
  } catch (error) {
    await message.reply(commandError(error));
    return;
  }

  if (!context.isTicket) {
    await message.reply("Open a **ticket thread** and mention me there.");
    return;
  }

  if (
    (command?.name === "build" || command?.name === "verify") &&
    ticketRuns.isActive(message.channelId)
  ) {
    await message.reply(
      ticketRuns.conflictMessage(ticketRuns.get(message.channelId)),
    );
    return;
  }

  if (busy.has(message.channelId)) {
    await message.reply("Still working on this ticket — try again in a moment.");
    return;
  }

  busy.add(message.channelId);
  try {
    if (command?.name === "status") {
      const planningAgentId = await store.get(message.channelId);
      const storedBase = await store.getBaseRef(message.channelId);
      const desc = context.channel.description?.trim();
      const repoLine = context.github
        ? `GitHub: \`${context.github.owner}/${context.github.repo}\``
        : "GitHub: not linked on this board (connect in board channel settings)";
      await message.reply(
        [
          `Ticket **${ticketDisplayId(context.channel)}**`,
          repoLine,
          storedBase
            ? `Base ref: \`${storedBase}\` (branch out from here)`
            : `Base ref: not set — use \`base <branch>\` or answer when asked (bot default: \`${defaultBaseRef()}\`)`,
          planningAgentId
            ? `Planning session: \`${planningAgentId}\``
            : "Planning session: none (next message starts a new Cursor agent)",
          desc
            ? `Description: ${desc.length} chars`
            : "Description: empty — run `draft` after planning",
          ticketRuns.statusLine(message.channelId),
        ].join("\n"),
      );
      return;
    }

    if (command?.name === "base") {
      const ref = sanitizeBaseRef(command.ref);
      if (!ref) {
        await message.reply(
          "Usage: `@… base <branch>` — git branch to branch **from** (e.g. `base develop`).",
        );
        return;
      }
      await store.setBaseRef(message.channelId, ref);
      await message.reply(
        `Base ref set to \`${ref}\`. Planning and \`draft\` will use this checkout. Continue scoping in chat or run \`draft\` when ready.`,
      );
      return;
    }

    if (command?.name === "draft") {
      await message.reply("Writing the spec into the ticket description…");
      const reply = await runDraft({
        client,
        workspaceId,
        channelId: message.channelId,
        store,
        context,
      });
      await client.send(message.channelId, reply);
      return;
    }

    if (command?.name === "build") {
      await message.reply(
        "Starting a **new** coding agent from the ticket description (runs on Cursor cloud; may take a while)…",
      );
      const reply = await runBuild({
        client,
        context,
        store,
        channelId: message.channelId,
      });
      await client.send(message.channelId, reply);
      return;
    }

    if (command?.name === "verify") {
      await message.reply(
        "Starting verification on the PR branch (tests + screenshots; may take a while on Cursor cloud)…",
      );
      const summary = await runManualVerification(
        client,
        context,
        message.channelId,
        { branchHint: suggestedBranchForTicket(context) },
        { skipStatusMessage: true },
      );
      if (summary) {
        await client.send(message.channelId, summary);
      }
      return;
    }

    if (!body) {
      await message.reply(HELP_TEXT);
      return;
    }

    await message.reply("Thinking…");
    const { reply, resumed } = await sendPlanningTurn({
      store,
      channelId: message.channelId,
      userText: body,
      context,
      client,
      triggerMessageId: message.id,
      triggerAttachments: message.attachments,
    });
    const prefix = resumed ? "" : "_Started a new planning session._\n\n";
    await client.send(message.channelId, `${prefix}${reply}`);
  } catch (error) {
    console.error(
      "handler failed",
      error,
      error instanceof ApiError ? error.body : undefined,
    );
    try {
      await client.send(message.channelId, commandError(error));
    } catch (sendError) {
      console.error("could not post error reply", sendError);
      await message.reply(commandError(error));
    }
  } finally {
    busy.delete(message.channelId);
  }
});

await client.login(token);
