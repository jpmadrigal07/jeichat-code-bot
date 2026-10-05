# JeiChat code bot (`jeichat-code-bot`)

Standalone bot for **ticket planning**: chat in the thread → **`draft`** fills the description → you review → **`build`** runs a **new** Cursor cloud agent and opens a PR.

This is **not** the fixer. Assignee-driven bug fixes live in [`jeichat-fixer-bot`](../jeichat-fixer-bot). Live-site bug checking is [`jeichat-bug-checker-bot`](../jeichat-bug-checker-bot).

| Repo | JeiChat bot (you choose the display name) | Job |
|------|-------------------------------------------|-----|
| `jeichat-code-bot` | e.g. **Code** | Plan, `draft` spec, `build` PR |
| `jeichat-fixer-bot` | e.g. fixer / Natasha | Assignee fix after checker `CONFIRM` |
| `jeichat-bug-checker-bot` | Bug checker | Reproduce on live site after **Bug** label |

## Flow

1. Assign **Code** on the ticket (or create with that assignee) — the bot asks what to plan in the thread.
2. In the **ticket thread**, `@Code let's scope the settings page change…` — first message creates a Cursor planning agent; later messages **`Agent.resume`** the same id (stored per ticket in Redis or memory).
2. `@Code draft` — writes **Branch / Goal / Done when / UI refs** into the ticket description and clears the planning session.
3. You edit the description if needed.
4. `@Code build` — always a **fresh** `Agent.create` coding run (PR). Never reuses the planning session.

Features do **not** auto-build on assign (only a planning kickoff). Bugs still go through checker → fixer, not this bot.

## Prerequisites

- [Bun](https://bun.sh)
- JeiChat API at `http://localhost:3001`
- Workspace **owner** (to create the bot)
- [Cursor API key](https://cursor.com/dashboard/integrations)
- GitHub access on the Cursor account for `CURSOR_REPO_URL`

## Run

1. JeiChat: **Settings → Bots → Create** — name it e.g. `Code`. Copy the `jei_live_…` token once.
2. In this folder:

```bash
bun install
cp .env.example .env
```

3. Set `JEICHAT_BOT_TOKEN`, `CURSOR_API_KEY`, and repo settings in `.env`.
4. Start:

```bash
bun run start
```

5. In a ticket thread: `@Code help`, chat to plan, `@Code draft`, then `@Code build` when ready.

### Plan context HTTP (optional)

Set `PLAN_HTTP_PORT` (and `PLAN_HTTP_SECRET`) to expose:

`GET /plan/:channelId` → `{ planningAgentId, transcript, description, … }`

Useful when a planning agent id expired and you need to re-seed from the JeiChat thread.

## Deploy

Same pattern as the fixer: Coolify **Application** from `Dockerfile`, no public domain, env vars from `.env.example`.

## Env

| Variable | Purpose |
|----------|---------|
| `JEICHAT_BOT_TOKEN` | This bot’s token |
| `JEICHAT_API_URL` | API origin |
| `JEICHAT_WEB_ORIGIN` | Ticket links in prompts |
| `CURSOR_API_KEY` | Cursor SDK |
| `CURSOR_RUNTIME` | `cloud` (default) or `local` |
| `CURSOR_REPO_URL` / `CURSOR_REPO_REF` | Target repo for build |
| `UPSTASH_REDIS_*` | Shared `planningAgentId` across restarts |
| `PLANNING_AGENT_TTL_SECONDS` | Redis / memory TTL (default 7d) |
| `PLAN_HTTP_PORT` / `PLAN_HTTP_SECRET` | Optional context route |

See [SPEC.md](./SPEC.md) for the full contract.
