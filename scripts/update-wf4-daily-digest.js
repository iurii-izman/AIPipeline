#!/usr/bin/env node
/**
 * Update WF-4: weekday 09:00 -> Linear digest -> Telegram + optional Notion Sprint Log page create.
 *
 * Optional env in n8n container:
 *   NOTION_TOKEN
 *   NOTION_SPRINT_LOG_DATABASE_ID
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF4_ID = "We206nVkSkQI2fEh";
const DLQ_PARK_URL = process.env.DLQ_PARK_URL || "http://localhost:5678/webhook/wf-dlq-park";

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
  name: "WF-4: Daily Standup Digest (AIPipeline)",
  nodes: [
    {
      id: "schedule-wf4",
      name: "Every weekday 09:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 9 * * 1-5" }] } },
    },
    {
      id: "linear-wf4",
      name: "Linear: Get issues",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [220, 0],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "digest-wf4",
      name: "Build digest",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, 0],
      parameters: {
        jsCode: `const items = $input.all().map(i => i.json);\nconst byState = {};\nfor (const i of items) {\n  const s = i.state?.name || 'Other';\n  byState[s] = (byState[s] || 0) + 1;\n}\nconst today = new Date().toISOString().slice(0, 10);\nconst lines = Object.entries(byState).map(([k, v]) => '• ' + k + ': ' + v);\nconst text = '📋 *Daily digest* (' + today + ')\\n' + (lines.join('\\n') || 'No issues');\nreturn [{ json: { text, date: today, lines: lines.join('\\n') || 'No issues' } }];`,
      },
    },
    {
      id: "telegram-wf4",
      name: "Telegram: send digest",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [660, -80],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
        additionalFields: { parse_mode: "Markdown" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
    {
      id: "assess-telegram-wf4",
      name: "Assess digest delivery",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [880, -80],
      parameters: {
        jsCode: `const err = $json.error || null;
if (!err) return [{ json: { telegramFailed: false } }];
const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);
const body = err.responseBody ?? err.body ?? err.data ?? '';
const detail = (typeof err.message === 'string' && err.message)
  || (typeof err.description === 'string' && err.description)
  || (typeof body === 'string' ? body : JSON.stringify(body))
  || JSON.stringify(err);
const msg = String(detail).slice(0, 320);
const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);
return [{ json: { telegramFailed: true, rateLimited, reason: msg } }];`,
      },
    },
    {
      id: "if-telegram-wf4-failed",
      name: "If digest delivery failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1100, -80],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.telegramFailed }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "dlq-wf4-telegram-fail",
      name: "DLQ: park WF-4 Telegram fail",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1320, -80],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-4', failureType: 'telegram_send_failed', reason: $('Assess digest delivery').first().json.reason || 'unknown error', rateLimited: $('Assess digest delivery').first().json.rateLimited || false, context: $('Build digest').first().json } }}",
        options: {},
      },
    },
    {
      id: "if-notion-config",
      name: "If Notion Sprint Log configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [660, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.NOTION_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $env.NOTION_SPRINT_LOG_DATABASE_ID || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "notion-create-log",
      name: "Notion: create Sprint Log page",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [880, 120],
      parameters: {
        method: "POST",
        url: "https://api.notion.com/v1/pages",
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
        jsonBody: "={{ { parent: { database_id: $env.NOTION_SPRINT_LOG_DATABASE_ID }, properties: { title: { title: [ { type: 'text', text: { content: 'Daily Digest ' + $('Build digest').first().json.date } } ] } }, children: [ { object: 'block', type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content: $('Build digest').first().json.lines } } ] } } ] } }}",
        options: {},
      },
    },
    {
      id: "assess-notion-write",
      name: "Assess Notion write",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1100, 120],
      parameters: {
        jsCode: `const err = $json.error || null;
if (!err) return [{ json: { notionFailed: false } }];
const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);
const body = err.responseBody ?? err.body ?? err.data ?? '';
const detail = (typeof err.message === 'string' && err.message)
  || (typeof err.description === 'string' && err.description)
  || (typeof body === 'string' ? body : JSON.stringify(body))
  || JSON.stringify(err);
const msg = String(detail).slice(0, 320);
const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);
return [{ json: { notionFailed: true, rateLimited, reason: msg } }];`,
      },
    },
    {
      id: "if-notion-write-failed",
      name: "If Notion write failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1320, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.notionFailed }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "set-notion-write-failed",
      name: "Set Notion write failed",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1540, 40],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value:
                "=⚠️ *WF-4*: digest sent to Telegram, but Notion Sprint Log write failed{{ $('Assess Notion write').first().json.rateLimited ? ' (rate-limited)' : '' }}.\\nReason: {{ $('Assess Notion write').first().json.reason || 'unknown error' }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "dlq-wf4-notion-fail",
      name: "DLQ: park WF-4 Notion fail",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1540, 200],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-4', failureType: 'notion_write_failed', reason: $('Assess Notion write').first().json.reason || 'unknown error', rateLimited: $('Assess Notion write').first().json.rateLimited || false, replayTarget: 'https://api.notion.com/v1/pages', replayPayload: { date: $('Build digest').first().json.date, lines: $('Build digest').first().json.lines }, context: $('Build digest').first().json } }}",
        options: {},
      },
    },
    {
      id: "telegram-notion-fail",
      name: "Telegram: notion fail alert",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1760, 40],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
        additionalFields: { parse_mode: "Markdown" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
  ],
  connections: {
    "Every weekday 09:00": { main: [[{ node: "Linear: Get issues", type: "main", index: 0 }]] },
    "Linear: Get issues": { main: [[{ node: "Build digest", type: "main", index: 0 }]] },
    "Build digest": {
      main: [
        [{ node: "Telegram: send digest", type: "main", index: 0 }],
        [{ node: "If Notion Sprint Log configured", type: "main", index: 0 }],
      ],
    },
    "Telegram: send digest": { main: [[{ node: "Assess digest delivery", type: "main", index: 0 }]] },
    "Assess digest delivery": { main: [[{ node: "If digest delivery failed", type: "main", index: 0 }]] },
    "If digest delivery failed": { main: [[{ node: "DLQ: park WF-4 Telegram fail", type: "main", index: 0 }], []] },
    "If Notion Sprint Log configured": { main: [[{ node: "Notion: create Sprint Log page", type: "main", index: 0 }], []] },
    "Notion: create Sprint Log page": { main: [[{ node: "Assess Notion write", type: "main", index: 0 }]] },
    "Assess Notion write": { main: [[{ node: "If Notion write failed", type: "main", index: 0 }]] },
    "If Notion write failed": {
      main: [
        [{ node: "Set Notion write failed", type: "main", index: 0 }, { node: "DLQ: park WF-4 Notion fail", type: "main", index: 0 }],
        [],
      ],
    },
    "Set Notion write failed": { main: [[{ node: "Telegram: notion fail alert", type: "main", index: 0 }]] },
  },
  settings: {},
};

function applyResiliencePolicy(definition) {
  const externalTypes = new Set(["n8n-nodes-base.httpRequest", "n8n-nodes-base.linear", "n8n-nodes-base.telegram"]);
  for (const node of definition.nodes) {
    if (!externalTypes.has(node.type)) continue;
    node.retryOnFail = true;
    node.maxTries = 4;
    node.waitBetweenTries = 2000;
    node.continueOnFail = true;
    node.alwaysOutputData = true;
  }
}

async function main() {
  applyResiliencePolicy(workflow);
  await request("PUT", `/api/v1/workflows/${WF4_ID}`, workflow);
  console.log("WF-4 updated. Optional Notion write is enabled when NOTION_TOKEN + NOTION_SPRINT_LOG_DATABASE_ID are present in n8n env.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
