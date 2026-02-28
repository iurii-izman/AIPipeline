#!/usr/bin/env node
/**
 * Update WF-5 workflow in n8n: add Telegram Trigger → IF (/status) → HTTP Request → Telegram Send.
 * Requires: N8N_API_KEY, n8n running. Run: node scripts/update-wf5-status-workflow.js
 * After run: open n8n UI, open WF-5, assign Telegram credentials to Telegram Trigger and Telegram nodes, activate.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF5_ID = "41jAGQw9qAMs52dN";
// From inside n8n container use host.containers.internal to reach host
const APP_STATUS_URL =
  process.env.APP_STATUS_URL || "http://host.containers.internal:3000/status";

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
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(j)}`));
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
  name: "WF-5: Telegram /status (AIPipeline)",
  nodes: [
    {
      id: "tg-trigger",
      name: "Telegram Trigger",
      type: "n8n-nodes-base.telegramTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: {
        updates: ["message"],
      },
      webhookId: "wf5-telegram-webhook",
    },
    {
      id: "if-status",
      name: "If /status",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [240, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              id: "cond-status",
              leftValue: "={{ $json.message?.text }}",
              rightValue: "/status",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
      },
    },
    {
      id: "http-status",
      name: "GET /status",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [460, -100],
      parameters: {
        method: "GET",
        url: APP_STATUS_URL,
      },
    },
    {
      id: "telegram-send",
      name: "Telegram Send",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [680, -100],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        text: "=Pipeline status:\n{{ JSON.stringify($json, null, 2) }}",
      },
    },
    {
      id: "manual-trigger",
      name: "When clicking 'Test workflow'",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 300],
    },
    {
      id: "set-placeholder",
      name: "Set status message",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [220, 300],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({
          status: "ok",
          message:
            "Test run. In production: Telegram Trigger → IF /status → GET /status → Telegram Send.",
        }),
      },
    },
  ],
  connections: {
    "Telegram Trigger": {
      main: [[{ node: "If /status", type: "main", index: 0 }]],
    },
    "If /status": {
      main: [
        [{ node: "GET /status", type: "main", index: 0 }],
        [],
      ],
    },
    "GET /status": {
      main: [[{ node: "Telegram Send", type: "main", index: 0 }]],
    },
    "When clicking 'Test workflow'": {
      main: [[{ node: "Set status message", type: "main", index: 0 }]],
    },
  },
  settings: {},
};

async function main() {
  const updated = await request("PUT", `/api/v1/workflows/${WF5_ID}`, workflow);
  console.log("WF-5 updated. ID:", updated.id, "Name:", updated.name);
  console.log("Next: open n8n UI → WF-5 → assign Telegram credentials to 'Telegram Trigger' and 'Telegram Send' → Activate workflow.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
