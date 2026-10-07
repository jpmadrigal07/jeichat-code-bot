#!/usr/bin/env bash
# Paste into Cursor → Environment → Install (no secret values here).
set -euo pipefail

bun install

# Optional: materialize empty .env so tools that expect a file do not fail.
# Secrets still come from Cursor Environment injected env, not this file.
if [[ -f .env.example && ! -f .env ]]; then
  cp .env.example .env
fi

# Run only against TEST_DATABASE_URL / disposable DB — not shared production Neon.
# if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
#   export DATABASE_URL="$TEST_DATABASE_URL"
#   cd apps/api && bun run db:migrate
# fi
