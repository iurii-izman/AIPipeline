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
      id: "prepare-telegram-wf1",
      name: "Prepare Telegram payload",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [720, -80],
      parameters: {
        jsCode: `const issue = $json || {};\nlet projects = [];\ntry {\n  const parsed = JSON.parse(String($env.PROJECTS_CONFIG || '{\"projects\":[]}'));\n  projects = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.projects) ? parsed.projects : []);\n} catch {\n  projects = [];\n}\nconst toKey = (v) => String(v || '').trim().toLowerCase();\nconst byId = new Map(projects.map((p) => [toKey(p.linearProjectId), p]).filter(([k]) => k));\nconst byKey = new Map(projects.map((p) => [toKey(p.key), p]).filter(([k]) => k));\nconst projectId = toKey(issue.project?.id);\nconst projectKey = toKey(issue.project?.key || issue.project?.name);\nconst match = byId.get(projectId) || byKey.get(projectKey) || null;\nconst projectLabel = String(match?.label || issue.project?.name || issue.project?.key || 'General');\nconst thread = match?.telegramThreadId;\nconst threadId = thread === undefined || thread === null || String(thread).trim() === '' ? undefined : Number(thread);\nconst text = '🔄 [' + projectLabel + '] ' + String(issue.title || '(untitled)') + '\\n→ ' + String(issue.state?.name || 'N/A') + ' | Assignee: ' + String(issue.assignee?.name || '—');\nreturn [{ json: { text, threadId } }];`,
      },
    },
    {
      id: "telegram-send-wf1",
      name: "Telegram: notify",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [940, -80],
      parameters: {
        method: "POST",
        url: "={{ 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/sendMessage' }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { chat_id: $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID', message_thread_id: Number($json.threadId || 0) || undefined, text: $json.text || 'WF-1 alert' } }}",
        options: {},
      },
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
    "IF status In Review or Blocked": { main: [[{ node: "Prepare Telegram payload", type: "main", index: 0 }], []] },
    "Prepare Telegram payload": { main: [[{ node: "Telegram: notify", type: "main", index: 0 }]] },
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
