#!/usr/bin/env node
/**
 * Create n8n credentials from environment (Linear, Telegram, Notion, GitHub).
 * Run after loading keyring: source scripts/load-env-from-keyring.sh && node scripts/sync-n8n-credentials-from-keyring.js
 * Credentials are created in n8n personal space. Running again creates duplicates.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error("N8N_API_KEY not set. Run: source scripts/load-env-from-keyring.sh && node scripts/sync-n8n-credentials-from-keyring.js");
  process.exit(1);
}

function postCredential(name, type, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name, type, data });
    const u = new URL(N8N_URL);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: "/api/v1/credentials",
        method: "POST",
        headers: {
          "X-N8N-API-KEY": N8N_API_KEY,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (ch) => (buf += ch));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, name });
          } else {
            resolve({ ok: false, name, code: res.statusCode, body: buf.slice(0, 200) });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const results = [];

  if (process.env.LINEAR_API_KEY) {
    results.push(
      postCredential("AIPipeline Linear", "linearApi", {
        apiKey: process.env.LINEAR_API_KEY,
      })
    );
  } else {
    console.warn("LINEAR_API_KEY not set, skip Linear.");
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    results.push(
      postCredential("AIPipeline Telegram", "telegramApi", {
        accessToken: process.env.TELEGRAM_BOT_TOKEN,
      })
    );
  } else {
    console.warn("TELEGRAM_BOT_TOKEN not set, skip Telegram.");
  }

  if (process.env.NOTION_TOKEN) {
    results.push(
      postCredential("AIPipeline Notion", "notionApi", {
        apiKey: process.env.NOTION_TOKEN,
      })
    );
  } else {
    console.warn("NOTION_TOKEN not set, skip Notion.");
  }

  if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    results.push(
      postCredential("AIPipeline GitHub", "githubApi", {
        accessToken: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
      })
    );
  } else {
    console.warn("GITHUB_PERSONAL_ACCESS_TOKEN not set, skip GitHub.");
  }

  const settled = await Promise.all(results);
  let created = 0;
  for (const r of settled) {
    if (r.ok) {
      console.log("Created:", r.name);
      created++;
    } else {
      console.error(r.name, "HTTP", r.code, r.body || "");
    }
  }
  console.log("Done. Created", created, "credential(s). In n8n UI: Settings → Credentials; bind to workflow nodes.");
  console.log("Note: running again creates duplicates.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
