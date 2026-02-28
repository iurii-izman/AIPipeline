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
        jsCode: `const action = ($json.body?.action || '').toLowerCase();\nconst pr = $json.body?.pull_request || {};\nconst merged = Boolean(pr.merged);\nconst branch = pr.head?.ref || '';\nconst title = pr.title || '(untitled PR)';\nconst url = pr.html_url || '';\nconst number = pr.number || '';\nconst match = branch.match(/(AIP-\\d+)/i) || title.match(/(AIP-\\d+)/i);\nconst issueKey = match ? match[1].toUpperCase() : '';\nconst teamKey = issueKey ? issueKey.split('-')[0] : '';\nreturn [{ json: { action, merged, branch, title, url, number, issueKey, teamKey } }];`,
      },
    },
    {
      id: "if-relevant",
      name: "If PR opened/closed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [440, 0],
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
      position: [660, 0],
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
      position: [880, -120],
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
      position: [1100, -120],
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
      position: [1320, -220],
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
      position: [1540, -220],
      parameters: {
        jsCode: `const node = $json?.data?.issues?.nodes?.[0];\nreturn [{ json: { issueId: node?.id || '', issueIdentifier: node?.identifier || $('Extract PR payload').first().json.issueKey || '' } }];`,
      },
    },
    {
      id: "if-linear-issue-id",
      name: "If Linear issue found",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1760, -220],
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
      position: [1980, -320],
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
      position: [2200, -320],
      parameters: {
        jsCode: `const states = $json?.data?.teams?.nodes?.[0]?.states || [];\nconst done = states.find(s => (s.type || '').toLowerCase() === 'completed') || states.find(s => (s.name || '').toLowerCase() === 'done');\nreturn [{ json: { doneStateId: done?.id || '' } }];`,
      },
    },
    {
      id: "if-done-state",
      name: "If Done state found",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2420, -320],
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
      position: [2640, -400],
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
      id: "set-merged-updated",
      name: "Set merged + updated",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2860, -400],
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
      id: "set-merged-no-linear",
      name: "Set merged fallback",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2640, -120],
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
      position: [1100, 220],
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
      position: [3080, -80],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
  ],
  connections: {
    "GitHub PR Webhook": { main: [[{ node: "Extract PR payload", type: "main", index: 0 }]] },
    "Extract PR payload": { main: [[{ node: "If PR opened/closed", type: "main", index: 0 }]] },
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
    "Linear: update issue state": { main: [[{ node: "Set merged + updated", type: "main", index: 0 }]] },

    "Set merged + updated": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
    "Set merged fallback": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
    "Set PR opened": { main: [[{ node: "Telegram: send", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
  await request("PUT", `/api/v1/workflows/${WF2_ID}`, workflow);
  console.log("WF-2 updated. Next: in GitHub repo Webhooks, set URL to /webhook/wf2-github-pr and content-type application/json.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
