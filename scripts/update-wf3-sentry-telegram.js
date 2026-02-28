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
const payloadSnippet = JSON.stringify(root).slice(0, 3500);
return [{ json: { title, level, culprit, project, url, fingerprint, payloadSnippet } }];`,
      },
    },
    {
      id: "if-openai-key",
      name: "If OPENAI_API_KEY set",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [440, 0],
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
      position: [660, -120],
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
      id: "parse-openai",
      name: "Parse LLM result",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [880, -120],
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
      position: [660, 120],
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
      position: [1100, 0],
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
      position: [1320, -120],
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
      position: [1540, -220],
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
      position: [1540, -20],
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
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1760, -220],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=🚨 *CRITICAL* Sentry\\n{{ $('If critical').first().json.title }}\\nLevel: {{ $('If critical').first().json.level }}\\nClassifier: {{ $('If critical').first().json.classifiedBy }} ({{ $('If critical').first().json.confidence }})\\nReason: {{ $('If critical').first().json.reason }}\\nLinear: {{ $json.identifier || $json.id || 'created' }}\\n{{ $('If critical').first().json.url || '' }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "fmt-normal-msg",
      name: "Format non-critical notification",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1760, -20],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            {
              name: "text",
              type: "string",
              value: "=⚠️ *Sentry issue*\\n{{ $('If critical').first().json.title }}\\nLevel: {{ $('If critical').first().json.level }}\\nClassifier: {{ $('If critical').first().json.classifiedBy }} ({{ $('If critical').first().json.confidence }})\\nReason: {{ $('If critical').first().json.reason }}\\nLinear: {{ $json.identifier || $json.id || 'created' }}\\n{{ $('If critical').first().json.url || '' }}",
            },
          ],
        },
        options: {},
      },
    },
    {
      id: "fmt-no-linear",
      name: "Format no-linear notification",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1320, 180],
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
      position: [1980, 0],
      parameters: {
        operation: "sendMessage",
        chatId: CHAT_ID || "={{ $env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID' }}",
        text: "={{ $json.text }}",
        additionalFields: { parse_mode: "Markdown" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
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
    "Normalize Sentry event": { main: [[{ node: "If OPENAI_API_KEY set", type: "main", index: 0 }]] },
    "If OPENAI_API_KEY set": {
      main: [
        [{ node: "OpenAI classify severity", type: "main", index: 0 }],
        [{ node: "Heuristic classify severity", type: "main", index: 0 }],
      ],
    },
    "OpenAI classify severity": { main: [[{ node: "Parse LLM result", type: "main", index: 0 }]] },
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

    "Format critical notification": { main: [[{ node: "Telegram: notify", type: "main", index: 0 }]] },
    "Format non-critical notification": { main: [[{ node: "Telegram: notify", type: "main", index: 0 }]] },
    "Format no-linear notification": { main: [[{ node: "Telegram: notify", type: "main", index: 0 }]] },

    "When clicking 'Test workflow'": { main: [[{ node: "Placeholder", type: "main", index: 0 }]] },
  },
  settings: {},
};

async function main() {
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
