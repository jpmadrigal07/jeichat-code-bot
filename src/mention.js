export function mentionNeedles(botName) {
  const needles = [];
  const name = String(botName ?? "").trim();
  if (name) needles.push(`@${name.toLowerCase()}`);
  const first = name.split(/\s+/).filter(Boolean)[0];
  if (first && first.length >= 2) {
    needles.push(`@${first.toLowerCase()}`);
  }
  return [...new Set(needles)].sort((a, b) => b.length - a.length);
}

function hasMentionToken(text, needle) {
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(needle, from);
    if (index === -1) return false;
    const after = text[index + needle.length];
    if (!after || /[\s.,!?;:)'"]/.test(after)) return true;
    from = index + 1;
  }
  return false;
}

export function isBotMentioned(content, botName) {
  const text = String(content ?? "").toLowerCase();
  return mentionNeedles(botName).some((needle) => hasMentionToken(text, needle));
}

export function stripBotMentions(content, botName) {
  let text = String(content ?? "");
  for (const needle of mentionNeedles(botName)) {
    const pattern = new RegExp(
      `${escapeRegExp(needle)}(?=$|[\\s.,!?;:)'"])`,
      "gi",
    );
    text = text.replace(pattern, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
