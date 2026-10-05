import { loadTicketThread } from "./plan-context.js";

/**
 * GET /plan/:channelId — ticket thread context for resume seeding / debugging.
 * Requires header `x-plan-secret` when PLAN_HTTP_SECRET is set.
 */
export function startPlanServer(client, store) {
  const port = Number(process.env.PLAN_HTTP_PORT?.trim() || 0);
  if (!port) return null;

  const secret = process.env.PLAN_HTTP_SECRET?.trim();
  const workspaceId = client.user?.workspaceId;

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      if (secret) {
        const provided = request.headers.get("x-plan-secret");
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
      }

      const match = url.pathname.match(/^\/plan\/([^/]+)$/);
      if (!match) {
        return new Response("Not found", { status: 404 });
      }

      const channelId = match[1];
      try {
        const context = await loadTicketThread(client, workspaceId, channelId);
        const planningAgentId = await store.get(channelId);
        return Response.json({
          channelId,
          planningAgentId,
          ticketUrl: context.ticketUrl,
          isTicket: context.isTicket,
          github: context.github,
          description: context.channel.description,
          transcript: context.transcript,
          messageCount: context.messages.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "error";
        return Response.json({ error: message }, { status: 500 });
      }
    },
  });

  console.log(`Plan context HTTP on port ${server.port} (GET /plan/:channelId)`);
  return server;
}
