import { commandsFromVerifyBootConfig } from "./verify-boot-config.js";
import { cleanVerifyDisciplineBullets } from "./verify-deps-hint.js";

function envFlag(name) {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Comma-separated workspace paths (bot-wide fallback when repo has no config file). */
export function verifyBootPackagePaths() {
  const raw = process.env.VERIFY_BOOT_PACKAGES?.trim();
  if (!raw) return [];
  return raw.split(",").map((p) => p.trim()).filter(Boolean);
}

/**
 * @param {import("./verify-boot-config.js").VerifyBootConfig & { sourcePath?: string } | null | undefined} bootConfig
 */
export function globalBootCommands(bootConfig = null) {
  if (bootConfig) {
    const fromRepo = commandsFromVerifyBootConfig(bootConfig);
    if (fromRepo.length > 0) return fromRepo;
  }

  const raw = process.env.VERIFY_GLOBAL_BOOT_COMMANDS?.trim();
  if (raw) {
    return raw
      .split(/\||\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const packages = verifyBootPackagePaths();
  if (packages.length === 0) return [];

  const cmds = ["bun install"];
  for (const pkg of packages) {
    cmds.push(`cd ${pkg} && bun install && bun run build`);
  }
  return cmds;
}

/**
 * @param {import("./verify-boot-config.js").VerifyBootConfig & { sourcePath?: string } | null | undefined} bootConfig
 */
export function globalBootRequired(bootConfig = null) {
  if (envFlag("VERIFY_GLOBAL_BOOT_OFF")) return false;

  const commands = globalBootCommands(bootConfig);
  if (commands.length === 0) return false;

  if (bootConfig?.sourcePath) {
    if (bootConfig.globalBoot === false) return false;
    return true;
  }

  if (envFlag("VERIFY_GLOBAL_BOOT")) return true;
  if (process.env.VERIFY_GLOBAL_BOOT_COMMANDS?.trim()) return true;
  return verifyBootPackagePaths().length > 0;
}

/**
 * @param {import("./verify-boot-config.js").VerifyBootConfig & { sourcePath?: string } | null | undefined} bootConfig
 */
export function cleanInstallVerifyBullets(bootConfig = null) {
  const commands = globalBootCommands(bootConfig);
  const mandatory = globalBootRequired(bootConfig);
  const sourceLabel = bootConfig?.sourcePath
    ? `repo file \`${bootConfig.sourcePath}\``
    : process.env.VERIFY_GLOBAL_BOOT_COMMANDS?.trim()
      ? "bot env `VERIFY_GLOBAL_BOOT_COMMANDS`"
      : verifyBootPackagePaths().length > 0
        ? "bot env `VERIFY_BOOT_PACKAGES`"
        : null;

  if (mandatory && commands.length > 0) {
    const script = commands.join("\n");
    const fromLine = sourceLabel
      ? `   - Source: ${sourceLabel} — same checklist on every verify for this repository.`
      : "";
    return [
      "   - **Required global boot (every verify):** Run **all** commands below from the repo root, in order. **Every command must exit 0** before browser work or **PASS**. If any fails, **FAIL** — do not rely on a warm dev server.",
      fromLine,
      `   - Commands:\n\`\`\`\n${script}\n\`\`\``,
      "   - New imports in the PR must have matching `package.json` + lockfile entries in the touched workspace(s).",
      "   - Ticket **## Verify commands** run **after** this global boot.",
      ...cleanVerifyDisciplineBullets(),
    ].filter(Boolean);
  }

  return [
    "   - **Clean install / boot:** Do not **PASS** from browser checks alone on an already-running stack. If the PR adds imports, every new runtime dependency must appear in that workspace's `package.json` and lockfile on the branch (you may `bun add` in cloud only to unblock build — see **Missing npm package** below).",
    "   - After `bun install`, run **build or start** for services you changed (see **## Verify commands**).",
    ...cleanVerifyDisciplineBullets(),
  ];
}
