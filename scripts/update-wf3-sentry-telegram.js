#!/usr/bin/env node
/**
 * Update WF-3: Webhook (Sentry) → IF (severity) → Linear create issue + Telegram.
 * After run: activate workflow, copy Production Webhook URL from n8n (WF-3 Webhook node), add it in Sentry → Alerts → Webhook URL.
 * Linear "Create issue" node: set Team in n8n UI (required).
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF3_ID = "95voTtHeQwJ7E3m5";
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

const workflow = {
  name: "WF-3: Sentry Alert → Telegram + Linear (AIPipeline)",
  nodes: [
    {
      id: "webhook-sentry",
      name: "Sentry Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: "wf3-sentry",
      parameters: {
        path: "wf3-sentry",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {},
      },
    },
    {
      id: "if-severity",
      name: "IF error or fatal",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [260, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              id: "c1",
              leftValue: "={{ $json.body?.event?.level || $json.event?.level || '' }}",
              rightValue: "error",
              operator: { type: "string", operation: "equals" },
            },
            {
              id: "c2",
              leftValue: "={{ $json.body?.event?.level || $json.event?.level || '' }}",
              rightValue: "fatal",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "or",
        },
      },
    },
    {
      id: "linear-create",
      name: "Linear: Create issue",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [500, -100],
      parameters: {
        resource: "issue",
        operation: "create",
        title: "={{ ($json.body?.event || $json.event || {}).title || ($json.body?.message || $json.message) || 'Sentry alert' }}",
        description: "=Sentry: {{ JSON.stringify($json.body || $json, null, 2).slice(0, 2000) }}",
        teamId: { __rl: true, value: "", mode: "list" },
      },
      credentials: { linearApi: { id: LINEAR_CRED_ID, name: "AIPipeline Linear" } },
    },
    {
      id: "telegram-wf3",
      name: "Telegram: notify",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [740, -100],
      parameters: {
        operation: "sendMessage",
        chatId: CHAT_ID || "YOUR_CHAT_ID",
        text: "=🚨 Sentry: {{ ($json.body?.event || $json.event || {}).title || $json.body?.message || $json.message || 'Alert' }}\nLevel: {{ $json.body?.event?.level || $json.event?.level || 'n/a' }}",
      },
      credentials: { telegramApi: { id: TELEGRAM_CRED_ID, name: "AIPipeline Telegram" } },
    },
    {
      id: "manual-wf3",
      name: "When clicking 'Test workflow'",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 220],
    },
    {
      id: "placeholder-wf3",
      name: "Placeholder",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [220, 220],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({
          info: "WF-3: Activate workflow, copy Webhook Production URL from Sentry Webhook node, add in Sentry → Alerts → Webhook. Set Team in Linear Create issue node.",
        }),
      },
    },
  ],
  connections: {
    "Sentry Webhook": { main: [[{ node: "IF error or fatal", type: "main", index: 0 }]] },
    "IF error or fatal": {
      main: [
        [{ node: "Linear: Create issue", type: "main", index: 0 }],
        [],
      ],
    },
    "Linear: Create issue": { main: [[{ node: "Telegram: notify", type: "main", index: 0 }]] },
    "When clicking 'Test workflow'": { main: [[{ node: "Placeholder", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
  await request("PUT", `/api/v1/workflows/${WF3_ID}`, workflow);
  console.log("WF-3 updated. Next: 1) In n8n open WF-3, set Team in 'Linear: Create issue' node. 2) Activate workflow. 3) Copy Webhook Production URL, add in Sentry Alerts.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
