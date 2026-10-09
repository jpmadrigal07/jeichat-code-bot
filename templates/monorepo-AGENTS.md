# Cloud agents (Cursor)

Copy this file to the **root of the app repo** linked on your JeiChat board (as `AGENTS.md`).

## Secrets

Infrastructure config (`DATABASE_URL`, auth keys, object storage, Redis, etc.) is injected as **environment variables** on Cursor Cloud Agents from **Cursor → Environment → Secrets**. Values are not in git.

- Use `.env.example` as a checklist of **names** only.
- Do **not** create, paste, or commit `.env` for secrets.

## Bootstrap (environment snapshot)

The Cursor Environment **install** script should run once per VM image:

```bash
bun install
# Optional, on a disposable test DB only:
# cd apps/api && bun run db:migrate
```

DB/auth tables (e.g. Better Auth `session`) must exist on the database pointed at by `DATABASE_URL` before sign-in works. Prefer a **test** database branch or `TEST_DATABASE_URL` if agents migrate freely.

## Dev stack

From repo root:

```bash
bun run dev
```

Health check (adjust if your API port differs):

```bash
curl -sf http://localhost:3002/health
```

Web app default: `http://localhost:3001` (set ports in your repo docs if different).

## Clean verify (cloud agents)

Verification should assume a **clean install**, not an already-running dev stack:

1. `bun install` at the repo root (lockfile committed).
2. Run **## Verify commands** from the JeiChat ticket (and any global boot the code bot lists in the verify prompt).
3. Only then exercise **Done when** in the browser and capture screenshots.

Do **not** mark PASS from UI proof alone if any required build step would fail on a fresh clone.

## Verification

- **Test login:** use **## Test account** in the JeiChat ticket description (not cloud secrets).
- **URLs to open:** **## Routes** in the ticket description.
- **Commands:** **## Verify commands** in the ticket (prefer targeted typecheck/tests).
- **## Verify scope:** `static-only` = no browser/dev server unless a command requires it; `browser` = exercise **Done when** in the browser MCP.

Example **## Verify commands** on a ticket:

```bash
bun install
cd apps/messages-api && bun run build
cd apps/web && bun run check-types
```

## Test data

Point `DATABASE_URL` at a DB that already has:

- The reviewer/test user from the ticket (or a known seed)
- `user.image` set when testing avatars/previews
- A workspace the test user can access (or allow creating one via `WORKSPACE_CREATOR_EMAILS`)

Document your seed command or Neon branch in the team runbook.
