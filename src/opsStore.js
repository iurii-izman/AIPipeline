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

module.exports = {
  appendAiTelemetryEvent,
  appendDlqEvent,
  findDlqEventById,
  getAiTelemetryStoreFile,
  getDlqStoreFile,
  markDlqEvent,
  readAiTelemetryEvents,
  readDlqEvents,
};
