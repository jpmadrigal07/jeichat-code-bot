# Code bot contract

## Scope

- **In scope:** ticket-thread planning chat, assignee kickoff prompt, `draft` → ticket description, explicit `build` → PR, post-build **`verify`** (tests + screenshots; shared with `jeichat-reviewer-bot` prompts).
- **Out of scope:** assignee auto-fix (`jeichat-fixer-bot`), bug label QA (`jeichat-bug-checker-bot`), workspace “Create bot” tokens used for customer automations.

## Commands (after `@<bot name>`)

| Command | Behavior |
|---------|----------|
| _(free text)_ | Planning turn: repo-grounded chat; **image attachments** in the thread are sent to Cursor when present |
| `draft` | Final planning prompt → PATCH ticket `description` → clear planning id |
| `build` | New `Agent.create`, `autoCreatePR: true`, prompt = ticket description; when `CODE_VERIFY_AFTER_BUILD` (default on), waits for build then runs verification + screenshots |
| `verify` | Manual verification run on PR / feature branch (same flow as reviewer bot) |
| `status` | Planning id + description length |
| `help` | Usage |

## Session rules

- When this bot becomes the **assignee** on a ticket, it posts a kickoff message asking what to plan (same pattern as assign on live `assignee_changed` events; backfill on bot restart).
- **One planning Cursor agent per ticket channel** while planning. Planning uses Cursor **`mode: plan`** (read/explore, no PR); **`build`** uses **`mode: agent`** + `autoCreatePR`.
- **`build` is always a new agent** — separate from planning.
- If resume fails (expired id, error): create a new planning agent; optional `GET /plan/:channelId` supplies thread transcript for seeding.

## Ticket description template (`draft`)

```markdown
## Base ref
## Branch
## Goal
## Done when
## UI refs
## Test account
## Routes
## Verify commands
## Verify scope
```

`Base ref` is the git branch to branch **from**. `Branch` is the feature branch name for the PR — the **JeiChat ticket branch code** (same string as GitHub → copy on the ticket), e.g. `GEN-19-my-title-slug`, not `cursor/…` names.

`UI refs` should include verified repo anchors (paths, components, routes), not only external design links.

`Test account` — email/password for browser verification, or `N/A`.

`Routes` — `http://localhost…` URLs and/or app paths to open when verifying (one per line), or `N/A`.

`Verify commands` — exact shell commands agents should run (smallest set that proves the change).

`Verify scope` — `browser` (UI + dev server when needed) or `static-only` (typecheck/tests only).

Human edits the description before `build`.

### Cloud agent bootstrap (target repo)

Copy [`templates/monorepo-AGENTS.md`](./templates/monorepo-AGENTS.md) to the linked repo as `AGENTS.md` and use [`templates/cursor-environment-install.sh`](./templates/cursor-environment-install.sh) in the Cursor Environment **install** script. **Verify boot** is ticket **## Verify commands** plus optional bot env (`VERIFY_GLOBAL_BOOT_COMMANDS`, `VERIFY_BOOT_PACKAGES`) or rare app-repo `.jeichat/verify-boot.json`.

## Security

- Bot token is a normal workspace bot from JeiChat Settings.
- `PLAN_HTTP_SECRET` required in production if `PLAN_HTTP_PORT` is exposed.
