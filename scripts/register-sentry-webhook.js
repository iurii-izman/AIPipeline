#!/usr/bin/env node
/**
 * Register Sentry project webhook (for WF-3). Requires SENTRY_DSN and SENTRY_AUTH_TOKEN, WEBHOOK_BASE_URL (e.g. from ngrok).
 * Usage: source scripts/load-env-from-keyring.sh && WEBHOOK_BASE_URL=https://your-ngrok.ngrok-free.dev node scripts/register-sentry-webhook.js
 * Get Auth Token: Sentry → Settings → Auth Tokens → Create New Token (project:write). Add to keyring: Server sentry.io, User aipipeline-auth, Password <token>.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const DSN = process.env.SENTRY_DSN;
const AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const BASE_URL = (process.env.WEBHOOK_BASE_URL || process.env.NGROK_URL || "").replace(/\/$/, "");
const apiHost = DSN && DSN.includes("de.sentry") ? "de.sentry.io" : "sentry.io";

function writeAudit(action, status, details = {}) {
  try {
    const repoRoot = path.resolve(__dirname, "..");
    const logDir = path.join(repoRoot, ".runtime-logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, "audit.log"),
      `${JSON.stringify({
        eventType: "audit",
        ts: new Date().toISOString(),
        action,
        status,
        actor: process.env.USER || process.env.USERNAME || "unknown",
        details,
      })}\n`,
      "utf8"
    );
  } catch (error) {
    void error;
  }
}

if (!DSN) {
  console.error("SENTRY_DSN not set. Load keyring: source scripts/load-env-from-keyring.sh");
  writeAudit("sentry_webhook_wf3.register", "failed", { reason: "missing_sentry_dsn" });
  process.exit(1);
}
if (!AUTH_TOKEN) {
  console.error("SENTRY_AUTH_TOKEN not set. Add to keyring (Server: sentry.io, User: aipipeline-auth) or set env. Get token: Sentry → Settings → Auth Tokens, scope project:write.");
  writeAudit("sentry_webhook_wf3.register", "failed", { reason: "missing_sentry_auth_token" });
  process.exit(1);
}
if (!BASE_URL || !BASE_URL.startsWith("https://")) {
  console.error("WEBHOOK_BASE_URL or NGROK_URL not set or not HTTPS. Start ngrok, then: export WEBHOOK_BASE_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | node -e \"const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); const t=(j.tunnels||[]).find(x=>x.public_url&&x.public_url.startsWith('https')); console.log(t?t.public_url:'');\")");
  writeAudit("sentry_webhook_wf3.register", "failed", { reason: "missing_or_invalid_webhook_base_url" });
  process.exit(1);
}

// Parse org and project from DSN: https://key@oORG.ingest.HOST/PROJECT
const match = DSN.match(/@o(\d+)\.ingest\.([^/]+)\/(\d+)/);
if (!match) {
  console.error("Could not parse org/project from SENTRY_DSN");
  writeAudit("sentry_webhook_wf3.register", "failed", { reason: "dsn_parse_error" });
  process.exit(1);
}
const [, orgId, host, projectId] = match;
const webhookUrl = `${BASE_URL}/webhook/wf3-sentry`;

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: apiHost,
        path: path,
        method,
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
          ...(data && { "Content-Length": Buffer.byteLength(data) }),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (ch) => (buf += ch));
        res.on("end", () => {
          try {
            const j = buf ? JSON.parse(buf) : {};
            if (res.statusCode >= 400) reject(new Error(`Sentry API ${res.statusCode}: ${buf.slice(0, 300)}`));
            else resolve(j);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const path = `/api/0/projects/${orgId}/${projectId}/hooks/`;
  const result = await request(path, "POST", {
    url: webhookUrl,
    events: ["event.alert", "event.created"],
  });
  console.log("Sentry webhook registered:", result.url);
  console.log("ID:", result.id);
  writeAudit("sentry_webhook_wf3.register", "success", {
    webhookUrl,
    hookId: result.id,
    orgId,
    projectId,
  });
}

main().catch((e) => {
  writeAudit("sentry_webhook_wf3.register", "failed", {
    reason: e && e.message ? String(e.message).slice(0, 240) : "unknown_error",
  });
  console.error(e.message || e);
  process.exit(1);
});
