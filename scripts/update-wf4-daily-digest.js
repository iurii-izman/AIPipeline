#!/usr/bin/env node
/**
 * Update WF-4: Schedule 09:00 будни → Linear Get issues → Code (aggregate digest) → Telegram Send.
 * Requires: N8N_API_KEY, TELEGRAM_CHAT_ID. Run: source scripts/load-env-from-keyring.sh && node scripts/update-wf4-daily-digest.js
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF4_ID = "We206nVkSkQI2fEh";
const LINEAR_CRED_ID = "SPM4RCmtiiJxQxSv";
const TELEGRAM_CRED_ID = "CumMgGtm8MpeMfxm";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

if (!N8N_API_KEY) {
  console.error("N8N_API_KEY not set.");
  process.exit(1);
}

function request(method, path, body) {
  const u = new URL(path, N8N_URL);
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method,
        headers: {
          "X-N8N-API-KEY": N8N_API_KEY,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (ch) => (buf += ch));
        res.on("end", () => {
          try {
            const j = buf ? JSON.parse(buf) : {};
            if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 400)}`));
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

const codeJs = `const items = $input.all();
const byState = {};
for (const i of items) {
  const s = (i.json.state && i.json.state.name) ? i.json.state.name : 'Other';
  byState[s] = (byState[s] || 0) + 1;
}
const lines = Object.entries(byState).map(([k, v]) => k + ': ' + v);
const text = '📋 Daily digest\\n' + (lines.length ? lines.join('\\n') : 'No issues');
return [{ json: { text } }];`;

const workflow = {
  name: "WF-4: Daily Standup Digest (AIPipeline)",
  nodes: [
    {
      id: "schedule-wf4",
      name: "Every weekday 09:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: {
        rule: { interval: [{ field: "cronExpression", expression: "0 9 * * 1-5" }] },
      },
    },
    {
      id: "linear-wf4",
      name: "Linear: Get issues",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [240, 0],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { id: LINEAR_CRED_ID, name: "AIPipeline Linear" } },
    },
    {
      id: "code-digest",
      name: "Build digest",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [480, 0],
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: codeJs,
      },
    },
    {
      id: "telegram-wf4",
      name: "Telegram: send digest",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [720, 0],
      parameters: {
        operation: "sendMessage",
        chatId: CHAT_ID || "YOUR_CHAT_ID",
        text: "={{ $json.text }}",
      },
      credentials: { telegramApi: { id: TELEGRAM_CRED_ID, name: "AIPipeline Telegram" } },
    },
  ],
  connections: {
    "Every weekday 09:00": { main: [[{ node: "Linear: Get issues", type: "main", index: 0 }]] },
    "Linear: Get issues": { main: [[{ node: "Build digest", type: "main", index: 0 }]] },
    "Build digest": { main: [[{ node: "Telegram: send digest", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
  await request("PUT", `/api/v1/workflows/${WF4_ID}`, workflow);
  console.log("WF-4 updated. In n8n UI: check credentials, set Chat ID if needed, activate.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
