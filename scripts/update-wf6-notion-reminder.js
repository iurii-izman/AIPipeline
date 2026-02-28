#!/usr/bin/env node
/**
 * Update WF-6: Schedule (Mon 10:00) → Set reminder → Telegram Send.
 * Optional in UI: add Notion search node before Set to check for updated pages.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF6_ID = "8GuzGqoYUMeVlcOS";
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
  name: "WF-6: Notion → NotebookLM reminder (AIPipeline)",
  nodes: [
    {
      id: "schedule-wf6",
      name: "Every Monday 10:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: {
        rule: { interval: [{ field: "cronExpression", expression: "0 10 * * 1" }] },
      },
    },
    {
      id: "set-reminder",
      name: "Set reminder message",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [240, 0],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({
          message: "📚 Monday: check Notion for updated specs and resync NotebookLM sources. See docs/n8n-workflows/README.md.",
        }),
      },
    },
    {
      id: "telegram-wf6",
      name: "Telegram: send reminder",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [480, 0],
      parameters: {
        operation: "sendMessage",
        chatId: CHAT_ID || "YOUR_CHAT_ID",
        text: "={{ $json.message }}",
      },
      credentials: { telegramApi: { id: TELEGRAM_CRED_ID, name: "AIPipeline Telegram" } },
    },
  ],
  connections: {
    "Every Monday 10:00": { main: [[{ node: "Set reminder message", type: "main", index: 0 }]] },
    "Set reminder message": { main: [[{ node: "Telegram: send reminder", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
  await request("PUT", `/api/v1/workflows/${WF6_ID}`, workflow);
  console.log("WF-6 updated. In n8n: set Telegram credential if needed, activate. Optional: add Notion search node in UI.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
