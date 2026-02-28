#!/usr/bin/env node
/**
 * Update WF-3: Sentry Webhook -> LLM severity classification (or heuristic fallback)
 * -> Linear issue create (critical/non-critical) -> Telegram notification.
 *
 * Optional n8n env:
 *   OPENAI_API_KEY, OPENAI_MODEL (default gpt-4o-mini)
 *   LINEAR_TEAM_ID
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF3_ID = "95voTtHeQwJ7E3m5";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
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
            if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 600)}`));
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
  name: "WF-3: Sentry Alert → Telegram + Linear (AIPipeline)",
  nodes: [
    {
      id: "webhook-sentry",
      name: "Sentry Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: "wf3-sentry",
      parameters: {
        path: "wf3-sentry",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {},
      },
    },
    {
      id: "normalize-sentry",
      name: "Normalize Sentry event",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [220, 0],
      parameters: {
        jsCode: `const root = $json.body || $json;
const event = root.event || root.data?.event || root;
const issue = root.issue || root.data?.issue || {};
const title = event.title || issue.title || root.message || 'Sentry alert';
const level = (event.level || issue.level || root.level || 'error').toLowerCase();
const culprit = event.culprit || issue.culprit || '';
const project = root.project?.slug || root.project_slug || issue.project?.slug || 'node';
const url = issue.web_url || issue.permalink || event.web_url || root.url || '';
const fingerprint = (event.fingerprint && event.fingerprint.join(',')) || issue.shortId || issue.id || '';
const eventId = event.event_id || root.event_id || issue.id || root.id || '';
const payloadSnippet = JSON.stringify(root).slice(0, 3500);
return [{ json: { title, level, culprit, project, url, fingerprint, eventId, payloadSnippet } }];`,
      },
    },
    {
      id: "dedupe-sentry",
      name: "Deduplicate Sentry event",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, -120],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nif (!db.seen) db.seen = {};\nconst ttlMs = 7 * 24 * 60 * 60 * 1000;\nconst now = Date.now();\nfor (const [k, ts] of Object.entries(db.seen)) {\n  if (!Number.isFinite(ts) || (now - ts) > ttlMs) delete db.seen[k];\n}\nconst basis = $json.eventId || $json.fingerprint || (($json.project || '') + ':' + ($json.level || '') + ':' + ($json.title || ''));\nconst key = String(basis).slice(0, 400);\nconst seenAt = db.seen[key];\nif (seenAt && (now - seenAt) < ttlMs) {\n  return [{ json: { ...$json, isDuplicate: true, dedupeKey: key } }];\n}\ndb.seen[key] = now;\nreturn [{ json: { ...$json, isDuplicate: false, dedupeKey: key } }];`,
      },
    },
    {
      id: "if-sentry-duplicate",
      name: "If duplicate event",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [660, -120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              leftValue: "={{ $json.isDuplicate }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-openai-key",
      name: "If OPENAI_API_KEY set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [880, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              leftValue: "={{ $env.OPENAI_API_KEY || '' }}",
              rightValue: "",
              operator: { type: "string", operation: "notEmpty" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "openai-classify",
      name: "OpenAI classify severity",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1100, -120],
      parameters: {
        method: "POST",
        url: "https://api.openai.com/v1/chat/completions",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.OPENAI_API_KEY }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { model: ($env.OPENAI_MODEL || 'gpt-4o-mini'), temperature: 0, messages: [ { role: 'system', content: 'You classify Sentry incidents. Return only compact JSON with fields: severity (critical|non_critical), confidence (0..1), reason (string <= 140 chars).' }, { role: 'user', content: JSON.stringify({ title: $('Normalize Sentry event').first().json.title, level: $('Normalize Sentry event').first().json.level, culprit: $('Normalize Sentry event').first().json.culprit, project: $('Normalize Sentry event').first().json.project, url: $('Normalize Sentry event').first().json.url, fingerprint: $('Normalize Sentry event').first().json.fingerprint }) } ] } }}",
        options: {},
      },
    },
    {
      id: "if-openai-call-failed",
      name: "If OpenAI request failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1320, -220],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              leftValue: "={{ !!$json.error }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "parse-openai",
      name: "Parse LLM result",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1320, -120],
      parameters: {
        jsCode: `const base = $('Normalize Sentry event').first().json;
const text = $json.choices?.[0]?.message?.content || '';
let obj = null;
try { obj = JSON.parse(text); } catch {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { obj = JSON.parse(m[0]); } catch {}
  }
}
const sev = String(obj?.severity || '').toLowerCase();
const severity = sev === 'critical' ? 'critical' : 'non_critical';
const confidence = Number.isFinite(Number(obj?.confidence)) ? Number(obj.confidence) : 0.6;
const reason = (obj?.reason || 'LLM classification fallback').toString().slice(0, 180);
return [{ json: { ...base, severity, confidence, reason, classifiedBy: 'llm' } }];`,
      },
    },
    {
      id: "heuristic-classify",
      name: "Heuristic classify severity",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1100, 120],
      parameters: {
        jsCode: `const base = $input.first().json;
const t = (base.title || '').toLowerCase();
const l = (base.level || '').toLowerCase();
const criticalSignals = ['fatal', 'outofmemory', 'oom', 'db down', 'payment', 'auth', 'timeout cascade', 'panic', 'crash loop'];
const hit = criticalSignals.find(s => t.includes(s));
const severity = (l === 'fatal' || hit) ? 'critical' : 'non_critical';
const reason = hit ? ('keyword: ' + hit) : ('level=' + l);
const confidence = severity === 'critical' ? 0.74 : 0.64;
return [{ json: { ...base, severity, confidence, reason, classifiedBy: 'heuristic' } }];`,
      },
    },
    {
      id: "if-linear-team",
      name: "If LINEAR_TEAM_ID set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1540, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              leftValue: "={{ $env.LINEAR_TEAM_ID || '' }}",
              rightValue: "",
              operator: { type: "string", operation: "notEmpty" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-critical",
      name: "If critical",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1760, -120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            {
              leftValue: "={{ $json.severity }}",
              rightValue: "critical",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "linear-create-critical",
      name: "Linear: Create critical issue",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [1980, -220],
      parameters: {
        resource: "issue",
        operation: "create",
        teamId: "={{ $env.LINEAR_TEAM_ID }}",
        title: "=CRITICAL Sentry: {{ $json.title }}",
        description: "=Severity: {{ $json.severity }} ({{ $json.classifiedBy }}, conf={{ $json.confidence }})\\nReason: {{ $json.reason }}\\nLevel: {{ $json.level }}\\nProject: {{ $json.project }}\\nURL: {{ $json.url }}\\nFingerprint: {{ $json.fingerprint }}\\n\\nPayload:\\n{{ $json.payloadSnippet }}",
        additionalFields: { priority: 1 },
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "linear-create-normal",
      name: "Linear: Create bug issue",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [1980, -20],
      parameters: {
        resource: "issue",
        operation: "create",
        teamId: "={{ $env.LINEAR_TEAM_ID }}",
        title: "=Sentry: {{ $json.title }}",
        description: "=Severity: {{ $json.severity }} ({{ $json.classifiedBy }}, conf={{ $json.confidence }})\\nReason: {{ $json.reason }}\\nLevel: {{ $json.level }}\\nProject: {{ $json.project }}\\nURL: {{ $json.url }}\\nFingerprint: {{ $json.fingerprint }}\\n\\nPayload:\\n{{ $json.payloadSnippet }}",
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-critical-msg",
      name: "Format critical notification",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2200, -220],
      parameters: {
        jsCode: `const src = $('If critical').first().json;
const err = $json.error || null;
if (!err) {
  return [{ json: { text: '🚨 *CRITICAL* Sentry\\n' + src.title + '\\nLevel: ' + src.level + '\\nClassifier: ' + src.classifiedBy + ' (' + src.confidence + ')\\nReason: ' + src.reason + '\\nLinear: ' + ($json.identifier || $json.id || 'created') + '\\n' + (src.url || '') } }];
}
const msg = String(err.message || err.description || JSON.stringify(err)).slice(0, 300);
const rateLimited = /429|rate\\s*limit|too many requests/i.test(msg);
return [{ json: { text: '🚨 *CRITICAL* Sentry\\n' + src.title + '\\nLevel: ' + src.level + '\\nClassifier: ' + src.classifiedBy + ' (' + src.confidence + ')\\nReason: ' + src.reason + '\\n⚠️ Linear create failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg + '\\n' + (src.url || ''), linearFailed: true, rateLimited, linearReason: msg } }];`,
      },
    },
    {
      id: "fmt-normal-msg",
      name: "Format non-critical notification",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2200, -20],
      parameters: {
        jsCode: `const src = $('If critical').first().json;
const err = $json.error || null;
if (!err) {
  return [{ json: { text: '⚠️ *Sentry issue*\\n' + src.title + '\\nLevel: ' + src.level + '\\nClassifier: ' + src.classifiedBy + ' (' + src.confidence + ')\\nReason: ' + src.reason + '\\nLinear: ' + ($json.identifier || $json.id || 'created') + '\\n' + (src.url || '') } }];
}
const msg = String(err.message || err.description || JSON.stringify(err)).slice(0, 300);
const rateLimited = /429|rate\\s*limit|too many requests/i.test(msg);
return [{ json: { text: '⚠️ *Sentry issue*\\n' + src.title + '\\nLevel: ' + src.level + '\\nClassifier: ' + src.classifiedBy + ' (' + src.confidence + ')\\nReason: ' + src.reason + '\\n⚠️ Linear create failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg + '\\n' + (src.url || ''), linearFailed: true, rateLimited, linearReason: msg } }];`,
      },
    },
    {
      id: "fmt-no-linear",
      name: "Format no-linear notification",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1760, 180],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=⚠️ Sentry alert classified as *{{ $json.severity }}* but LINEAR_TEAM_ID is not configured.\\nTitle: {{ $json.title }}\\nLevel: {{ $json.level }}\\nClassifier: {{ $json.classifiedBy }} ({{ $json.confidence }})\\nReason: {{ $json.reason }}\\n{{ $json.url || '' }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "telegram-wf3",
      name: "Telegram: notify",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2420, -20],
      parameters: {
        operation: "sendMessage",
        chatId: CHAT_ID || "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
        additionalFields: { parse_mode: "Markdown" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
    {
      id: "if-linear-message-failed",
      name: "If Linear create failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2420, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.linearFailed || false }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "dlq-park-wf3-linear",
      name: "DLQ: park WF-3 Linear failure",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2640, 120],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-3', failureType: 'linear_create_failed', reason: $json.linearReason || 'unknown error', rateLimited: $json.rateLimited || false, replayTarget: (($env.WEBHOOK_URL || '').replace(/\\/$/, '') + '/webhook/wf3-sentry'), replayPayload: { title: $('If critical').first().json.title, level: $('If critical').first().json.level, culprit: $('If critical').first().json.culprit, project: $('If critical').first().json.project, url: $('If critical').first().json.url, fingerprint: $('If critical').first().json.fingerprint, event_id: $('If critical').first().json.eventId }, context: $('If critical').first().json } }}",
        options: {},
      },
    },
    {
      id: "assess-telegram-wf3",
      name: "Assess Telegram notify delivery",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2640, -20],
      parameters: {
        jsCode: `const err = $json.error || null;
if (!err) return [{ json: { telegramFailed: false } }];
const msg = String(err.message || err.description || JSON.stringify(err)).slice(0, 360);
const rateLimited = /429|rate\\s*limit|too many requests/i.test(msg);
return [{ json: { telegramFailed: true, rateLimited, reason: msg } }];`,
      },
    },
    {
      id: "if-telegram-wf3-failed",
      name: "If Telegram notify failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2860, -20],
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
      id: "dlq-park-wf3-telegram",
      name: "DLQ: park WF-3 Telegram failure",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3080, -100],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-3', failureType: 'telegram_send_failed', reason: $('Assess Telegram notify delivery').first().json.reason || 'unknown error', rateLimited: $('Assess Telegram notify delivery').first().json.rateLimited || false, context: $('If critical').first().json } }}",
        options: {},
      },
    },
    {
      id: "manual-wf3",
      name: "When clicking 'Test workflow'",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 260],
    },
    {
      id: "placeholder-wf3",
      name: "Placeholder",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [220, 260],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({
          info: "WF-3: Sentry webhook -> classify (OpenAI if configured) -> create Linear issue -> Telegram notify.",
        }),
      },
    },
  ],
  connections: {
    "Sentry Webhook": { main: [[{ node: "Normalize Sentry event", type: "main", index: 0 }]] },
    "Normalize Sentry event": { main: [[{ node: "Deduplicate Sentry event", type: "main", index: 0 }]] },
    "Deduplicate Sentry event": { main: [[{ node: "If duplicate event", type: "main", index: 0 }]] },
    "If duplicate event": { main: [[], [{ node: "If OPENAI_API_KEY set", type: "main", index: 0 }]] },
    "If OPENAI_API_KEY set": {
      main: [
        [{ node: "OpenAI classify severity", type: "main", index: 0 }],
        [{ node: "Heuristic classify severity", type: "main", index: 0 }],
      ],
    },
    "OpenAI classify severity": { main: [[{ node: "If OpenAI request failed", type: "main", index: 0 }]] },
    "If OpenAI request failed": {
      main: [
        [{ node: "Heuristic classify severity", type: "main", index: 0 }],
        [{ node: "Parse LLM result", type: "main", index: 0 }],
      ],
    },
    "Parse LLM result": { main: [[{ node: "If LINEAR_TEAM_ID set", type: "main", index: 0 }]] },
    "Heuristic classify severity": { main: [[{ node: "If LINEAR_TEAM_ID set", type: "main", index: 0 }]] },

    "If LINEAR_TEAM_ID set": {
      main: [
        [{ node: "If critical", type: "main", index: 0 }],
        [{ node: "Format no-linear notification", type: "main", index: 0 }],
      ],
    },
    "If critical": {
      main: [
        [{ node: "Linear: Create critical issue", type: "main", index: 0 }],
        [{ node: "Linear: Create bug issue", type: "main", index: 0 }],
      ],
    },
    "Linear: Create critical issue": { main: [[{ node: "Format critical notification", type: "main", index: 0 }]] },
    "Linear: Create bug issue": { main: [[{ node: "Format non-critical notification", type: "main", index: 0 }]] },

    "Format critical notification": { main: [[{ node: "If Linear create failed", type: "main", index: 0 }, { node: "Telegram: notify", type: "main", index: 0 }]] },
    "Format non-critical notification": { main: [[{ node: "If Linear create failed", type: "main", index: 0 }, { node: "Telegram: notify", type: "main", index: 0 }]] },
    "If Linear create failed": { main: [[{ node: "DLQ: park WF-3 Linear failure", type: "main", index: 0 }], []] },
    "Format no-linear notification": { main: [[{ node: "Telegram: notify", type: "main", index: 0 }]] },
    "Telegram: notify": { main: [[{ node: "Assess Telegram notify delivery", type: "main", index: 0 }]] },
    "Assess Telegram notify delivery": { main: [[{ node: "If Telegram notify failed", type: "main", index: 0 }]] },
    "If Telegram notify failed": { main: [[{ node: "DLQ: park WF-3 Telegram failure", type: "main", index: 0 }], []] },

    "When clicking 'Test workflow'": { main: [[{ node: "Placeholder", type: "main", index: 0 }]] },
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
  const updated = await request("PUT", `/api/v1/workflows/${WF3_ID}`, workflow);
  console.log(
    "WF-3 updated with LLM+heuristic classification.",
    "nodes=" + (updated.nodes ? updated.nodes.length : "n/a"),
    "id=" + (updated.id || WF3_ID)
  );
  console.log("Ensure OPENAI_API_KEY in n8n env for LLM branch.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
