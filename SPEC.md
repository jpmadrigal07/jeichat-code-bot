# Code bot contract

## Scope

- **In scope:** ticket-thread planning chat, `draft` → ticket description, explicit `build` → PR.
- **Out of scope:** assignee auto-fix (`jeichat-fixer-bot`), bug label QA (`jeichat-bug-checker-bot`), workspace “Create bot” tokens used for customer automations.

## Commands (after `@<bot name>`)

| Command | Behavior |
|---------|----------|
| _(free text)_ | Planning turn: repo-grounded chat; **image attachments** in the thread are sent to Cursor when present |
| `draft` | Final planning prompt → PATCH ticket `description` → clear planning id |
| `build` | New `Agent.create`, `autoCreatePR: true`, prompt = ticket description |
| `status` | Planning id + description length |
| `help` | Usage |

## Session rules

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
```

`Base ref` is the git branch to branch **from**. `Branch` is the feature branch name for the PR — the **JeiChat ticket branch code** (same string as GitHub → copy on the ticket), e.g. `GEN-19-my-title-slug`, not `cursor/…` names.

`UI refs` should include verified repo anchors (paths, components, routes), not only external design links.

Human edits the description before `build`.

## Security

- Bot token is a normal workspace bot from JeiChat Settings.
- `PLAN_HTTP_SECRET` required in production if `PLAN_HTTP_PORT` is exposed.
