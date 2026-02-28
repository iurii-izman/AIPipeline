#!/usr/bin/env node
/**
 * Update WF-5 workflow in n8n: Telegram Command Center.
 * Commands:
 *   /status, /help, /tasks, /errors, /search <query>, /create <title>, /deploy <staging|production>, /standup
 * Requires: N8N_API_KEY, n8n running.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF5_ID = "41jAGQw9qAMs52dN";
const APP_STATUS_URL = process.env.APP_STATUS_URL || "http://host.containers.internal:3000/status";

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

const HELP_TEXT = `📋 *AIPipeline Bot — команды*\n\n/status — статус пайплайна\n/help — список команд\n/tasks — мои открытые задачи (Linear)\n/errors — top-5 ошибок (Sentry)\n/search <query> — поиск в Notion\n/create <title> — создать задачу в Linear\n/deploy <staging|production> — запуск GitHub workflow\n/standup — краткий дайджест по задачам`;

const workflow = {
  name: "WF-5: Telegram Command Center (AIPipeline)",
  nodes: [
    {
      id: "tg-trigger",
      name: "Telegram Trigger",
      type: "n8n-nodes-base.telegramTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: { updates: ["message"], additionalFields: {} },
      webhookId: "wf5-telegram-webhook",
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
    {
      id: "extract-command",
      name: "Extract command",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, 0],
      parameters: {
        jsCode: `const text = (($json.message && $json.message.text) || '').trim();\nconst [commandRaw, ...rest] = text.split(/\\s+/);\nconst command = (commandRaw || '').toLowerCase();\nconst args = rest.join(' ').trim();\nconst username = $json.message?.from?.username || '';\nconst chatId = $json.message?.chat?.id;\nreturn [{ json: { command, args, username, chatId, raw: text } }];`,
      },
    },

    {
      id: "if-status",
      name: "If /status",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [440, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/status", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "http-status",
      name: "GET /status",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [660, -320],
      parameters: { method: "GET", url: APP_STATUS_URL, options: {} },
    },
    {
      id: "fmt-status",
      name: "Format /status",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [880, -320],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=✅ *Pipeline status*\\n```json\\n{{ JSON.stringify($json, null, 2) }}\\n```",
            },
          ],
        },
        options: {},
      },
    },

    {
      id: "if-help",
      name: "If /help",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [660, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/help", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "set-help",
      name: "Set /help",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [880, -160],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: HELP_TEXT }), options: {} },
    },

    {
      id: "if-tasks",
      name: "If /tasks",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [880, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/tasks", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "linear-tasks",
      name: "Linear: Get issues for /tasks",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [1120, -320],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-tasks",
      name: "Format /tasks",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1340, -320],
      parameters: {
        jsCode: `const username = $('Extract command').first().json.username || '';\nconst items = $input.all().map(i => i.json);\nconst filtered = items.filter(i => {\n  const state = (i.state?.name || '').toLowerCase();\n  if (['done', 'cancelled', 'canceled'].includes(state)) return false;\n  if (!username) return true;\n  const assignee = (i.assignee?.displayName || i.assignee?.name || i.assignee?.email || '').toLowerCase();\n  return assignee.includes(username.toLowerCase());\n});\nconst top = filtered.slice(0, 7);\nconst lines = top.map(i => '• ' + (i.identifier || 'N/A') + ' — ' + i.title + ' [' + (i.state?.name || 'N/A') + ']');\nconst suffix = filtered.length > top.length ? ('\\n… and ' + (filtered.length - top.length) + ' more') : '';\nconst text = top.length\n  ? ('🧩 *Open tasks*' + (username ? (' for @' + username) : '') + '\\n' + lines.join('\\n') + suffix)\n  : ('🧩 No open tasks' + (username ? (' for @' + username) : '') + '.');\nreturn [{ json: { text } }];`,
      },
    },

    {
      id: "if-errors",
      name: "If /errors",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1120, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/errors", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-errors-config",
      name: "If Sentry env configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1340, -80],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.SENTRY_AUTH_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $env.SENTRY_ORG_SLUG || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $env.SENTRY_PROJECT_SLUG || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "http-errors",
      name: "Sentry: recent issues",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1560, -160],
      parameters: {
        method: "GET",
        url: "={{ 'https://sentry.io/api/0/projects/' + $env.SENTRY_ORG_SLUG + '/' + $env.SENTRY_PROJECT_SLUG + '/issues/?limit=5&query=is:unresolved' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.SENTRY_AUTH_TOKEN }}" },
            { name: "Accept", value: "application/json" },
          ],
        },
        options: {},
      },
    },
    {
      id: "fmt-errors",
      name: "Format /errors",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1780, -160],
      parameters: {
        jsCode: `const data = Array.isArray($json) ? $json : ($json.data || []);\nconst top = data.slice(0, 5);\nconst lines = top.map(i => '• [' + (i.level || 'n/a') + '] ' + (i.title || 'Untitled') + '\\n  ' + (i.permalink || i.shortId || ''));\nreturn [{ json: { text: top.length ? ('🚨 *Sentry top issues*\\n' + lines.join('\\n')) : '🚨 No unresolved Sentry issues.' } }];`,
      },
    },
    {
      id: "set-errors-missing-config",
      name: "Set /errors config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1560, 0],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "⚠️ /errors requires SENTRY_AUTH_TOKEN, SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG in n8n env." }),
        options: {},
      },
    },

    {
      id: "if-search",
      name: "If /search",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1340, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/search", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-search-query",
      name: "If /search has query",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1560, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.args || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "http-notion-search",
      name: "Notion: search",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1780, 40],
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
        jsonBody: "={{ { query: $('Extract command').first().json.args, page_size: 5 } }}",
        options: {},
      },
    },
    {
      id: "fmt-search",
      name: "Format /search",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2000, 40],
      parameters: {
        jsCode: `const rows = ($json.results || []).slice(0, 5);\nconst titleOf = (r) => {\n  const p = r.properties || {};\n  for (const key of Object.keys(p)) {\n    if (p[key]?.type === 'title') {\n      return (p[key].title || []).map(t => t.plain_text).join('') || '(untitled)';\n    }\n  }\n  if (r.title && Array.isArray(r.title)) return r.title.map(t => t.plain_text).join('') || '(untitled)';\n  return '(untitled)';\n};\nconst lines = rows.map(r => '• ' + titleOf(r) + '\\n  ' + (r.url || ''));\nreturn [{ json: { text: lines.length ? ('🔎 *Notion search*\\n' + lines.join('\\n')) : '🔎 No Notion results.' } }];`,
      },
    },
    {
      id: "set-search-usage",
      name: "Set /search usage",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1780, 200],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: "Usage: /search <query>" }), options: {} },
    },

    {
      id: "if-create",
      name: "If /create",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1560, 320],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/create", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-create-title",
      name: "If /create has title",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1780, 320],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.args || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-linear-team",
      name: "If LINEAR_TEAM_ID set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2000, 240],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $env.LINEAR_TEAM_ID || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "linear-create",
      name: "Linear: Create issue",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [2220, 160],
      parameters: {
        resource: "issue",
        operation: "create",
        title: "={{ $('Extract command').first().json.args }}",
        description: "=Created from Telegram /create by @{{ $('Extract command').first().json.username || 'unknown' }}",
        teamId: { __rl: true, mode: "id", value: "={{ $env.LINEAR_TEAM_ID }}" },
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-create",
      name: "Format /create",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2440, 160],
      parameters: {
        jsCode: `const issue = $json;\nconst ident = issue.identifier || issue.id || 'N/A';\nconst url = issue.url || issue.permalink || '';\nreturn [{ json: { text: '✅ Created Linear issue: ' + ident + '\\n' + url } }];`,
      },
    },
    {
      id: "set-create-missing-team",
      name: "Set /create config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2220, 320],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "⚠️ /create requires LINEAR_TEAM_ID in n8n env." }),
        options: {},
      },
    },
    {
      id: "set-create-usage",
      name: "Set /create usage",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2000, 400],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: "Usage: /create <title>" }), options: {} },
    },

    {
      id: "if-deploy",
      name: "If /deploy",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1780, 560],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/deploy", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "prepare-deploy",
      name: "Prepare deploy payload",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2000, 560],
      parameters: {
        jsCode: `const envArg = (($('Extract command').first().json.args || '').trim().toLowerCase() || 'staging');\nif (!['staging', 'production'].includes(envArg)) {\n  return [{ json: { valid: false, text: 'Usage: /deploy <staging|production>' } }];\n}\nconst workflow = envArg === 'production'\n  ? ($env.GITHUB_WORKFLOW_PRODUCTION || 'deploy-production.yml')\n  : ($env.GITHUB_WORKFLOW_STAGING || 'deploy-staging.yml');\nconst ref = envArg === 'production' ? 'main' : 'staging';\nreturn [{ json: { valid: true, env: envArg, workflow, ref } }];`,
      },
    },
    {
      id: "if-deploy-valid",
      name: "If deploy payload valid",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2220, 560],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.valid }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "http-deploy",
      name: "GitHub: dispatch workflow",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2440, 480],
      parameters: {
        method: "POST",
        url: "={{ 'https://api.github.com/repos/' + ($env.GITHUB_OWNER || 'iurii-izman') + '/' + ($env.GITHUB_REPO || 'AIPipeline') + '/actions/workflows/' + $json.workflow + '/dispatches' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.GITHUB_PERSONAL_ACCESS_TOKEN }}" },
            { name: "Accept", value: "application/vnd.github+json" },
            { name: "X-GitHub-Api-Version", value: "2022-11-28" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { ref: $json.ref } }}",
        options: {},
      },
    },
    {
      id: "set-deploy-ok",
      name: "Set /deploy ok",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2660, 480],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=🚀 Deploy dispatched: *{{ $('Prepare deploy payload').first().json.env }}*\\nWorkflow: {{ $('Prepare deploy payload').first().json.workflow }}\\nRef: {{ $('Prepare deploy payload').first().json.ref }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "set-deploy-usage",
      name: "Set /deploy usage",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2440, 640],
      parameters: {
        mode: "manual",
        assignments: { assignments: [{ name: "text", type: "string", value: "={{ $json.text || 'Usage: /deploy <staging|production>' }}" }] },
        options: {},
      },
    },

    {
      id: "if-standup",
      name: "If /standup",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2000, 760],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/standup", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "linear-standup",
      name: "Linear: Get issues for /standup",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [2220, 760],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-standup",
      name: "Format /standup",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2440, 760],
      parameters: {
        jsCode: `const items = $input.all().map(i => i.json);\nconst buckets = new Map();\nfor (const it of items) {\n  const key = it.state?.name || 'Other';\n  buckets.set(key, (buckets.get(key) || 0) + 1);\n}\nconst lines = [...buckets.entries()].map(([k,v]) => '• ' + k + ': ' + v);\nconst text = '📝 *Standup digest*\\nDate: ' + new Date().toISOString().slice(0,10) + '\\n' + (lines.join('\\n') || 'No issues');\nreturn [{ json: { text } }];`,
      },
    },

    {
      id: "set-unknown",
      name: "Set unknown command",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2220, 920],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: "Unknown command. Use /help." }), options: {} },
    },

    {
      id: "telegram-send",
      name: "Telegram Send",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2900, 320],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        text: "={{ $json.text || JSON.stringify($json, null, 2) }}",
        additionalFields: { parse_mode: "Markdown" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
  ],
  connections: {
    "Telegram Trigger": { main: [[{ node: "Extract command", type: "main", index: 0 }]] },
    "Extract command": { main: [[{ node: "If /status", type: "main", index: 0 }]] },

    "If /status": { main: [[{ node: "GET /status", type: "main", index: 0 }], [{ node: "If /help", type: "main", index: 0 }]] },
    "GET /status": { main: [[{ node: "Format /status", type: "main", index: 0 }]] },
    "Format /status": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /help": { main: [[{ node: "Set /help", type: "main", index: 0 }], [{ node: "If /tasks", type: "main", index: 0 }]] },
    "Set /help": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /tasks": { main: [[{ node: "Linear: Get issues for /tasks", type: "main", index: 0 }], [{ node: "If /errors", type: "main", index: 0 }]] },
    "Linear: Get issues for /tasks": { main: [[{ node: "Format /tasks", type: "main", index: 0 }]] },
    "Format /tasks": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /errors": { main: [[{ node: "If Sentry env configured", type: "main", index: 0 }], [{ node: "If /search", type: "main", index: 0 }]] },
    "If Sentry env configured": { main: [[{ node: "Sentry: recent issues", type: "main", index: 0 }], [{ node: "Set /errors config missing", type: "main", index: 0 }]] },
    "Sentry: recent issues": { main: [[{ node: "Format /errors", type: "main", index: 0 }]] },
    "Format /errors": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /errors config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /search": { main: [[{ node: "If /search has query", type: "main", index: 0 }], [{ node: "If /create", type: "main", index: 0 }]] },
    "If /search has query": { main: [[{ node: "Notion: search", type: "main", index: 0 }], [{ node: "Set /search usage", type: "main", index: 0 }]] },
    "Notion: search": { main: [[{ node: "Format /search", type: "main", index: 0 }]] },
    "Format /search": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /search usage": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /create": { main: [[{ node: "If /create has title", type: "main", index: 0 }], [{ node: "If /deploy", type: "main", index: 0 }]] },
    "If /create has title": { main: [[{ node: "If LINEAR_TEAM_ID set", type: "main", index: 0 }], [{ node: "Set /create usage", type: "main", index: 0 }]] },
    "If LINEAR_TEAM_ID set": { main: [[{ node: "Linear: Create issue", type: "main", index: 0 }], [{ node: "Set /create config missing", type: "main", index: 0 }]] },
    "Linear: Create issue": { main: [[{ node: "Format /create", type: "main", index: 0 }]] },
    "Format /create": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /create config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /create usage": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /deploy": { main: [[{ node: "Prepare deploy payload", type: "main", index: 0 }], [{ node: "If /standup", type: "main", index: 0 }]] },
    "Prepare deploy payload": { main: [[{ node: "If deploy payload valid", type: "main", index: 0 }]] },
    "If deploy payload valid": { main: [[{ node: "GitHub: dispatch workflow", type: "main", index: 0 }], [{ node: "Set /deploy usage", type: "main", index: 0 }]] },
    "GitHub: dispatch workflow": { main: [[{ node: "Set /deploy ok", type: "main", index: 0 }]] },
    "Set /deploy ok": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /deploy usage": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /standup": { main: [[{ node: "Linear: Get issues for /standup", type: "main", index: 0 }], [{ node: "Set unknown command", type: "main", index: 0 }]] },
    "Linear: Get issues for /standup": { main: [[{ node: "Format /standup", type: "main", index: 0 }]] },
    "Format /standup": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set unknown command": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
  const updated = await request("PUT", `/api/v1/workflows/${WF5_ID}`, workflow);
  console.log("WF-5 updated.", updated.id, updated.name);
  console.log("Next: open n8n UI, verify credentials (Telegram/Linear), activate if needed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
