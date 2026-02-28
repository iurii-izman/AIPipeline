#!/usr/bin/env node
/**
 * Ensure GitHub webhook for WF-2 PR events exists and points to /webhook/wf2-github-pr
 * Usage:
 *   source scripts/load-env-from-keyring.sh
 *   node scripts/configure-github-webhook-wf2.js
 *
 * Optional env:
 *   WEBHOOK_BASE_URL=https://.... (otherwise tries ngrok local API :4040)
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const owner = process.env.GITHUB_OWNER || "iurii-izman";
const repo = process.env.GITHUB_REPO || "AIPipeline";

if (!token) {
  console.error("GITHUB_PERSONAL_ACCESS_TOKEN is required");
  writeAudit("github_webhook_wf2.configure", "failed", { reason: "missing_github_token" });
  process.exit(1);
}

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

function reqHttps(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "AIPipeline-Codex",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          let json = {};
          try {
            json = out ? JSON.parse(out) : {};
          } catch {
            json = { raw: out };
          }
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${out.slice(0, 500)}`));
          } else {
            resolve(json);
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function getNgrokUrl() {
  return new Promise((resolve) => {
    http
      .get("http://127.0.0.1:4040/api/tunnels", (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(out);
            const t = (j.tunnels || []).find((x) => x.public_url && x.public_url.startsWith("https"));
            resolve(t ? t.public_url : "");
          } catch {
            resolve("");
          }
        });
      })
      .on("error", () => resolve(""));
  });
}

(async () => {
  let baseUrl = (process.env.WEBHOOK_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) baseUrl = (await getNgrokUrl()).replace(/\/$/, "");

  if (!baseUrl || !baseUrl.startsWith("https://")) {
    console.error("WEBHOOK_BASE_URL is required (or run ngrok and expose local :4040 API)");
    writeAudit("github_webhook_wf2.configure", "failed", { reason: "missing_or_invalid_webhook_base_url" });
    process.exit(1);
  }

  const hookUrl = `${baseUrl}/webhook/wf2-github-pr`;
  const hooks = await reqHttps("GET", `/repos/${owner}/${repo}/hooks`);
  const existing = hooks.find((h) => (h.config?.url || "").includes("/webhook/wf2-github-pr"));

  if (existing) {
    const updated = await reqHttps("PATCH", `/repos/${owner}/${repo}/hooks/${existing.id}`, {
      active: true,
      events: ["pull_request"],
      config: { url: hookUrl, content_type: "json", insecure_ssl: "0" },
    });
    console.log(`updated hook ${updated.id}: ${hookUrl}`);
    writeAudit("github_webhook_wf2.configure", "success", {
      operation: "update",
      hookId: updated.id,
      owner,
      repo,
      hookUrl,
    });
  } else {
    const created = await reqHttps("POST", `/repos/${owner}/${repo}/hooks`, {
      active: true,
      events: ["pull_request"],
      config: { url: hookUrl, content_type: "json", insecure_ssl: "0" },
    });
    console.log(`created hook ${created.id}: ${hookUrl}`);
    writeAudit("github_webhook_wf2.configure", "success", {
      operation: "create",
      hookId: created.id,
      owner,
      repo,
      hookUrl,
    });
  }
})().catch((e) => {
  writeAudit("github_webhook_wf2.configure", "failed", {
    reason: e && e.message ? String(e.message).slice(0, 240) : "unknown_error",
    owner,
    repo,
  });
  console.error(e.message || e);
  process.exit(1);
});
