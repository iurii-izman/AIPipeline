const fs = require("node:fs");
const path = require("node:path");

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getDlqStoreFile() {
  return process.env.DLQ_STORE_FILE || path.resolve(process.cwd(), ".runtime-logs/dlq-events.jsonl");
}

function getAiTelemetryStoreFile() {
  return process.env.AI_TELEMETRY_STORE_FILE || path.resolve(process.cwd(), ".runtime-logs/ai-online-telemetry.jsonl");
}

function getIdempotencyStoreFile() {
  return process.env.IDEMPOTENCY_STORE_FILE || path.resolve(process.cwd(), ".runtime-logs/idempotency-results.jsonl");
}

function appendJsonLine(filePath, payload) {
  ensureParentDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((row) => row && typeof row === "object");
}

function rewriteJsonLines(filePath, records) {
  ensureParentDir(filePath);
  const next = `${records.map((r) => JSON.stringify(r)).join("\n")}\n`;
  fs.writeFileSync(filePath, next, "utf8");
}

function appendDlqEvent(event) {
  const filePath = getDlqStoreFile();
  appendJsonLine(filePath, event);
  return filePath;
}

function markDlqEvent(id, patch) {
  const filePath = getDlqStoreFile();
  const rows = readJsonLines(filePath);
  let found = false;
  const nextRows = rows.map((row) => {
    if (String(row.id || "") !== String(id)) return row;
    found = true;
    return {
      ...row,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!found) {
    return { found: false, filePath };
  }

  rewriteJsonLines(filePath, nextRows);
  return { found: true, filePath };
}

function readAiTelemetryEvents() {
  return readJsonLines(getAiTelemetryStoreFile());
}

function appendAiTelemetryEvent(event) {
  const filePath = getAiTelemetryStoreFile();
  appendJsonLine(filePath, event);
  return filePath;
}

function readDlqEvents() {
  return readJsonLines(getDlqStoreFile());
}

function findDlqEventById(id) {
  const rows = readDlqEvents();
  return rows.find((row) => String(row.id || "") === String(id)) || null;
}

function findIdempotencyResult(scope, key) {
  const scopeSafe = String(scope || "").trim();
  const keySafe = String(key || "").trim();
  if (!scopeSafe || !keySafe) return null;
  const rows = readJsonLines(getIdempotencyStoreFile());
  const now = Date.now();
  const matches = rows.filter((row) => {
    const rowScope = String(row.scope || "");
    const rowKey = String(row.key || "");
    const expiresAt = row.expiresAt ? Date.parse(String(row.expiresAt)) : Number.NaN;
    const expired = Number.isFinite(expiresAt) && expiresAt < now;
    return !expired && rowScope === scopeSafe && rowKey === keySafe;
  });
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

function saveIdempotencyResult(scope, key, result, ttlSeconds = 86_400) {
  const scopeSafe = String(scope || "").trim();
  const keySafe = String(key || "").trim();
  if (!scopeSafe || !keySafe) return null;
  const now = new Date();
  const ttl = Number.isFinite(Number(ttlSeconds)) ? Math.max(1, Number(ttlSeconds)) : 86_400;
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const payload = {
    scope: scopeSafe,
    key: keySafe,
    result,
    createdAt: now.toISOString(),
    expiresAt,
  };
  const filePath = getIdempotencyStoreFile();
  appendJsonLine(filePath, payload);
  return payload;
}

module.exports = {
  appendAiTelemetryEvent,
  appendDlqEvent,
  findDlqEventById,
  findIdempotencyResult,
  getAiTelemetryStoreFile,
  getDlqStoreFile,
  getIdempotencyStoreFile,
  markDlqEvent,
  readAiTelemetryEvents,
  readDlqEvents,
  saveIdempotencyResult,
};
