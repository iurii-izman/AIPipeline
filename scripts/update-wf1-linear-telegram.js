#!/usr/bin/env node
/**
 * Update WF-1 in n8n: Schedule (every 10 min) → Linear (Get Many issues) → IF (status In Review or Blocked) → Telegram Send.
 * Requires: N8N_API_KEY, LINEAR_API_KEY, TELEGRAM_CHAT_ID (from keyring). Run: source scripts/load-env-from-keyring.sh && node scripts/update-wf1-linear-telegram.js
 * After run: open n8n UI, open WF-1, assign credentials "AIPipeline Linear" and "AIPipeline Telegram" to the nodes, save, activate.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF1_ID = "YOE8DIxImk86Hogb";
const TELEGRAM_CRED_ID = "CumMgGtm8MpeMfxm";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

if (!N8N_API_KEY) {
  console.error("N8N_API_KEY not set. Run: source scripts/load-env-from-keyring.sh && node scripts/update-wf1-linear-telegram.js");
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
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 300)}`));
            } else {
              resolve(j);
            }
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

const workflow = {
  name: "WF-1: Linear → Telegram (AIPipeline)",
  nodes: [
    {
      id: "schedule-wf1",
      name: "Every 10 min",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: {
        rule: {
          interval: [{ field: "cronExpression", expression: "0 */10 * * *" }],
        },
      },
    },
    {
      id: "linear-get-issues",
      name: "Linear: Get issues",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [240, 0],
      parameters: {
        resource: "issue",
        operation: "getAll",
        returnAll: true,
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "if-in-review-blocked",
      name: "IF status In Review or Blocked",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [480, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              id: "cond-state",
              leftValue: "={{ $json.state?.name }}",
              rightValue: "In Review",
              operator: { type: "string", operation: "equals" },
            },
            {
              id: "cond-state-blocked",
              leftValue: "={{ $json.state?.name }}",
              rightValue: "Blocked",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "or",
        },
      },
    },
    {
      id: "telegram-send-wf1",
      name: "Telegram: notify",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [720, -80],
      parameters: {
        operation: "sendMessage",
        chatId: CHAT_ID || "YOUR_CHAT_ID",
        text: "=🔄 {{ $json.title }}\n→ {{ $json.state?.name || 'N/A' }} | Assignee: {{ $json.assignee?.name || '—' }}",
      },
      credentials: { telegramApi: { id: TELEGRAM_CRED_ID, name: "AIPipeline Telegram" } },
    },
    {
      id: "manual-wf1",
      name: "When clicking 'Test workflow'",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 200],
    },
    {
      id: "set-placeholder-wf1",
      name: "Placeholder",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [220, 200],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({
          info: "WF-1: Schedule → Linear Get issues → IF (In Review/Blocked) → Telegram. Assign credentials in UI.",
        }),
      },
    },
  ],
  connections: {
    "Every 10 min": {
      main: [[{ node: "Linear: Get issues", type: "main", index: 0 }]],
    },
    "Linear: Get issues": {
      main: [[{ node: "IF status In Review or Blocked", type: "main", index: 0 }]],
    },
    "IF status In Review or Blocked": {
      main: [
        [{ node: "Telegram: notify", type: "main", index: 0 }],
        [],
      ],
    },
    "When clicking 'Test workflow'": {
      main: [[{ node: "Placeholder", type: "main", index: 0 }]],
    },
  },
  settings: {},
};

async function main() {
  const existing = await request("GET", `/api/v1/workflows/${WF1_ID}`);
  await request("PUT", `/api/v1/workflows/${WF1_ID}`, workflow);
  console.log("WF-1 updated. Open n8n UI → WF-1, assign credentials 'AIPipeline Linear' and 'AIPipeline Telegram', then activate.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
