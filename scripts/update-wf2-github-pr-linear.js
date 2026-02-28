#!/usr/bin/env node
/**
 * Update WF-2: GitHub PR webhook (event-driven) -> parse issue key -> attempt Linear status update -> Telegram notify.
 *
 * Expected GitHub webhook event: pull_request (opened/closed).
 * Linear update requires LINEAR_API_KEY in n8n env.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF2_ID = "k7RSIieuQxwZ8zQT";
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
            if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 500)}`));
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
      id: "webhook-github-pr",
      name: "GitHub PR Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: "wf2-github-pr",
      parameters: {
        path: "wf2-github-pr",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {},
      },
    },
    {
      id: "extract-pr",
      name: "Extract PR payload",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, 0],
      parameters: {
        jsCode: `const action = ($json.body?.action || '').toLowerCase();\nconst pr = $json.body?.pull_request || {};\nconst merged = Boolean(pr.merged);\nconst branch = pr.head?.ref || '';\nconst title = pr.title || '(untitled PR)';\nconst url = pr.html_url || '';\nconst number = pr.number || '';\nconst headers = $json.headers || {};\nconst deliveryId = headers['x-github-delivery'] || headers['X-GitHub-Delivery'] || '';\nconst match = branch.match(/(AIP-\\d+)/i) || title.match(/(AIP-\\d+)/i);\nconst issueKey = match ? match[1].toUpperCase() : '';\nconst teamKey = issueKey ? issueKey.split('-')[0] : '';\nreturn [{ json: { action, merged, branch, title, url, number, issueKey, teamKey, deliveryId } }];`,
      },
    },
    {
      id: "dedupe-delivery",
      name: "Deduplicate delivery",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, -120],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nif (!db.seen) db.seen = {};\nconst ttlMs = 7 * 24 * 60 * 60 * 1000;\nconst now = Date.now();\nfor (const [k, ts] of Object.entries(db.seen)) {\n  if (!Number.isFinite(ts) || (now - ts) > ttlMs) delete db.seen[k];\n}\nconst key = $json.deliveryId || (($json.action || '') + ':' + ($json.number || '') + ':' + ($json.url || '') + ':' + String($json.merged));\nconst seenAt = db.seen[key];\nif (seenAt && (now - seenAt) < ttlMs) {\n  return [{ json: { ...$json, isDuplicate: true, dedupeKey: key } }];\n}\ndb.seen[key] = now;\nreturn [{ json: { ...$json, isDuplicate: false, dedupeKey: key } }];`,
      },
    },
    {
      id: "if-delivery-duplicate",
      name: "If delivery duplicate",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [660, -120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.isDuplicate }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-relevant",
      name: "If PR opened/closed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [880, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $json.action }}", rightValue: "opened", operator: { type: "string", operation: "equals" } },
            { leftValue: "={{ $json.action }}", rightValue: "closed", operator: { type: "string", operation: "equals" } },
          ],
          combinator: "or",
        },
      },
    },
    {
      id: "if-merged",
      name: "If merged",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1100, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.merged }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-has-issue-key",
      name: "If has AIP key",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1320, -120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.issueKey || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-linear-token",
      name: "If LINEAR_API_KEY set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1540, -120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $env.LINEAR_API_KEY || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "linear-find-issue",
      name: "Linear: find issue id",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1760, -220],
      parameters: {
        method: "POST",
        url: "https://api.linear.app/graphql",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.LINEAR_API_KEY }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { query: 'query($identifier:String!){issues(filter:{identifier:{eq:$identifier}},first:1){nodes{id identifier title}}}', variables: { identifier: $('Extract PR payload').first().json.issueKey } } }}",
        options: {},
      },
    },
    {
      id: "linear-pick-issue-id",
      name: "Linear: pick issue id",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1980, -220],
      parameters: {
        jsCode: `const node = $json?.data?.issues?.nodes?.[0];\nreturn [{ json: { issueId: node?.id || '', issueIdentifier: node?.identifier || $('Extract PR payload').first().json.issueKey || '' } }];`,
      },
    },
    {
      id: "if-linear-issue-id",
      name: "If Linear issue found",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2200, -220],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.issueId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "linear-team-states",
      name: "Linear: get team states",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2420, -320],
      parameters: {
        method: "POST",
        url: "https://api.linear.app/graphql",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.LINEAR_API_KEY }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { query: 'query($key:String!){teams(filter:{key:{eq:$key}},first:1){nodes{id states{name id type}}}}', variables: { key: $('Extract PR payload').first().json.teamKey || 'AIP' } } }}",
        options: {},
      },
    },
    {
      id: "linear-pick-done-state",
      name: "Linear: pick Done state",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2640, -320],
      parameters: {
        jsCode: `const states = $json?.data?.teams?.nodes?.[0]?.states || [];\nconst done = states.find(s => (s.type || '').toLowerCase() === 'completed') || states.find(s => (s.name || '').toLowerCase() === 'done');\nreturn [{ json: { doneStateId: done?.id || '' } }];`,
      },
    },
    {
      id: "if-done-state",
      name: "If Done state found",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2860, -320],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.doneStateId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "linear-update-state",
      name: "Linear: update issue state",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3080, -400],
      parameters: {
        method: "POST",
        url: "https://api.linear.app/graphql",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.LINEAR_API_KEY }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { query: 'mutation($id:String!,$stateId:String!){issueUpdate(id:$id,input:{stateId:$stateId}){success issue{id identifier}}}', variables: { id: $('Linear: pick issue id').first().json.issueId, stateId: $('Linear: pick Done state').first().json.doneStateId } } }}",
        options: {},
      },
    },
    {
      id: "assess-linear-update",
      name: "Assess Linear update result",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3300, -400],
      parameters: {
        jsCode: `const err = $json.error || null;
if (!err) return [{ json: { linearFailed: false, rateLimited: false, reason: '' } }];
const msg = String(err.message || err.description || JSON.stringify(err)).slice(0, 360);
const rateLimited = /429|rate\\s*limit|too many requests/i.test(msg);
return [{ json: { linearFailed: true, rateLimited, reason: msg } }];`,
      },
    },
    {
      id: "if-linear-update-failed",
      name: "If Linear update failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3520, -400],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.linearFailed }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "set-merged-updated",
      name: "Set merged + updated",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3740, -500],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=✅ PR #{{ $('Extract PR payload').first().json.number }} merged: {{ $('Extract PR payload').first().json.title }}\\n{{ $('Extract PR payload').first().json.url }}\\nLinear moved to Done: {{ $('Extract PR payload').first().json.issueKey }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "set-merged-linear-failed",
      name: "Set merged + Linear failed",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3740, -300],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value:
                "=✅ PR #{{ $('Extract PR payload').first().json.number }} merged: {{ $('Extract PR payload').first().json.title }}\\n{{ $('Extract PR payload').first().json.url }}\\n⚠️ Linear update failed{{ $('Assess Linear update result').first().json.rateLimited ? ' (rate-limited)' : '' }}: {{ $('Assess Linear update result').first().json.reason || 'unknown error' }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "dlq-park-linear-failure",
      name: "DLQ: park Linear failure",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3960, -300],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-2', failureType: 'linear_update_failed', reason: $('Assess Linear update result').first().json.reason || 'unknown error', rateLimited: $('Assess Linear update result').first().json.rateLimited || false, replayTarget: (($env.WEBHOOK_URL || '').replace(/\\/$/, '') + '/webhook/wf2-github-pr'), replayPayload: { action: $('Extract PR payload').first().json.action, pull_request: { number: $('Extract PR payload').first().json.number, title: $('Extract PR payload').first().json.title, html_url: $('Extract PR payload').first().json.url, merged: $('Extract PR payload').first().json.merged, head: { ref: $('Extract PR payload').first().json.branch } } }, context: $('Extract PR payload').first().json } }}",
        options: {},
      },
    },
    {
      id: "set-merged-no-linear",
      name: "Set merged fallback",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3080, -120],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=✅ PR #{{ $('Extract PR payload').first().json.number }} merged: {{ $('Extract PR payload').first().json.title }}\\n{{ $('Extract PR payload').first().json.url }}\\n⚠️ Linear update skipped (issue key/state/token not available).",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "set-opened",
      name: "Set PR opened",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1540, 220],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=🔄 PR opened: #{{ $('Extract PR payload').first().json.number }} {{ $('Extract PR payload').first().json.title }}\\n{{ $('Extract PR payload').first().json.url }}\\nIssue key: {{ $('Extract PR payload').first().json.issueKey || 'not found' }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "telegram-send",
      name: "Telegram: send",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [4180, -100],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
    {
      id: "assess-telegram-send",
      name: "Assess Telegram delivery",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [4400, -100],
      parameters: {
        jsCode: `const err = $json.error || null;
if (!err) return [{ json: { telegramFailed: false } }];
const msg = String(err.message || err.description || JSON.stringify(err)).slice(0, 360);
const rateLimited = /429|rate\\s*limit|too many requests/i.test(msg);
return [{ json: { telegramFailed: true, rateLimited, reason: msg } }];`,
      },
    },
    {
      id: "if-telegram-failed",
      name: "If Telegram delivery failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [4620, -100],
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
      id: "dlq-park-telegram-failure",
      name: "DLQ: park Telegram failure",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [4840, -180],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-2', failureType: 'telegram_send_failed', reason: $('Assess Telegram delivery').first().json.reason || 'unknown error', rateLimited: $('Assess Telegram delivery').first().json.rateLimited || false, context: $('Extract PR payload').first().json } }}",
        options: {},
      },
    },
  ],
  connections: {
    "GitHub PR Webhook": { main: [[{ node: "Extract PR payload", type: "main", index: 0 }]] },
    "Extract PR payload": { main: [[{ node: "Deduplicate delivery", type: "main", index: 0 }]] },
    "Deduplicate delivery": { main: [[{ node: "If delivery duplicate", type: "main", index: 0 }]] },
    "If delivery duplicate": { main: [[], [{ node: "If PR opened/closed", type: "main", index: 0 }]] },
    "If PR opened/closed": { main: [[{ node: "If merged", type: "main", index: 0 }], []] },
    "If merged": { main: [[{ node: "If has AIP key", type: "main", index: 0 }], [{ node: "Set PR opened", type: "main", index: 0 }]] },

    "If has AIP key": { main: [[{ node: "If LINEAR_API_KEY set", type: "main", index: 0 }], [{ node: "Set merged fallback", type: "main", index: 0 }]] },
    "If LINEAR_API_KEY set": { main: [[{ node: "Linear: find issue id", type: "main", index: 0 }], [{ node: "Set merged fallback", type: "main", index: 0 }]] },
    "Linear: find issue id": { main: [[{ node: "Linear: pick issue id", type: "main", index: 0 }]] },
    "Linear: pick issue id": { main: [[{ node: "If Linear issue found", type: "main", index: 0 }]] },
    "If Linear issue found": { main: [[{ node: "Linear: get team states", type: "main", index: 0 }], [{ node: "Set merged fallback", type: "main", index: 0 }]] },
    "Linear: get team states": { main: [[{ node: "Linear: pick Done state", type: "main", index: 0 }]] },
    "Linear: pick Done state": { main: [[{ node: "If Done state found", type: "main", index: 0 }]] },
    "If Done state found": { main: [[{ node: "Linear: update issue state", type: "main", index: 0 }], [{ node: "Set merged fallback", type: "main", index: 0 }]] },
    "Linear: update issue state": { main: [[{ node: "Assess Linear update result", type: "main", index: 0 }]] },
    "Assess Linear update result": { main: [[{ node: "If Linear update failed", type: "main", index: 0 }]] },
    "If Linear update failed": {
      main: [
        [{ node: "Set merged + Linear failed", type: "main", index: 0 }],
        [{ node: "Set merged + updated", type: "main", index: 0 }],
      ],
    },
    "Set merged + Linear failed": { main: [[{ node: "DLQ: park Linear failure", type: "main", index: 0 }]] },
    "DLQ: park Linear failure": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },

    "Set merged + updated": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
    "Set merged fallback": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
    "Set PR opened": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
    "Telegram: send": { main: [[{ node: "Assess Telegram delivery", type: "main", index: 0 }]] },
    "Assess Telegram delivery": { main: [[{ node: "If Telegram delivery failed", type: "main", index: 0 }]] },
    "If Telegram delivery failed": { main: [[{ node: "DLQ: park Telegram failure", type: "main", index: 0 }], []] },
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
    if (node.type !== "n8n-nodes-base.linear") {
      node.continueOnFail = true;
      node.alwaysOutputData = true;
    }
  }
}

async function main() {
  applyResiliencePolicy(workflow);
  await request("PUT", `/api/v1/workflows/${WF2_ID}`, workflow);
  console.log("WF-2 updated. Next: in GitHub repo Webhooks, set URL to /webhook/wf2-github-pr and content-type application/json.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
