#!/usr/bin/env node
/**
 * Upsert WF-7: centralized DLQ/parking + replay workflow.
 *
 * Webhooks:
 * - POST /webhook/wf-dlq-park   { sourceWorkflow, failureType, reason, replayTarget?, replayPayload?, context? }
 * - POST /webhook/wf-dlq-replay { id? }  // replays by id or oldest parked item in durable store
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_NAME = "WF-7: DLQ Parking + Replay (AIPipeline)";
const DLQ_DURABLE_PARK_URL = process.env.DLQ_DURABLE_PARK_URL || "http://host.containers.internal:3000/dlq/park";
const DLQ_DURABLE_REPLAY_URL = process.env.DLQ_DURABLE_REPLAY_URL || "http://host.containers.internal:3000/dlq/replay";

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
const item = {
  id: body.id || ('dlq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)),
  status: 'parked',
  parkedAt: now,
  sourceWorkflow: body.sourceWorkflow || body.workflow || 'unknown',
  failureType: body.failureType || 'unknown',
  reason: body.reason || 'No reason provided',
  rateLimited: Boolean(body.rateLimited),
  replayTarget: body.replayTarget || '',
  replayPayload: body.replayPayload || null,
  context: body.context || {},
  attempts: Number(body.attempts || 0),
};
return [{ json: item }];`,
      },
    },
    {
      id: "wf7-durable-park",
      name: "Durable DLQ park",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [440, -180],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "POST",
        url: DLQ_DURABLE_PARK_URL,
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: "Authorization", value: "={{ $env.DLQ_INGEST_TOKEN ? ('Bearer ' + $env.DLQ_INGEST_TOKEN) : '' }}" }],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ $('Normalize parking payload').first().json }}",
        options: {},
      },
    },
    {
      id: "wf7-set-park-alert",
      name: "Build park alert",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [660, -180],
      parameters: {
        jsCode: `const item = $('Normalize parking payload').first().json;
const durableErr = $json.error || null;
const lines = [
  '⚠️ *DLQ parked event*',
  'ID: ' + item.id,
  'Workflow: ' + item.sourceWorkflow,
  'Failure: ' + item.failureType,
  'Reason: ' + String(item.reason).slice(0, 500),
  item.rateLimited ? 'Rate-limit: yes' : 'Rate-limit: no',
  item.replayTarget ? ('Replay target: ' + item.replayTarget) : 'Replay target: missing'
];
if (durableErr) {
  const msg = String(durableErr.message || durableErr.description || JSON.stringify(durableErr)).slice(0, 280);
  lines.push('Durable park: failed (' + msg + ')');
}
return [{ json: { ...item, text: lines.join('\\n') } }];`,
      },
    },
    {
      id: "wf7-alert-park",
      name: "Telegram: DLQ parked",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [880, -180],
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
      id: "wf7-replay-request",
      name: "Prepare replay request",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, 220],
      parameters: {
        jsCode: `const body = $json.body || $json || {};
const id = String(body.id || '').trim();
return [{ json: { id } }];`,
      },
    },
    {
      id: "wf7-replay-dispatch",
      name: "Replay dispatch",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [440, 220],
      continueOnFail: true,
      alwaysOutputData: true,
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 1500,
      parameters: {
        method: "POST",
        url: DLQ_DURABLE_REPLAY_URL,
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: "Authorization", value: "={{ ($env.DLQ_REPLAY_TOKEN || $env.DLQ_INGEST_TOKEN) ? ('Bearer ' + ($env.DLQ_REPLAY_TOKEN || $env.DLQ_INGEST_TOKEN)) : '' }}" }],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { id: $('Prepare replay request').first().json.id || undefined } }}",
        options: {},
      },
    },
    {
      id: "wf7-format-replay",
      name: "Format replay result",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [660, 220],
      parameters: {
        jsCode: `const req = $('Prepare replay request').first().json || {};
const err = $json.error || null;
if (err) {
  const detail = String(err.message || err.description || JSON.stringify(err)).slice(0, 320);
  const rateLimited = /429|rate\\s*limit|too many requests/i.test(detail);
  return [{ json: { text: '❌ DLQ replay call failed' + (req.id ? (' for ' + req.id) : '') + '\\n' + detail + (rateLimited ? '\\n(rate-limited)' : '') } }];
}
const ok = $json.ok === true;
const id = $json.id || req.id || 'oldest parked item';
if (!ok) {
  return [{ json: { text: '⚠️ DLQ replay not executed for ' + id + '\\n' + String($json.error || 'unknown error') } }];
}
const replayCode = Number($json.replayStatusCode || 0);
const target = String($json.replayTarget || '');
const statusLine = replayCode > 0 ? ('HTTP ' + replayCode) : 'no upstream status';
return [{ json: { text: '✅ DLQ replay result for ' + id + '\\n' + statusLine + (target ? ('\\nTarget: ' + target) : '') } }];`,
      },
    },
    {
      id: "wf7-alert-replay",
      name: "Telegram: replay result",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [880, 220],
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
    "Normalize parking payload": { main: [[{ node: "Durable DLQ park", type: "main", index: 0 }]] },
    "Durable DLQ park": { main: [[{ node: "Build park alert", type: "main", index: 0 }]] },
    "Build park alert": { main: [[{ node: "Telegram: DLQ parked", type: "main", index: 0 }]] },

    "DLQ Replay Webhook": { main: [[{ node: "Prepare replay request", type: "main", index: 0 }]] },
    "Prepare replay request": { main: [[{ node: "Replay dispatch", type: "main", index: 0 }]] },
    "Replay dispatch": { main: [[{ node: "Format replay result", type: "main", index: 0 }]] },
    "Format replay result": { main: [[{ node: "Telegram: replay result", type: "main", index: 0 }]] },
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
