const { randomUUID } = require("crypto");

const REDACT_KEYS = new Set([
  "authorization",
  "token",
  "apiKey",
  "api_key",
  "password",
  "secret",
  "dsn",
]);

function redact(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACT_KEYS.has(k)) out[k] = "[REDACTED]";
    else out[k] = redact(v);
  }
  return out;
}

function log(level, message, context = {}) {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    message,
    context: redact(context),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

function correlationIdFromRequest(req) {
  const fromHeader = req.headers && (req.headers["x-correlation-id"] || req.headers["x-request-id"]);
  return String(fromHeader || randomUUID());
}

module.exports = {
  log,
  correlationIdFromRequest,
};
