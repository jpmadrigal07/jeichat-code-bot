export function defaultBaseRef() {
  return process.env.CURSOR_REPO_REF?.trim() || "main";
}

export function sanitizeBaseRef(value) {
  const ref = String(value ?? "")
    .trim()
    .replace(/^origin\//i, "");
  if (!ref || ref.length > 120) return null;
  if (!/^[\w./-]+$/.test(ref)) return null;
  return ref;
}

/** e.g. `@Code base develop` or "branching from develop" in free text */
export function parseBaseRefFromMessage(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;

  const patterns = [
    /^base\s+(\S+)/i,
    /\bbase\s+ref\s*[:=]?\s*(\S+)/i,
    /\bbranch(?:ing)?\s+from\s+(\S+)/i,
    /\bbranch\s+out\s+from\s+(\S+)/i,
    /\buse\s+(\S+)\s+as\s+(?:the\s+)?base\b/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const ref = sanitizeBaseRef(match[1]);
      if (ref) return ref;
    }
  }
  return null;
}

export function parseBaseRefFromDescription(description) {
  const text = String(description ?? "");
  const match = text.match(
    /^##\s*Base ref\s*\n+([^\n#]+)/im,
  );
  if (!match?.[1]) return null;
  return sanitizeBaseRef(match[1].trim());
}

export async function resolveStartingRef(store, channelId, description) {
  const fromDescription = parseBaseRefFromDescription(description);
  if (fromDescription) return fromDescription;
  if (store?.getBaseRef) {
    const stored = await store.getBaseRef(channelId);
    if (stored) return stored;
  }
  return defaultBaseRef();
}
