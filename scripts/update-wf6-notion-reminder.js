#!/usr/bin/env node
/**
 * Update WF-6: Monday 10:00 -> check Notion recent updates (7 days) -> send reminder only if updates exist.
 * Requires: N8N_API_KEY
 * Optional in n8n env: NOTION_TOKEN
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF6_ID = "8GuzGqoYUMeVlcOS";

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
      parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 10 * * 1" }] } },
    },
    {
      id: "if-notion-token",
      name: "If NOTION_TOKEN set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [220, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $env.NOTION_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "notion-search-recent",
      name: "Notion: search recent pages",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [440, -120],
      parameters: {
        method: "POST",
        url: "https://api.notion.com/v1/search",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.NOTION_TOKEN }}" },
            { name: "Notion-Version", value: "2025-09-03" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { page_size: 20, sort: { direction: 'descending', timestamp: 'last_edited_time' }, filter: { value: 'page', property: 'object' } } }}",
        options: {},
      },
    },
    {
      id: "build-reminder",
      name: "Build reminder message",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [660, -120],
      parameters: {
        jsCode: `const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;\nconst rows = ($json.results || []).filter(r => {\n  const t = Date.parse(r.last_edited_time || '');\n  return Number.isFinite(t) && t >= weekAgo;\n});\nconst top = rows.slice(0, 5);\nconst titles = top.map(r => {\n  const p = r.properties || {};\n  for (const k of Object.keys(p)) {\n    if (p[k]?.type === 'title') {\n      const tt = (p[k].title || []).map(x => x.plain_text).join('');\n      return tt || '(untitled)';\n    }\n  }\n  return '(untitled)';\n});\nconst list = titles.map((t, i) => (i + 1) + '. ' + t).join('\\n');\nconst text = top.length\n  ? '📚 Updated Notion pages this week (' + top.length + ')\\n' + list + '\\n\\nResync NotebookLM sources.'\n  : '';\nreturn [{ json: { hasUpdates: top.length > 0, text } }];`,
      },
    },
    {
      id: "if-has-updates",
      name: "If updates exist",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [880, -120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.hasUpdates }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
      },
    },
    {
      id: "telegram-wf6",
      name: "Telegram: send reminder",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1100, -120],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
    {
      id: "set-no-notion-token",
      name: "Set no Notion token",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [440, 120],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "WF-6 skipped: NOTION_TOKEN is not configured in n8n env." }),
      },
    },
  ],
  connections: {
    "Every Monday 10:00": { main: [[{ node: "If NOTION_TOKEN set", type: "main", index: 0 }]] },
    "If NOTION_TOKEN set": { main: [[{ node: "Notion: search recent pages", type: "main", index: 0 }], [{ node: "Set no Notion token", type: "main", index: 0 }]] },
    "Notion: search recent pages": { main: [[{ node: "Build reminder message", type: "main", index: 0 }]] },
    "Build reminder message": { main: [[{ node: "If updates exist", type: "main", index: 0 }]] },
    "If updates exist": { main: [[{ node: "Telegram: send reminder", type: "main", index: 0 }], []] },
  },
  settings: {},
};

async function main() {
  await request("PUT", `/api/v1/workflows/${WF6_ID}`, workflow);
  console.log("WF-6 updated. Reminder now sends only when Notion pages were edited in the last 7 days.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
