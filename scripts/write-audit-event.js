#!/usr/bin/env node
/**
 * Append audit event to .runtime-logs/audit.log as JSONL.
 *
 * Usage:
 *   node scripts/write-audit-event.js --action stack_control.start --status success --details '{"profile":"full"}'
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function safeParseJson(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : { value: String(raw) };
  } catch {
    return { value: String(raw) };
  }
}

function main() {
  const args = parseArgs(process.argv);
  const action = args.action || "unknown_action";
  const status = args.status || "success";
  const details = safeParseJson(args.details || "");

  const repoRoot = path.resolve(__dirname, "..");
  const logDir = path.join(repoRoot, ".runtime-logs");
  const logFile = path.join(logDir, "audit.log");
  fs.mkdirSync(logDir, { recursive: true });

  const payload = {
    eventType: "audit",
    ts: new Date().toISOString(),
    action,
    status,
    actor: process.env.USER || process.env.USERNAME || "unknown",
    branch: process.env.GIT_BRANCH || undefined,
    details,
  };

  fs.appendFileSync(logFile, `${JSON.stringify(payload)}\n`, "utf8");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
