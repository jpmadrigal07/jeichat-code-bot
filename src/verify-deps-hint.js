/** Clean-install discipline for verify (not warm-stack UI only). */
export function cleanVerifyDisciplineBullets() {
  return [
    "   - **Clean verify:** Treat verification as a **fresh clone** mindset — run `bun install` at the repo root, then **## Verify commands** from the ticket (and any **required global boot** from the bot env when listed above). All must exit **0** before browser screenshots or **PASS**.",
    "   - **Missing npm package:** If build or dev fails with `Cannot find module '…'` for something **imported in the PR diff**, install it in the **workspace that owns the import** (check which `package.json` is under the changed path): `cd apps/<app> && bun add <package>` (Nest DTO validation often needs `class-validator` and `class-transformer` together). Re-run `bun install` at the repo root if needed, then re-run build/boot and continue verification.",
    "   - **PASS vs packaging:** **Result: PASS** only when the **PR branch** already declares every runtime import in that workspace's `package.json` and lockfile. If you had to `bun add` because the PR omitted deps, finish verification when you can, then **Result: FAIL** with the exact `bun add` command the author must commit (do not treat cloud-only installs as merge-ready).",
  ];
}
