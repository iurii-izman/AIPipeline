#!/usr/bin/env node
/**
 * Update WF-2: Schedule (every 15 min) → GitHub list pull requests → format → Telegram.
 * Optionally in UI: add branch parsing → Linear update issue by identifier.
 * Requires: N8N_API_KEY, TELEGRAM_CHAT_ID, GITHUB owner/repo (default: iurii-izman/AIPipeline).
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF2_ID = "k7RSIieuQxwZ8zQT";
const TELEGRAM_CRED_ID = "CumMgGtm8MpeMfxm";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const REPO = process.env.GITHUB_REPO || "AIPipeline";
const OWNER = process.env.GITHUB_OWNER || "iurii-izman";

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
  name: "WF-2: GitHub PR → Linear + Telegram (AIPipeline)",
  nodes: [
    {
      id: "schedule-wf2",
      name: "Every 15 min",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: {
        rule: { interval: [{ field: "cronExpression", expression: "*/15 * * * *" }] },
      },
    },
    {
      id: "github-pulls",
      name: "GitHub: List PRs",
      type: "n8n-nodes-base.github",
      typeVersion: 1,
      position: [240, 0],
      parameters: {
        resource: "pullRequest",
        operation: "getMany",
        repository: REPO,
        owner: OWNER,
        returnAll: true,
        state: "open",
      },
      credentials: { githubApi: { name: "AIPipeline GitHub" } },
    },
    {
      id: "code-format-wf2",
      name: "Format PR digest",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [480, 0],
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: `const items = $input.all();
const lines = items.map(i => \`• \${i.json.title} (\${i.json.html_url}) branch: \${i.json.head?.ref || 'n/a'}\`);
const text = '📌 Open PRs: ' + (lines.length ? '\\n' + lines.join('\\n') : 'none');
return [{ json: { text } }];`,
      },
    },
    {
      id: "telegram-wf2",
      name: "Telegram: send",
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
    {
      id: "manual-wf2",
      name: "When clicking 'Test workflow'",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 220],
    },
    {
      id: "placeholder-wf2",
      name: "Placeholder",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [220, 220],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({
          info: "WF-2: Schedule → GitHub PRs → Telegram. In UI you can add: parse branch for Linear issue ID → Linear update issue.",
        }),
      },
    },
  ],
  connections: {
    "Every 15 min": { main: [[{ node: "GitHub: List PRs", type: "main", index: 0 }]] },
    "GitHub: List PRs": { main: [[{ node: "Format PR digest", type: "main", index: 0 }]] },
    "Format PR digest": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
    "When clicking 'Test workflow'": { main: [[{ node: "Placeholder", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
  await request("PUT", `/api/v1/workflows/${WF2_ID}`, workflow);
  console.log("WF-2 updated. In n8n: set GitHub credential 'AIPipeline GitHub', check owner/repo, activate. Optional: add Linear update by branch name in UI.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
