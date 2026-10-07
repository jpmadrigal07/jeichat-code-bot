function trimOrigin(value, fallback) {
  const raw = value?.trim() || fallback;
  return raw.replace(/\/$/, "");
}

/** Dev stack URLs for verify prompts (configured on the code bot for the target app). */
export function verifyDevStack() {
  const web = trimOrigin(
    process.env.VERIFY_APP_WEB_ORIGIN ?? process.env.JEICHAT_WEB_ORIGIN,
    "http://localhost:3000",
  );
  const api = trimOrigin(
    process.env.VERIFY_APP_API_ORIGIN ?? process.env.JEICHAT_API_URL,
    "http://localhost:3001",
  );
  return { web, api, healthUrl: `${api}/health` };
}
