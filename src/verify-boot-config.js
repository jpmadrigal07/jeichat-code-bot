import { fetchGithubRepoFileFromUrl } from "./github-file.js";

/** Optional override committed in the app repo (rare). */
export const VERIFY_BOOT_CONFIG_PATHS = [".jeichat/verify-boot.json"];

/**
 * @typedef {{ packages?: string[]; commands?: string[]; packageScript?: string; globalBoot?: boolean }} VerifyBootConfig
 */

/**
 * @param {string} text
 * @returns {VerifyBootConfig | null}
 */
export function parseVerifyBootConfig(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;

  const packages = Array.isArray(data.packages)
    ? data.packages.map((p) => String(p).trim()).filter(Boolean)
    : undefined;
  const commands = Array.isArray(data.commands)
    ? data.commands.map((c) => String(c).trim()).filter(Boolean)
    : undefined;
  const packageScript =
    typeof data.packageScript === "string" && data.packageScript.trim()
      ? data.packageScript.trim()
      : "build";
  const globalBoot =
    data.globalBoot === true ||
    data.globalBoot === 1 ||
    data.globalBoot === "true";

  if (!packages?.length && !commands?.length) return null;

  return { packages, commands, packageScript, globalBoot };
}

/**
 * @param {VerifyBootConfig} config
 */
export function commandsFromVerifyBootConfig(config) {
  if (config.commands?.length) return config.commands;

  const packages = config.packages ?? [];
  if (packages.length === 0) return [];

  const script = config.packageScript ?? "build";
  const cmds = ["bun install"];
  for (const pkg of packages) {
    cmds.push(`cd ${pkg} && bun install && bun run ${script}`);
  }
  return cmds;
}

/**
 * @param {string | null | undefined} repoUrl
 * @param {string | null | undefined} ref PR branch or sha
 */
export async function loadVerifyBootConfig(repoUrl, ref) {
  if (!repoUrl?.trim()) return null;

  const gitRef = ref?.trim();
  if (gitRef) for (const path of VERIFY_BOOT_CONFIG_PATHS) {
    try {
      const text = await fetchGithubRepoFileFromUrl(repoUrl, path, gitRef);
      if (!text) continue;
      const config = parseVerifyBootConfig(text);
      if (config) return { ...config, sourcePath: path };
    } catch (error) {
      console.warn(`verify boot config ${path} failed`, error);
    }
  }

  return null;
}
