#!/usr/bin/env node
/**
 * Upsert WF-7: centralized DLQ/parking + replay workflow.
 *
 * Webhooks:
 * - POST /webhook/wf-dlq-park   { sourceWorkflow, failureType, reason, replayTarget?, replayPayload?, context? }
 * - POST /webhook/wf-dlq-replay { id? }  // replays by id or oldest parked item
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_NAME = "WF-7: DLQ Parking + Replay (AIPipeline)";

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
            if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 800)}`));
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
  name: WORKFLOW_NAME,
  nodes: [
    {
      id: "wf7-park-webhook",
      name: "DLQ Park Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, -120],
      webhookId: "wf-dlq-park",
      parameters: {
        path: "wf-dlq-park",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {},
      },
    },
    {
      id: "wf7-normalize-park",
      name: "Normalize parking payload",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, -120],
      parameters: {
        jsCode: `const body = $json.body || $json || {};
const now = new Date().toISOString();
const base = {
  id: 'dlq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
  status: 'parked',
  parkedAt: now,
  sourceWorkflow: body.sourceWorkflow || body.workflow || 'unknown',
  failureType: body.failureType || 'unknown',
  reason: body.reason || 'No reason provided',
  rateLimited: Boolean(body.rateLimited),
  replayTarget: body.replayTarget || '',
  replayPayload: body.replayPayload || null,
  context: body.context || {},
  attempts: 0,
};
return [{ json: base }];`,
      },
    },
    {
      id: "wf7-store-park",
      name: "Persist parked event",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, -120],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');
if (!Array.isArray(db.dlq)) db.dlq = [];
const item = $json;
db.dlq.unshift(item);
if (db.dlq.length > 500) db.dlq = db.dlq.slice(0, 500);
const text = [
  '⚠️ *DLQ parked event*',
  'ID: ' + item.id,
  'Workflow: ' + item.sourceWorkflow,
  'Failure: ' + item.failureType,
  'Reason: ' + String(item.reason).slice(0, 500),
  item.rateLimited ? 'Rate-limit: yes' : 'Rate-limit: no',
  item.replayTarget ? ('Replay target: ' + item.replayTarget) : 'Replay target: missing'
].join('\\n');
return [{ json: { ...item, text } }];`,
      },
    },
    {
      id: "wf7-alert-park",
      name: "Telegram: DLQ parked",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [660, -120],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
        additionalFields: { parse_mode: "Markdown" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },

    {
      id: "wf7-replay-webhook",
      name: "DLQ Replay Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 220],
      webhookId: "wf-dlq-replay",
      parameters: {
        path: "wf-dlq-replay",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {},
      },
    },
    {
      id: "wf7-select-replay-item",
      name: "Select replay item",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, 220],
      parameters: {
        jsCode: `const body = $json.body || $json || {};
const db = $getWorkflowStaticData('global');
const list = Array.isArray(db.dlq) ? db.dlq : [];
const id = String(body.id || '').trim();
let item = null;
if (id) item = list.find((x) => x.id === id) || null;
if (!item) item = list.find((x) => x.status === 'parked') || null;
if (!item) {
  return [{ json: { hasItem: false, text: 'ℹ️ DLQ replay: no parked items found.' } }];
}
item.attempts = Number(item.attempts || 0) + 1;
item.lastReplayAttemptAt = new Date().toISOString();
return [{ json: {
  hasItem: true,
  id: item.id,
  replayTarget: item.replayTarget || '',
  replayPayload: item.replayPayload || item.context || {},
  sourceWorkflow: item.sourceWorkflow || 'unknown',
  failureType: item.failureType || 'unknown',
  text: '🔁 DLQ replay requested for ' + item.id + ' (' + (item.sourceWorkflow || 'unknown') + ')',
} }];`,
      },
    },
    {
      id: "wf7-if-replay-item",
      name: "If replay item exists",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [440, 220],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.hasItem }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "wf7-if-replay-target",
      name: "If replay target set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [660, 140],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.replayTarget || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "wf7-replay-dispatch",
      name: "Replay dispatch",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [880, 60],
      continueOnFail: true,
      alwaysOutputData: true,
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 1500,
      parameters: {
        method: "POST",
        url: "={{ $('Select replay item').first().json.replayTarget }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ $('Select replay item').first().json.replayPayload }}",
        options: {},
      },
    },
    {
      id: "wf7-finalize-replay",
      name: "Finalize replay",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1100, 60],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');
if (!Array.isArray(db.dlq)) db.dlq = [];
const replayCtx = $('Select replay item').first().json;
const item = db.dlq.find((x) => x.id === replayCtx.id);
const err = $json.error || null;
if (item) {
  item.lastReplayResultAt = new Date().toISOString();
  if (err) {
    item.status = 'replay_failed';
    item.lastReplayError = err.message || err.description || JSON.stringify(err).slice(0, 300);
  } else {
    item.status = 'replayed';
    item.lastReplayError = '';
  }
}
const isRateLimited = Boolean(err && /429|rate\s*limit|too many requests/i.test((err.message || '') + ' ' + (err.description || '')));
const text = err
  ? ('❌ DLQ replay failed for ' + replayCtx.id + '\\n' + (item?.lastReplayError || 'unknown error') + (isRateLimited ? '\\n(rate-limited)' : ''))
  : ('✅ DLQ replay succeeded for ' + replayCtx.id + '\\nsource=' + (replayCtx.sourceWorkflow || 'unknown'));
return [{ json: { text } }];`,
      },
    },
    {
      id: "wf7-set-replay-target-missing",
      name: "Set replay target missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [880, 220],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [{ name: "text", type: "string", value: "=⚠️ DLQ replay skipped for {{ $json.id }}: replayTarget is empty." }],
        },
        options: {},
      },
    },
    {
      id: "wf7-alert-replay",
      name: "Telegram: replay result",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1320, 120],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
  ],
  connections: {
    "DLQ Park Webhook": { main: [[{ node: "Normalize parking payload", type: "main", index: 0 }]] },
    "Normalize parking payload": { main: [[{ node: "Persist parked event", type: "main", index: 0 }]] },
    "Persist parked event": { main: [[{ node: "Telegram: DLQ parked", type: "main", index: 0 }]] },

    "DLQ Replay Webhook": { main: [[{ node: "Select replay item", type: "main", index: 0 }]] },
    "Select replay item": { main: [[{ node: "If replay item exists", type: "main", index: 0 }]] },
    "If replay item exists": { main: [[{ node: "If replay target set", type: "main", index: 0 }], [{ node: "Telegram: replay result", type: "main", index: 0 }]] },
    "If replay target set": {
      main: [
        [{ node: "Replay dispatch", type: "main", index: 0 }],
        [{ node: "Set replay target missing", type: "main", index: 0 }],
      ],
    },
    "Replay dispatch": { main: [[{ node: "Finalize replay", type: "main", index: 0 }]] },
    "Finalize replay": { main: [[{ node: "Telegram: replay result", type: "main", index: 0 }]] },
    "Set replay target missing": { main: [[{ node: "Telegram: replay result", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function upsertWorkflow() {
  const list = await request("GET", "/api/v1/workflows?limit=250");
  const rows = Array.isArray(list.data) ? list.data : [];
  const existing = rows.find((w) => w.name === WORKFLOW_NAME);
  if (existing?.id) {
    const updated = await request("PUT", `/api/v1/workflows/${existing.id}`, workflow);
    return { action: "updated", id: updated.id || existing.id };
  }
  const created = await request("POST", "/api/v1/workflows", workflow);
  return { action: "created", id: created.id };
}

async function setActive(id) {
  await request("POST", `/api/v1/workflows/${id}/activate`, {});
}

async function main() {
  const result = await upsertWorkflow();
  if (result.id) {
    try {
      await setActive(result.id);
    } catch (e) {
      console.warn("WF-7 activation warning:", e.message || e);
    }
  }
  console.log(`WF-7 ${result.action}: ${result.id || "n/a"}.`);
  console.log("DLQ endpoints: /webhook/wf-dlq-park and /webhook/wf-dlq-replay");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
