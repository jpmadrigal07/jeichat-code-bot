export function parseSpecSection(description, heading) {
  const text = String(description ?? "");
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startMatch = text.match(
    new RegExp(`^##\\s*${escaped}\\s*\\r?\\n`, "im"),
  );
  if (!startMatch || startMatch.index == null) return "";

  const bodyStart = startMatch.index + startMatch[0].length;
  const rest = text.slice(bodyStart);
  const nextHeading = rest.search(/^##\s/m);
  const body = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  return body.trim();
}

/** @returns {'browser' | 'static-only'} */
export function parseVerifyScope(description) {
  const body = parseSpecSection(description, "Verify scope").toLowerCase();
  if (!body) return "browser";
  if (
    /static-only|static only|no browser|api-only|api only|no ui|skip browser/.test(
      body,
    )
  ) {
    return "static-only";
  }
  return "browser";
}

/** Paths and absolute URLs from ## Routes (one per line). */
export function parseRoutesFromSpec(description) {
  const body = parseSpecSection(description, "Routes");
  if (!body || /^n\/a$/i.test(body.trim())) return [];

  const routes = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.replace(/^[-*]\s*/, "").trim();
    if (!trimmed || /^n\/a$/i.test(trimmed)) continue;
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    ) {
      routes.push(trimmed);
    }
  }
  return routes;
}

export function parseVerifyCommands(description) {
  const body = parseSpecSection(description, "Verify commands");
  if (!body || /^n\/a$/i.test(body.trim())) return null;
  return body;
}

/**
 * URLs agents should open first (## Routes), else ticket page.
 * @param {string | null | undefined} description
 * @param {string | null | undefined} ticketUrl
 */
export function resolveVerifyBrowseUrls(description, ticketUrl) {
  const routes = parseRoutesFromSpec(description);
  if (routes.length > 0) return routes;
  const ticket = ticketUrl?.trim();
  return ticket ? [ticket] : [];
}
