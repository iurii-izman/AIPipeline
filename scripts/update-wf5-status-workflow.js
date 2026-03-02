#!/usr/bin/env node
/**
 * Update WF-5 workflow in n8n: Telegram Command Center.
 * Commands:
 *   /status, /help, /tasks[:project], /errors, /search <query>, /create|/task <title>,
 *   /spec <title>, /idea|/note <text>, /project [key], /projects, /progress[:project], /inbox[:project],
 *   /deploy <staging|production>, /standup[:project>
 * Requires: N8N_API_KEY, n8n running.
 */

const http = require("http");

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY;
const WF5_ID = "41jAGQw9qAMs52dN";
const APP_STATUS_URL = process.env.APP_STATUS_URL || "http://host.containers.internal:3000/status"; // NOSONAR: local bridge endpoint in host-only runtime
const DLQ_PARK_URL = process.env.DLQ_PARK_URL || "http://host.containers.internal:3000/dlq/park";

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

const HELP_TEXT = `📋 *AIPipeline Bot — команды*\n\n/status — статус пайплайна\n/help — список команд\n/tasks[:project] — открытые задачи (Linear)\n/errors — top-5 ошибок (Sentry)\n/search <query> — поиск в Notion\n/create <title> — создать задачу в Linear\n/task <title> — alias для /create\n/spec <title> — создать Notion spec\n/idea <text> — сохранить идею в Notion Inbox\n/note <text> — alias для /idea\n/project [key] — показать/сменить активный проект\n/projects — список проектов\n/progress[:project] — прогресс по state.type\n/inbox[:project] — новые Intake items\n/triage[:project] — показать следующий NEW intake item\n/deploy <staging|production> — запуск GitHub workflow\n/standup[:project] — дайджест по задачам\n/links[:project] — быстрые ссылки проекта\n/activity[:project] — последние обновления задач`;

const workflow = {
  name: "WF-5: Telegram Command Center (AIPipeline)",
  nodes: [
    {
      id: "tg-trigger",
      name: "Telegram Trigger",
      type: "n8n-nodes-base.telegramTrigger",
      typeVersion: 1.2,
      position: [0, 0],
      parameters: { updates: ["message", "callback_query"], additionalFields: {} },
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
        jsCode: `const db = $getWorkflowStaticData('global');
if (!db.projectContext) db.projectContext = {};
if (!db.intakeStore) db.intakeStore = {};

const callback = $json.callback_query || null;
const message = callback?.message || $json.message || {};
const from = callback?.from || $json.message?.from || {};
const hasDocument = Boolean(message.document?.file_id);
const hasVoice = Boolean(message.voice?.file_id);
const hasVideoNote = Boolean(message.video_note?.file_id);
const hasAudio = Boolean(message.audio?.file_id);
const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
const textRaw = String(message.text || message.caption || '').trim();
const [commandRawOriginal, ...rest] = textRaw.split(/\\s+/);
let commandRaw = String(commandRawOriginal || '').toLowerCase();
// Telegram group commands can arrive as /command@bot_username.
if (commandRaw.startsWith('/') && commandRaw.includes('@')) {
  commandRaw = commandRaw.replace(/@[^\\s:]+/g, '');
}
let args = rest.join(' ').trim();
let callbackAction = '';
let callbackShortId = '';
let callbackArg = '';

const attachmentParts = [];
if (hasDocument) attachmentParts.push('document:' + String(message.document?.file_name || message.document?.mime_type || message.document?.file_id || 'file'));
if (hasPhoto) attachmentParts.push('photo:' + String(message.photo?.[message.photo.length - 1]?.file_id || 'image'));
if (hasVoice) attachmentParts.push('voice:' + String(message.voice?.duration || 0) + 's');
if (hasVideoNote) attachmentParts.push('video_note:' + String(message.video_note?.duration || 0) + 's');
if (hasAudio) attachmentParts.push('audio:' + String(message.audio?.title || message.audio?.file_name || message.audio?.file_id || 'track'));
const attachmentSummary = attachmentParts.length ? ('Attachments: ' + attachmentParts.join(', ')) : '';
const inferredCaptureText = textRaw || attachmentSummary || '';

const primaryPhoto = hasPhoto ? message.photo[message.photo.length - 1] : null;
const primaryFileId = String(message.document?.file_id || message.voice?.file_id || message.audio?.file_id || message.video_note?.file_id || primaryPhoto?.file_id || '');
const primaryFileKind = hasDocument ? 'document' : (hasVoice ? 'voice' : (hasAudio ? 'audio' : (hasVideoNote ? 'video_note' : (hasPhoto ? 'photo' : ''))));
const forwardedFromName = String(message.forward_from?.username || message.forward_from?.first_name || message.forward_origin?.sender_user?.username || message.forward_origin?.sender_user?.first_name || message.forward_origin?.chat?.title || '');
const forwardedAt = String(message.forward_date || message.forward_origin?.date || '');
const isForwarded = Boolean(forwardedFromName || forwardedAt || message.forward_origin || message.forward_from);

if (callback) {
  const params = new URLSearchParams(String(callback.data || ''));
  callbackAction = String(params.get('a') || '').toUpperCase();
  callbackShortId = String(params.get('i') || '').trim();
  callbackArg = String(params.get('p') || '').trim();
  if (!callbackArg && callbackAction.startsWith('MOVE:')) {
    callbackArg = callbackAction.slice(5).trim();
    callbackAction = 'MOVE';
  }
  commandRaw = '/callback';
  args = '';
} else if (!commandRaw.startsWith('/')) {
  if (inferredCaptureText) {
    commandRaw = '/capture';
    args = inferredCaptureText;
  } else {
    commandRaw = '';
    args = '';
  }
}

let command = commandRaw;
if (command === '/task') command = '/create';
if (command === '/note') command = '/idea';
if (command === '/q') {
  const [quickVerbRaw, ...quickRest] = String(args || '').split(/\\s+/);
  const quickVerb = String(quickVerbRaw || '').trim().toLowerCase();
  const quickBody = quickRest.join(' ').trim();
  if (quickVerb === 'task' || quickVerb === 'todo' || quickVerb === 'bug') {
    command = '/create';
    args = quickBody;
  } else if (quickVerb === 'spec' || quickVerb === 'rfc') {
    command = '/spec';
    args = quickBody;
  } else if (quickVerb === 'idea' || quickVerb === 'note') {
    command = '/idea';
    args = quickBody;
  } else {
    command = '/capture';
    args = String(args || inferredCaptureText || '').trim();
  }
}

let projectHint = '';
if (command.includes(':')) {
  const idx = command.indexOf(':');
  projectHint = command.slice(idx + 1).trim();
  command = command.slice(0, idx);
}

const username = String(from.username || '');
const userId = String(from.id || '');
const chatId = String(message.chat?.id || callback?.message?.chat?.id || '');
const chatType = String(message.chat?.type || callback?.message?.chat?.type || '');
const messageId = String(message.message_id || '');
const threadId = String(message.message_thread_id || '');
const updateId = String($json.update_id || callback?.id || '');
const contextKey = chatId + ':' + userId;

let projects = [];
try {
  const parsed = JSON.parse(String($env.PROJECTS_CONFIG || '{"projects":[]}'));
  projects = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.projects) ? parsed.projects : []);
} catch {
  projects = [];
}
const byKey = new Map(projects.map((p) => [String(p.key || '').toLowerCase(), p]));
const byThread = new Map(projects.filter((p) => p.telegramThreadId !== undefined && p.telegramThreadId !== null && String(p.telegramThreadId || '').trim() !== '').map((p) => [String(p.telegramThreadId), p]));
const sticky = String(db.projectContext[contextKey] || '');
const threadProject = byThread.get(threadId);
let activeProject = null;
if (projectHint && byKey.has(projectHint.toLowerCase())) activeProject = byKey.get(projectHint.toLowerCase());
if (!activeProject && threadProject) activeProject = threadProject;
if (!activeProject && sticky && byKey.has(sticky.toLowerCase())) activeProject = byKey.get(sticky.toLowerCase());
if (!activeProject && $env.DEFAULT_PROJECT_KEY && byKey.has(String($env.DEFAULT_PROJECT_KEY).toLowerCase())) activeProject = byKey.get(String($env.DEFAULT_PROJECT_KEY).toLowerCase());
if (!activeProject && projects.length) activeProject = projects[0];

if (command === '/project' && args) {
  const key = args.trim().toLowerCase();
  if (byKey.has(key)) {
    db.projectContext[contextKey] = key;
    activeProject = byKey.get(key);
  }
}
if (callbackAction === 'PROJECT_SET' && callbackArg) {
  const key = callbackArg.trim().toLowerCase();
  if (byKey.has(key)) {
    db.projectContext[contextKey] = key;
    activeProject = byKey.get(key);
    callbackAction = 'PROJECT_SET';
  }
}

const normalizeTemplateId = (value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  const lowered = v.toLowerCase();
  if (lowered === 'none' || lowered === '__none__' || lowered === 'n/a') return '';
  return v;
};
const suggestAction = (text) => {
  const raw = String(text || '').toLowerCase();
  if (!raw) return 'IDEA';
  const specHints = ['spec', 'rfc', 'design', 'architecture', 'adr', 'proposal', 'дизайн', 'спека'];
  const taskHints = ['todo', 'task', 'fix', 'bug', 'issue', 'implement', 'add', 'надо', 'сделать', 'починить', 'задач'];
  if (specHints.some((hint) => raw.includes(hint))) return 'SPEC';
  if (taskHints.some((hint) => raw.includes(hint))) return 'TASK';
  return 'IDEA';
};

const projectKey = activeProject ? String(activeProject.key || '') : '';
const projectLabel = activeProject ? String(activeProject.label || projectKey) : '';
const notionInboxDatabaseId = String((activeProject && activeProject.notionInboxDatabaseId) || $env.NOTION_INBOX_DATABASE_ID || '');
const notionSpecsDatabaseId = String((activeProject && activeProject.notionSpecsDatabaseId) || $env.NOTION_SPECS_DATABASE_ID || '');
const notionSpecTemplateId = normalizeTemplateId((activeProject && activeProject.notionSpecTemplateId) || $env.NOTION_SPEC_TEMPLATE_ID || '');
const linearProjectId = String((activeProject && activeProject.linearProjectId) || '');
const linearTeamId = String((activeProject && activeProject.linearTeamId) || $env.LINEAR_TEAM_ID || '');

const shortId = args
  ? ('k' + Buffer.from(chatId + ':' + messageId + ':' + args.slice(0, 24)).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase())
  : '';
const suggestedAction = suggestAction(args || inferredCaptureText);
const artifactType = hasVoice || hasVideoNote ? 'Voice' : (hasDocument ? 'Document' : (hasPhoto ? 'Photo' : (hasAudio ? 'Audio' : 'Text')));

if (command === '/capture' && shortId) {
  db.intakeStore[shortId] = {
    id: shortId,
    chatId,
    messageId,
    threadId,
    text: args,
    projectKey,
    projectLabel,
    linearTeamId,
    linearProjectId,
    notionInboxDatabaseId,
    notionSpecsDatabaseId,
    notionSpecTemplateId,
    createdAt: Date.now(),
    createdBy: username || userId,
    source: 'telegram',
    status: 'new',
    artifactType,
    suggestedAction,
    attachmentSummary,
    primaryFileId,
    primaryFileKind,
    isForwarded,
    forwardedFromName,
    forwardedAt,
  };
}

let callbackItem = null;
if (callbackShortId && db.intakeStore[callbackShortId]) {
  callbackItem = db.intakeStore[callbackShortId];
}

const callbackItemText = String(callbackItem?.text || '');
const callbackTitle = String((callbackItemText || '').split('\\\\n')[0] || ('Inbox item ' + (callbackShortId || shortId || ''))).slice(0, 120);

return [{ json: {
  command,
  args,
  username,
  userId,
  chatId,
  chatType,
  messageId,
  updateId,
  raw: textRaw,
  threadId,
  callbackAction,
  callbackShortId,
  callbackArg,
  callbackQueryId: String(callback?.id || ''),
  callbackMessageId: String(callback?.message?.message_id || ''),
  callbackChatId: String(callback?.message?.chat?.id || ''),
  projectHint,
  projectKey,
  projectLabel,
  linearProjectId,
  linearTeamId,
  notionInboxDatabaseId,
  notionSpecsDatabaseId,
  notionSpecTemplateId,
  shortId,
  projects,
  stickyProjectKey: String(db.projectContext[contextKey] || ''),
  callbackItemText,
  callbackTitle,
  callbackItem,
  suggestedAction,
  artifactType,
  attachmentSummary,
  primaryFileId,
  primaryFileKind,
  isForwarded,
  forwardedFromName,
  forwardedAt,
} }];`,
      },
    },
    {
      id: "dedupe-command",
      name: "Deduplicate command",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [440, -120],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nif (!db.seen) db.seen = {};\nconst ttlMs = 7 * 24 * 60 * 60 * 1000;\nconst now = Date.now();\nfor (const [k, ts] of Object.entries(db.seen)) {\n  if (!Number.isFinite(ts) || (now - ts) > ttlMs) delete db.seen[k];\n}\nconst dedupeSuffix = $json.callbackQueryId || $json.messageId || $json.updateId || $json.raw || 'unknown';\nconst key = ($json.chatId || $json.callbackChatId || 'chat') + ':' + dedupeSuffix;\nconst seenAt = db.seen[key];\nif (seenAt && (now - seenAt) < ttlMs) {\n  return [{ json: { ...$json, isDuplicate: true, dedupeKey: key } }];\n}\ndb.seen[key] = now;\nreturn [{ json: { ...$json, isDuplicate: false, dedupeKey: key } }];`,
      },
    },
    {
      id: "if-command-duplicate",
      name: "If duplicate command",
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
      id: "if-callback-command",
      name: "If /callback",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [880, -200],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/callback", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "set-callback-summary",
      name: "Set callback summary",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1100, -200],
      parameters: {
        jsCode: `const action = String($json.callbackAction || 'UNKNOWN');\nconst shortId = String($json.callbackShortId || '');\nconst callbackArg = String($json.callbackArg || '');\nconst project = String($json.projectKey || callbackArg || 'all');\nconst text = action === 'PROJECT_SET'\n  ? ('✅ Active project set: *' + project + '*')\n  : (shortId\n    ? ('✅ Intake action: *' + action + '*\\nID: ' + shortId + '\\nProject: ' + project)\n    : ('⚠️ Callback payload is invalid.'));\nreturn [{ json: { ...$json, text } }];`,
      },
    },
    {
      id: "telegram-answer-callback",
      name: "Telegram: answer callback",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1320, -280],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "POST",
        url: "={{ 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/answerCallbackQuery' }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { callback_query_id: $('Extract command').first().json.callbackQueryId, text: (($('Extract command').first().json.callbackAction || 'Done') + ' ✅'), show_alert: false } }}",
        options: {},
      },
    },
    {
      id: "telegram-edit-callback",
      name: "Telegram: edit callback message",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1320, -120],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "POST",
        url: "={{ 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/editMessageText' }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { chat_id: $('Extract command').first().json.callbackChatId || $('Extract command').first().json.chatId, message_id: Number($('Extract command').first().json.callbackMessageId || $('Extract command').first().json.messageId || 0), text: $json.text || $('Set callback summary').first().json.text, parse_mode: 'Markdown' } }}",
        options: {},
      },
    },
    {
      id: "if-callback-task",
      name: "If callback TASK",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1100, -40],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.callbackAction }}", rightValue: "TASK", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "linear-callback-task",
      name: "Linear: callback create issue",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [1320, -20],
      parameters: {
        resource: "issue",
        operation: "create",
        title: "={{ $('Extract command').first().json.callbackTitle || ('Inbox item ' + $('Extract command').first().json.callbackShortId) }}",
        description:
          "=Created from Telegram callback action TASK\\n\\nProject: {{ $('Extract command').first().json.callbackItem?.projectKey || $('Extract command').first().json.projectKey || 'n/a' }}\\nShortId: {{ $('Extract command').first().json.callbackShortId || 'n/a' }}\\n\\n{{ $('Extract command').first().json.callbackItemText || '' }}",
        teamId: "={{ $('Extract command').first().json.callbackItem?.linearTeamId || $('Extract command').first().json.linearTeamId || $env.LINEAR_TEAM_ID }}",
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-callback-task",
      name: "Format callback TASK",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1540, -20],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  return [{ json: { text: '⚠️ Callback TASK failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nconst ctx = $('Extract command').first().json || {};\nconst db = $getWorkflowStaticData('global');\nconst sid = String(ctx.callbackShortId || '');\nconst ident = $json.identifier || $json.id || 'N/A';\nconst url = $json.url || '';\nif (sid && db.intakeStore && db.intakeStore[sid]) {\n  const item = db.intakeStore[sid];\n  item.status = 'triaged';\n  item.triagedAt = Date.now();\n  item.artifactType = 'Task';\n  item.linearIdentifier = String(ident);\n  item.linearUrl = String(url || item.linearUrl || '');\n}\nreturn [{ json: { text: '✅ Task created: ' + ident + (url ? ('\\n' + url) : '') } }];`,
      },
    },
    {
      id: "if-callback-spec",
      name: "If callback SPEC",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1320, 80],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.callbackAction }}", rightValue: "SPEC", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "notion-callback-spec",
      name: "Notion: callback create spec",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1540, 80],
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
        jsonBody:
          "={{ { parent: { database_id: $('Extract command').first().json.callbackItem?.notionSpecsDatabaseId || $('Extract command').first().json.notionSpecsDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: $('Extract command').first().json.callbackTitle || ('Spec ' + $('Extract command').first().json.callbackShortId) } } ] }, ...( $('Extract command').first().json.callbackItem?.projectKey || $('Extract command').first().json.projectKey ? { ProjectKey: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.callbackItem?.projectKey || $('Extract command').first().json.projectKey || '' } } ] } } : {} ) }, ...( ($('Extract command').first().json.callbackItem?.notionSpecTemplateId || $('Extract command').first().json.notionSpecTemplateId) ? { template: { type: 'template_id', template_id: $('Extract command').first().json.callbackItem?.notionSpecTemplateId || $('Extract command').first().json.notionSpecTemplateId } } : {} ) } }}",
        options: {},
      },
    },
    {
      id: "fmt-callback-spec",
      name: "Format callback SPEC",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1760, 80],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  return [{ json: { text: '⚠️ Callback SPEC failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nconst ctx = $('Extract command').first().json || {};\nconst db = $getWorkflowStaticData('global');\nconst sid = String(ctx.callbackShortId || '');\nconst url = String($json.url || '');\nif (sid && db.intakeStore && db.intakeStore[sid]) {\n  const item = db.intakeStore[sid];\n  item.status = 'triaged';\n  item.triagedAt = Date.now();\n  item.artifactType = 'Spec';\n  item.specUrl = String(url || item.specUrl || '');\n}\nreturn [{ json: { text: '✅ Spec created: ' + url } }];`,
      },
    },
    {
      id: "if-callback-idea",
      name: "If callback IDEA",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1540, 180],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.callbackAction }}", rightValue: "IDEA", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "notion-callback-idea",
      name: "Notion: callback create idea",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1760, 180],
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
        jsonBody:
          "={{ { parent: { database_id: $('Extract command').first().json.callbackItem?.notionInboxDatabaseId || $('Extract command').first().json.notionInboxDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: $('Extract command').first().json.callbackTitle || ('Idea ' + $('Extract command').first().json.callbackShortId) } } ] }, Status: { select: { name: 'New' } }, ProjectKey: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.callbackItem?.projectKey || $('Extract command').first().json.projectKey || '' } } ] }, Source: { select: { name: 'Telegram' } }, ArtifactType: { select: { name: 'Idea' } }, ShortId: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.callbackShortId || '' } } ] } }, children: [ { object: 'block', type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.callbackItemText || '' } } ] } } ] } }}",
        options: {},
      },
    },
    {
      id: "fmt-callback-idea",
      name: "Format callback IDEA",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1980, 180],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  return [{ json: { text: '⚠️ Callback IDEA failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nconst ctx = $('Extract command').first().json || {};\nconst db = $getWorkflowStaticData('global');\nconst sid = String(ctx.callbackShortId || '');\nconst url = String($json.url || '');\nif (sid && db.intakeStore && db.intakeStore[sid]) {\n  const item = db.intakeStore[sid];\n  item.status = 'triaged';\n  item.triagedAt = Date.now();\n  item.artifactType = 'Idea';\n  item.ideaUrl = String(url || item.ideaUrl || '');\n}\nreturn [{ json: { text: '✅ Idea saved: ' + url } }];`,
      },
    },
    {
      id: "if-callback-move",
      name: "If callback MOVE",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1760, 280],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.callbackAction }}", rightValue: "MOVE", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "set-callback-move",
      name: "Set callback MOVE",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1980, 280],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nconst sid = String($json.callbackShortId || '');\nconst targetKey = String($json.callbackArg || '').trim().toLowerCase();\nconst projects = Array.isArray($json.projects) ? $json.projects : [];\nconst target = projects.find((p) => String(p?.key || '').trim().toLowerCase() === targetKey) || null;\nif (!sid || !db.intakeStore || !db.intakeStore[sid]) {\n  return [{ json: { text: '⚠️ MOVE failed: intake item not found.' } }];\n}\nif (!targetKey) {\n  return [{ json: { text: '⚠️ MOVE failed: project key is missing.' } }];\n}\nif (!target) {\n  return [{ json: { text: '⚠️ MOVE failed: unknown project ' + targetKey + '.' } }];\n}\nconst normalizeTemplateId = (value) => {\n  const v = String(value || '').trim();\n  if (!v) return '';\n  const lowered = v.toLowerCase();\n  if (lowered === 'none' || lowered === '__none__' || lowered === 'n/a') return '';\n  return v;\n};\nconst item = db.intakeStore[sid];\nitem.projectKey = String(target.key || targetKey);\nitem.projectLabel = String(target.label || target.key || targetKey);\nitem.linearTeamId = String(target.linearTeamId || item.linearTeamId || '');\nitem.linearProjectId = String(target.linearProjectId || item.linearProjectId || '');\nitem.notionInboxDatabaseId = String(target.notionInboxDatabaseId || item.notionInboxDatabaseId || '');\nitem.notionSpecsDatabaseId = String(target.notionSpecsDatabaseId || item.notionSpecsDatabaseId || '');\nitem.notionSpecTemplateId = normalizeTemplateId(target.notionSpecTemplateId || item.notionSpecTemplateId || '');\nitem.updatedAt = Date.now();\nreturn [{ json: { text: '🗂 Moved intake item ' + sid + ' to *' + item.projectLabel + '* (' + item.projectKey + ')' } }];`,
      },
    },
    {
      id: "if-callback-archive",
      name: "If callback ARCHIVE",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1980, 380],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.callbackAction }}", rightValue: "ARCHIVE", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "set-callback-archive",
      name: "Set callback ARCHIVE",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2200, 380],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nconst sid = String($json.callbackShortId || '');\nif (sid && db.intakeStore && db.intakeStore[sid]) {\n  db.intakeStore[sid].status = 'archived';\n  db.intakeStore[sid].archivedAt = Date.now();\n}\nreturn [{ json: { text: sid ? ('✅ Archived intake item: ' + sid) : '✅ Archived.' } }];`,
      },
    },

    {
      id: "if-status",
      name: "If /status",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [880, 0],
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
      position: [1100, -320],
      parameters: { method: "GET", url: APP_STATUS_URL, options: {} },
    },
    {
      id: "fmt-status",
      name: "Format /status",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1320, -320],
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
      position: [1100, 0],
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
      position: [1320, -160],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: HELP_TEXT }), options: {} },
    },

    {
      id: "if-tasks",
      name: "If /tasks",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1320, 0],
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
      position: [1540, -320],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-tasks",
      name: "Format /tasks",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1760, -320],
      parameters: {
        jsCode: `const ctx = $('Extract command').first().json || {};\nconst username = String(ctx.username || '');\nconst projectKey = String(ctx.projectKey || '').toLowerCase();\nconst projectLabel = String(ctx.projectLabel || '').toLowerCase();\nconst projectId = String(ctx.linearProjectId || '').toLowerCase();\nconst rows = $input.all().map(i => i.json || {});\nconst err = rows.find(r => r.error)?.error || null;\nif (err) {\n  const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\n  const body = err.responseBody ?? err.body ?? err.data ?? '';\n  const detail = (typeof err.message === 'string' && err.message)\n    || (typeof err.description === 'string' && err.description)\n    || (typeof body === 'string' ? body : JSON.stringify(body))\n    || JSON.stringify(err);\n  const msg = String(detail).slice(0, 260);\n  const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);\n  return [{ json: { text: '⚠️ /tasks failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg } }];\n}\nconst filtered = rows.filter((i) => {\n  const stateType = String(i.state?.type || '').toLowerCase();\n  const stateName = String(i.state?.name || '').toLowerCase();\n  if (stateType === 'completed' || stateType === 'canceled' || ['done', 'cancelled', 'canceled'].includes(stateName)) return false;\n  if (projectKey || projectId) {\n    const issueProjectId = String(i.project?.id || '').toLowerCase();\n    const issueProjectName = String(i.project?.name || '').toLowerCase();\n    const issueProjectKey = String(i.project?.key || '').toLowerCase();\n    const projectMatches = (projectId && issueProjectId && projectId === issueProjectId)\n      || (projectKey && (projectKey === issueProjectName || projectKey === issueProjectKey))\n      || (projectLabel && issueProjectName && projectLabel === issueProjectName);\n    if (!projectMatches) return false;\n  }\n  if (!username) return true;\n  const assignee = String(i.assignee?.displayName || i.assignee?.name || i.assignee?.email || '').toLowerCase();\n  return assignee.includes(username.toLowerCase());\n});\nconst top = filtered.slice(0, 10);\nconst lines = top.map((i) => '• ' + (i.identifier || 'N/A') + ' — ' + i.title + ' [' + (i.state?.name || i.state?.type || 'N/A') + ']');\nconst suffix = filtered.length > top.length ? ('\\n… and ' + (filtered.length - top.length) + ' more') : '';\nconst scope = projectKey ? (' [' + projectKey + ']') : '';\nconst text = top.length\n  ? ('🧩 *Open tasks*' + scope + (username ? (' for @' + username) : '') + '\\n' + lines.join('\\n') + suffix)\n  : ('🧩 No open tasks' + scope + (username ? (' for @' + username) : '') + '.');\nreturn [{ json: { text } }];`,
      },
    },

    {
      id: "if-errors",
      name: "If /errors",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1540, 0],
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
      position: [1760, -80],
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
      position: [1980, -160],
      alwaysOutputData: true,
      continueOnFail: true,
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
      position: [2200, -160],
      parameters: {
        jsCode: `const items = $input.all().map(i => i.json || {});\nlet errors = [];\nlet apiError = '';\nlet apiStatus = 0;\nfor (const it of items) {\n  if (Array.isArray(it)) errors.push(...it);\n  else if (Array.isArray(it.data)) errors.push(...it.data);\n  else if (it.error) {\n    const err = it.error;\n    apiStatus = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\n    const body = err.responseBody ?? err.body ?? err.data ?? '';\n    apiError = (typeof err.message === 'string' && err.message)\n      || (typeof err.description === 'string' && err.description)\n      || (typeof body === 'string' ? body : JSON.stringify(body))\n      || 'Sentry request failed';\n  } else if (it.message && !Array.isArray(it.results)) {\n    apiError = String(it.message);\n  }\n}\nconst top = errors.slice(0, 5);\nconst lines = top.map(i => '• [' + (i.level || 'n/a') + '] ' + (i.title || 'Untitled') + '\\n  ' + (i.permalink || i.shortId || ''));\nlet text = top.length ? ('🚨 *Sentry top issues*\\n' + lines.join('\\n')) : '🚨 No unresolved Sentry issues.';\nif (apiError) {\n  const rateLimited = apiStatus === 429 || /429|rate\\s*limit|too many requests/i.test(String(apiStatus) + ' ' + apiError);\n  text += '\\n\\n⚠️ ' + (rateLimited ? 'Sentry API rate-limited: ' : '') + String(apiError).slice(0, 260);\n}\nreturn [{ json: { text } }];`,
      },
    },
    {
      id: "set-errors-missing-config",
      name: "Set /errors config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1980, 0],
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
      position: [1760, 120],
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
      position: [1980, 120],
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
      position: [2200, 40],
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
      position: [2420, 40],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\n  const body = err.responseBody ?? err.body ?? err.data ?? '';\n  const detail = (typeof err.message === 'string' && err.message)\n    || (typeof err.description === 'string' && err.description)\n    || (typeof body === 'string' ? body : JSON.stringify(body))\n    || JSON.stringify(err);\n  const msg = String(detail).slice(0, 260);\n  const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);\n  return [{ json: { text: '⚠️ /search failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg } }];\n}\nconst rows = ($json.results || []).slice(0, 5);\nconst titleOf = (r) => {\n  const p = r.properties || {};\n  for (const key of Object.keys(p)) {\n    if (p[key]?.type === 'title') {\n      return (p[key].title || []).map(t => t.plain_text).join('') || '(untitled)';\n    }\n  }\n  if (r.title && Array.isArray(r.title)) return r.title.map(t => t.plain_text).join('') || '(untitled)';\n  return '(untitled)';\n};\nconst lines = rows.map(r => '• ' + titleOf(r) + '\\n  ' + (r.url || ''));\nreturn [{ json: { text: lines.length ? ('🔎 *Notion search*\\n' + lines.join('\\n')) : '🔎 No Notion results.' } }];`,
      },
    },
    {
      id: "set-search-usage",
      name: "Set /search usage",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2200, 200],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: "Usage: /search <query>" }), options: {} },
    },
    {
      id: "if-project",
      name: "If /project",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1980, 280],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/project", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "set-project",
      name: "Set /project",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2200, 280],
      parameters: {
        jsCode: `const projects = Array.isArray($json.projects) ? $json.projects : [];\nconst projectKey = String($json.projectKey || '').trim();\nconst projectLabel = String($json.projectLabel || projectKey || 'none');\nconst rows = projects.map((p) => '• ' + p.key + ' — ' + (p.label || p.key));\nif (!$json.args) {\n  return [{ json: { text: '📌 Active project: *' + projectLabel + '*\\n' + (rows.length ? ('\\nProjects:\\n' + rows.join('\\n')) : '\\nNo projects configured.') } }];\n}\nconst req = String($json.args || '').trim().toLowerCase();\nconst hit = projects.find((p) => String(p.key || '').toLowerCase() === req);\nif (!hit) {\n  return [{ json: { text: '⚠️ Unknown project key: ' + req + '\\nUse /projects to list available keys.' } }];\n}\nreturn [{ json: { text: '✅ Active project set: *' + (hit.label || hit.key) + '* (' + hit.key + ')' } }];`,
      },
    },
    {
      id: "if-projects",
      name: "If /projects",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2200, 360],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/projects", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "set-projects",
      name: "Set /projects",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2420, 360],
      parameters: {
        jsCode: `const projects = Array.isArray($json.projects) ? $json.projects : [];\nif (!projects.length) return [{ json: { text: '📁 No projects configured. Add PROJECTS_CONFIG.' } }];\nconst current = String($json.projectKey || '').toLowerCase();\nconst lines = projects.map((p) => ((String(p.key || '').toLowerCase() === current ? '✅ ' : '• ') + p.key + ' — ' + (p.label || p.key)));\nconst keyboard = projects.slice(0, 12).map((p) => ([{ text: ((String(p.key || '').toLowerCase() === current ? '✅ ' : '') + String((p.emoji || '') ? (p.emoji + ' ') : '') + (p.label || p.key)).slice(0, 28), callback_data: 'a=PROJECT_SET&p=' + String(p.key || '') }])).filter((row) => String(row?.[0]?.callback_data || '').length <= 64);\nreturn [{ json: { text: '📁 *Projects*\\n' + lines.join('\\n'), replyMarkup: { inline_keyboard: keyboard } } }];`,
      },
    },
    {
      id: "if-links",
      name: "If /links",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2420, 440],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/links", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "set-links",
      name: "Set /links",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2640, 440],
      parameters: {
        jsCode: `const projects = Array.isArray($json.projects) ? $json.projects : [];\nconst key = String($json.projectKey || '').toLowerCase();\nconst active = projects.find((p) => String(p?.key || '').toLowerCase() === key) || null;\nif (!active) return [{ json: { text: '🔗 No active project links. Use /project <key>.' } }];\nconst links = active.links || {};\nconst lines = [\n  '🔗 *' + String(active.label || active.key || key) + '* links',\n  links.linear ? ('• Linear: ' + links.linear) : '',\n  links.notion ? ('• Notion: ' + links.notion) : '',\n  links.github ? ('• GitHub: ' + links.github) : '',\n  links.sentry ? ('• Sentry: ' + links.sentry) : '',\n  links.n8n ? ('• n8n: ' + links.n8n) : '',\n].filter(Boolean);\nreturn [{ json: { text: lines.join('\\n') } }];`,
      },
    },
    {
      id: "if-activity",
      name: "If /activity",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2640, 520],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/activity", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "linear-activity",
      name: "Linear: Get issues for /activity",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [2860, 520],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-activity",
      name: "Format /activity",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3080, 520],
      parameters: {
        jsCode: `const ctx = $('Extract command').first().json || {};\nconst rows = $input.all().map((i) => i.json || {});\nconst err = rows.find((r) => r.error)?.error || null;\nif (err) {\n  return [{ json: { text: '⚠️ /activity failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nconst projectKey = String(ctx.projectKey || '').toLowerCase();\nconst projectLabel = String(ctx.projectLabel || '').toLowerCase();\nconst projectId = String(ctx.linearProjectId || '').toLowerCase();\nconst filtered = rows.filter((it) => {\n  if (!projectKey && !projectId) return true;\n  const issueProjectId = String(it.project?.id || '').toLowerCase();\n  const issueProjectName = String(it.project?.name || '').toLowerCase();\n  const issueProjectKey = String(it.project?.key || '').toLowerCase();\n  return (projectId && issueProjectId && projectId === issueProjectId)\n    || (projectKey && (projectKey === issueProjectName || projectKey === issueProjectKey))\n    || (projectLabel && issueProjectName && projectLabel === issueProjectName);\n});\nconst sorted = filtered\n  .sort((a, b) => Date.parse(String(b.updatedAt || b.updated_at || b.completedAt || b.createdAt || 0)) - Date.parse(String(a.updatedAt || a.updated_at || a.completedAt || a.createdAt || 0)))\n  .slice(0, 8);\nconst lines = sorted.map((it) => {\n  const when = String(it.updatedAt || it.updated_at || it.completedAt || it.createdAt || '').slice(0, 16).replace('T', ' ');\n  return '• ' + (it.identifier || 'N/A') + ' — ' + (it.title || '(untitled)') + ' [' + (it.state?.name || it.state?.type || 'N/A') + ']' + (when ? ('\\n  ' + when) : '');\n});\nconst scope = projectKey ? (' [' + projectKey + ']') : '';\nreturn [{ json: { text: lines.length ? ('🕒 *Recent activity*' + scope + '\\n' + lines.join('\\n')) : ('🕒 No recent activity' + scope + '.') } }];`,
      },
    },
    {
      id: "if-progress",
      name: "If /progress",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2420, 280],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/progress", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "linear-progress",
      name: "Linear: Get issues for /progress",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [2640, 280],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-progress",
      name: "Format /progress",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2860, 280],
      parameters: {
        jsCode: `const ctx = $('Extract command').first().json || {};\nconst rows = $input.all().map(i => i.json || {});\nconst err = rows.find(r => r.error)?.error || null;\nif (err) {\n  const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\n  const msg = String(err.message || err.description || JSON.stringify(err)).slice(0, 260);\n  const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);\n  return [{ json: { text: '⚠️ /progress failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg } }];\n}\nconst projectKey = String(ctx.projectKey || '').toLowerCase();\nconst projectLabel = String(ctx.projectLabel || '').toLowerCase();\nconst projectId = String(ctx.linearProjectId || '').toLowerCase();\nconst filtered = rows.filter((it) => {\n  if (!projectKey && !projectId) return true;\n  const issueProjectId = String(it.project?.id || '').toLowerCase();\n  const issueProjectName = String(it.project?.name || '').toLowerCase();\n  const issueProjectKey = String(it.project?.key || '').toLowerCase();\n  return (projectId && issueProjectId && projectId === issueProjectId)\n    || (projectKey && (projectKey === issueProjectName || projectKey === issueProjectKey))\n    || (projectLabel && issueProjectName && projectLabel === issueProjectName);\n});\nconst byType = new Map();\nfor (const row of filtered) {\n  const key = String(row.state?.type || 'unknown');\n  byType.set(key, (byType.get(key) || 0) + 1);\n}\nconst done = Number(byType.get('completed') || 0);\nconst total = filtered.length;\nconst pct = total ? ((done / total) * 100).toFixed(1) : '0.0';\nconst lines = [...byType.entries()].map(([k,v]) => '• ' + k + ': ' + v);\nconst scope = projectKey ? (' [' + projectKey + ']') : '';\nreturn [{ json: { text: '📈 *Progress*' + scope + '\\nCompletion: ' + pct + '% (' + done + '/' + total + ')\\n' + (lines.join('\\n') || 'No issues') } }];`,
      },
    },
    {
      id: "if-inbox",
      name: "If /inbox",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2640, 360],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/inbox", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "if-inbox-config",
      name: "If /inbox env configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2860, 360],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.NOTION_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $json.notionInboxDatabaseId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }
          ],
          combinator: "and",
        },
      },
    },
    {
      id: "notion-inbox-query",
      name: "Notion: query Inbox",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3080, 300],
      parameters: {
        method: "POST",
        url: "={{ 'https://api.notion.com/v1/databases/' + $json.notionInboxDatabaseId + '/query' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.NOTION_TOKEN }}" },
            { name: "Notion-Version", value: "2025-09-03" },
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ (() => { const p = $('Extract command').first().json || {}; const filters = [ { property: 'Status', select: { equals: 'New' } } ]; if (p.projectKey) filters.push({ property: 'ProjectKey', rich_text: { contains: String(p.projectKey) } }); return { page_size: 5, filter: filters.length > 1 ? { and: filters } : filters[0], sorts: [{ timestamp: 'created_time', direction: 'descending' }] }; })() }}",
        options: {},
      },
    },
    {
      id: "fmt-inbox",
      name: "Format /inbox",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3300, 300],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  return [{ json: { text: '⚠️ /inbox failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nconst rows = Array.isArray($json.results) ? $json.results : [];\nconst titleOf = (r) => {\n  const p = r.properties || {};\n  for (const key of Object.keys(p)) {\n    if (p[key]?.type === 'title') return (p[key].title || []).map((x) => x.plain_text).join('') || '(untitled)';\n  }\n  return '(untitled)';\n};\nconst lines = rows.map((r) => '• ' + titleOf(r) + '\\n  ' + (r.url || ''));\nreturn [{ json: { text: lines.length ? ('📥 *Inbox (new)*\\n' + lines.join('\\n')) : '📥 Inbox is empty.' } }];`,
      },
    },
    {
      id: "set-inbox-config-missing",
      name: "Set /inbox config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3080, 420],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "⚠️ /inbox requires NOTION_TOKEN and notionInboxDatabaseId in project registry." }),
        options: {},
      },
    },
    {
      id: "if-triage",
      name: "If /triage",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2860, 440],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/triage", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "set-triage-next",
      name: "Set /triage next item",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3080, 440],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nconst store = db.intakeStore || {};\nconst projectKey = String($json.projectKey || '').trim().toLowerCase();\nconst items = Object.values(store)\n  .filter((it) => it && typeof it === 'object')\n  .filter((it) => String(it.status || 'new').toLowerCase() === 'new')\n  .filter((it) => !projectKey || String(it.projectKey || '').toLowerCase() === projectKey)\n  .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));\nconst next = items[0] || null;\nif (!next) return [{ json: { hasTriageItem: false } }];\nconst projectLabel = String(next.projectLabel || next.projectKey || 'n/a');\nconst summary = String(next.text || '').slice(0, 800);\nconst triageText = [\n  '🧹 *Triage*',\n  'ID: ' + String(next.id || ''),\n  'Project: *' + projectLabel + '*',\n  next.suggestedAction ? ('Suggested: *' + String(next.suggestedAction) + '*') : '',\n  next.artifactType ? ('Type: ' + String(next.artifactType)) : '',\n  '',\n  summary || '_empty_'\n].filter(Boolean).join('\\n');\nreturn [{ json: { hasTriageItem: true, triageItemId: String(next.id || ''), triageText, triageProjectKey: String(next.projectKey || '') } }];`,
      },
    },
    {
      id: "if-triage-found",
      name: "If /triage item found",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3300, 440],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.hasTriageItem }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
      },
    },
    {
      id: "telegram-triage-inline",
      name: "Telegram: triage actions",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3520, 400],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "POST",
        url: "={{ 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/sendMessage' }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { chat_id: $('Extract command').first().json.chatId, message_thread_id: Number($('Extract command').first().json.threadId || 0) || undefined, text: $json.triageText || 'Triage item', parse_mode: 'Markdown', reply_markup: { inline_keyboard: (() => { const sid = String($json.triageItemId || ''); const currentProject = String($json.triageProjectKey || '').toLowerCase(); const projects = Array.isArray($('Extract command').first().json.projects) ? $('Extract command').first().json.projects : []; const moveButtons = projects.filter((p) => String(p?.key || '').trim().toLowerCase() && String(p?.key || '').trim().toLowerCase() !== currentProject).slice(0, 3).map((p) => ({ text: '🗂 ' + String(p.label || p.key || '').slice(0, 20), callback_data: 'a=MOVE&i=' + sid + '&p=' + String(p.key || '') })).filter((btn) => String(btn.callback_data || '').length <= 64); const rows = [ [ { text: '✅ Task', callback_data: 'a=TASK&i=' + sid }, { text: '🧾 Spec', callback_data: 'a=SPEC&i=' + sid } ], [ { text: '💡 Idea', callback_data: 'a=IDEA&i=' + sid }, { text: '💤 Archive', callback_data: 'a=ARCHIVE&i=' + sid } ] ]; if (moveButtons.length) rows.push(moveButtons); return rows; })() } } }}",
        options: {},
      },
    },
    {
      id: "set-triage-empty",
      name: "Set /triage empty",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3520, 520],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "🧹 Inbox triage complete: no NEW intake items." }),
        options: {},
      },
    },
    {
      id: "if-idea",
      name: "If /idea",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2860, 520],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/idea", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-idea-config",
      name: "If /idea env configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3080, 520],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.NOTION_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $json.notionInboxDatabaseId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }
          ],
          combinator: "and",
        },
      },
    },
    {
      id: "notion-idea-create",
      name: "Notion: create idea",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3300, 460],
      parameters: {
        method: "POST",
        url: "https://api.notion.com/v1/pages",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.NOTION_TOKEN }}" },
            { name: "Notion-Version", value: "2025-09-03" },
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { parent: { database_id: $('Extract command').first().json.notionInboxDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: (($('Extract command').first().json.args || '').slice(0, 80) || 'Inbox item') } } ] }, Status: { select: { name: 'New' } }, ProjectKey: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.projectKey || '' } } ] }, Source: { select: { name: 'Telegram' } }, ArtifactType: { select: { name: 'Idea' } }, ShortId: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.shortId || '' } } ] } }, children: [ { object: 'block', type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.args || '' } } ] } } ] } }}",
        options: {},
      },
    },
    {
      id: "fmt-idea",
      name: "Format /idea",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3520, 460],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  return [{ json: { text: '⚠️ /idea failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nreturn [{ json: { text: '💡 Idea saved: ' + String($json.url || '') } }];`,
      },
    },
    {
      id: "set-idea-config-missing",
      name: "Set /idea config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3300, 580],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "⚠️ /idea requires NOTION_TOKEN and notionInboxDatabaseId in project registry." }),
        options: {},
      },
    },
    {
      id: "if-spec",
      name: "If /spec",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3080, 680],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/spec", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-spec-config",
      name: "If /spec env configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3300, 680],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.NOTION_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $json.notionSpecsDatabaseId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }
          ],
          combinator: "and",
        },
      },
    },
    {
      id: "notion-spec-create",
      name: "Notion: create spec",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3520, 620],
      parameters: {
        method: "POST",
        url: "https://api.notion.com/v1/pages",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.NOTION_TOKEN }}" },
            { name: "Notion-Version", value: "2025-09-03" },
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { parent: { database_id: $('Extract command').first().json.notionSpecsDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: (($('Extract command').first().json.args || '').slice(0, 120) || 'Spec draft') } } ] }, ProjectKey: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.projectKey || '' } } ] } }, ...( $('Extract command').first().json.notionSpecTemplateId ? { template: { type: 'template_id', template_id: $('Extract command').first().json.notionSpecTemplateId } } : {} ) } }}",
        options: {},
      },
    },
    {
      id: "fmt-spec",
      name: "Format /spec",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3740, 620],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  return [{ json: { text: '⚠️ /spec failed: ' + String(err.message || err.description || JSON.stringify(err)).slice(0, 260) } }];\n}\nreturn [{ json: { text: '🧾 Spec created: ' + String($json.url || '') } }];`,
      },
    },
    {
      id: "set-spec-config-missing",
      name: "Set /spec config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3520, 760],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "⚠️ /spec requires NOTION_TOKEN and notionSpecsDatabaseId in project registry." }),
        options: {},
      },
    },
    {
      id: "if-capture",
      name: "If /capture",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3300, 860],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/capture", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-capture-config",
      name: "If /capture env configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3520, 860],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.NOTION_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $json.notionInboxDatabaseId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $env.TELEGRAM_BOT_TOKEN || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }
          ],
          combinator: "and",
        },
      },
    },
    {
      id: "if-capture-ai-config",
      name: "If /capture AI configured",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3740, 860],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [
            { leftValue: "={{ $env.OPENAI_API_KEY || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
            { leftValue: "={{ $json.args || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
          ],
          combinator: "and",
        },
      },
    },
    {
      id: "openai-capture-classify",
      name: "OpenAI: classify capture",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3960, 740],
      continueOnFail: true,
      alwaysOutputData: true,
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
        jsonBody:
          "={{ { model: ($env.OPENAI_MODEL_INTAKE_CLASSIFIER || 'gpt-4o-mini'), temperature: 0, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: 'Classify intake text. Return compact JSON: {\"action\":\"TASK|SPEC|IDEA\",\"confidence\":0..1}. No extra keys.' }, { role: 'user', content: String($('Extract command').first().json.args || '').slice(0, 1200) } ] } }}",
        options: {},
      },
    },
    {
      id: "parse-capture-ai-action",
      name: "Parse capture AI action",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [4180, 740],
      parameters: {
        jsCode: `const fallback = String($('Extract command').first().json.suggestedAction || 'IDEA').toUpperCase();\nconst db = $getWorkflowStaticData('global');\nconst sid = String($('Extract command').first().json.shortId || '');\nlet action = fallback;\nlet confidence = 0;\nlet suggestedBy = 'heuristic';\nconst err = $json.error || null;\nif (!err) {\n  try {\n    const content = String($json.choices?.[0]?.message?.content || '{}');\n    const parsed = JSON.parse(content);\n    const raw = String(parsed.action || '').toUpperCase().trim();\n    if (['TASK', 'SPEC', 'IDEA'].includes(raw)) action = raw;\n    confidence = Number(parsed.confidence || 0);\n    suggestedBy = 'openai';\n  } catch {\n    // keep fallback\n  }\n}\nconst cleanConfidence = Number.isFinite(confidence) ? confidence : 0;\nif (sid && db.intakeStore && db.intakeStore[sid]) {\n  db.intakeStore[sid].suggestedAction = action;\n  db.intakeStore[sid].suggestedBy = suggestedBy;\n  db.intakeStore[sid].suggestedConfidence = cleanConfidence;\n}\nreturn [{ json: { ...$('Extract command').first().json, suggestedAction: action, suggestedBy, suggestedConfidence: cleanConfidence } }];`,
      },
    },
    {
      id: "if-capture-has-file",
      name: "If /capture has file",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [4400, 860],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.primaryFileId || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "telegram-capture-get-file",
      name: "Telegram: get capture file",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [4620, 760],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "GET",
        url: "={{ 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/getFile?file_id=' + encodeURIComponent(String($json.primaryFileId || '')) }}",
        options: {},
      },
    },
    {
      id: "app-ingest-capture-file",
      name: "App: ingest capture file",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [4840, 700],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "POST",
        url: "={{ ($env.INTAKE_INGEST_URL || 'http://host.containers.internal:3000/intake/telegram-file') }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ ($env.INTAKE_INGEST_TOKEN || $env.DLQ_INGEST_TOKEN) ? ('Bearer ' + ($env.INTAKE_INGEST_TOKEN || $env.DLQ_INGEST_TOKEN)) : '' }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { filePath: String($('Telegram: get capture file').first().json.result?.file_path || ''), fileName: String($('Extract command').first().json.attachmentSummary || ''), shortId: String($('Extract command').first().json.shortId || '') } }}",
        options: {},
      },
    },
    {
      id: "notion-capture-create-with-file",
      name: "Notion: capture inbox item (with file)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [4840, 760],
      parameters: {
        method: "POST",
        url: "https://api.notion.com/v1/pages",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.NOTION_TOKEN }}" },
            { name: "Notion-Version", value: "2025-09-03" },
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ (() => { const ctx = $('Extract command').first().json; const fp = String($('Telegram: get capture file').first().json.result?.file_path || ''); const fallbackFileUrl = fp ? ('https://api.telegram.org/file/bot' + $env.TELEGRAM_BOT_TOKEN + '/' + fp) : ''; const appUrl = String($('App: ingest capture file').first().json.publicUrl || ''); const appBase = String($env.INTAKE_PUBLIC_BASE_URL || '').replace(/\\/$/, ''); const storedFileUrl = appUrl ? (appBase ? (appBase + appUrl) : appUrl) : ''; const fileUrl = storedFileUrl || fallbackFileUrl; const body = (ctx.args || '') + '\\n\\nShortId: ' + (ctx.shortId || '') + (ctx.attachmentSummary ? ('\\n' + ctx.attachmentSummary) : '') + (fileUrl ? ('\\nStored file: ' + fileUrl) : ''); return { parent: { database_id: ctx.notionInboxDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: ((ctx.args || '').slice(0, 80) || 'Inbox item') } } ] }, Status: { select: { name: 'New' } }, ProjectKey: { rich_text: [ { type: 'text', text: { content: ctx.projectKey || '' } } ] }, Source: { select: { name: 'Telegram' } }, ShortId: { rich_text: [ { type: 'text', text: { content: ctx.shortId || '' } } ] }, ArtifactType: { select: { name: ctx.artifactType || 'Text' } } }, children: [ { object: 'block', type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content: body } } ] } } ] }; })() }}",
        options: {},
      },
    },
    {
      id: "notion-capture-create",
      name: "Notion: capture inbox item",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [4840, 940],
      parameters: {
        method: "POST",
        url: "https://api.notion.com/v1/pages",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Authorization", value: "={{ 'Bearer ' + $env.NOTION_TOKEN }}" },
            { name: "Notion-Version", value: "2025-09-03" },
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { parent: { database_id: $json.notionInboxDatabaseId || $('Extract command').first().json.notionInboxDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: (($json.args || $('Extract command').first().json.args || '').slice(0, 80) || 'Inbox item') } } ] }, Status: { select: { name: 'New' } }, ProjectKey: { rich_text: [ { type: 'text', text: { content: $json.projectKey || $('Extract command').first().json.projectKey || '' } } ] }, Source: { select: { name: 'Telegram' } }, ShortId: { rich_text: [ { type: 'text', text: { content: $json.shortId || $('Extract command').first().json.shortId || '' } } ] }, ArtifactType: { select: { name: $json.artifactType || $('Extract command').first().json.artifactType || 'Text' } } }, children: [ { object: 'block', type: 'paragraph', paragraph: { rich_text: [ { type: 'text', text: { content: (($json.args || $('Extract command').first().json.args || '')) + '\\n\\nShortId: ' + ($json.shortId || $('Extract command').first().json.shortId || '') + ((($json.attachmentSummary || $('Extract command').first().json.attachmentSummary || '')) ? ('\\n' + ($json.attachmentSummary || $('Extract command').first().json.attachmentSummary || '')) : '') } } ] } } ] } }}",
        options: {},
      },
    },
    {
      id: "set-capture-routing",
      name: "Set capture routing context",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [5060, 920],
      parameters: {
        jsCode: `const db = $getWorkflowStaticData('global');\nconst ctx = $('Extract command').first().json || {};\nconst sid = String(ctx.shortId || '');\nconst item = (sid && db.intakeStore && db.intakeStore[sid]) ? db.intakeStore[sid] : {};\nreturn [{ json: { ...ctx, inboxUrl: String($json.url || ''), suggestedAction: String(item.suggestedAction || ctx.suggestedAction || 'IDEA').toUpperCase(), suggestedBy: String(item.suggestedBy || 'heuristic'), suggestedConfidence: Number(item.suggestedConfidence || 0) } }];`,
      },
    },
    {
      id: "decide-capture-auto-convert",
      name: "Decide capture auto-convert",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [5280, 920],
      parameters: {
        jsCode: `const j = $json || {};\nconst enabled = /^(1|true|yes|on)$/i.test(String($env.INTAKE_AUTO_CONVERT || 'false'));\nconst thresholdRaw = Number($env.INTAKE_AUTO_CONVERT_CONFIDENCE || 0.9);\nconst threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.9;\nconst action = String(j.suggestedAction || 'IDEA').toUpperCase();\nconst confidence = Number(j.suggestedConfidence || 0);\nconst autoConvert = enabled && j.suggestedBy === 'openai' && confidence >= threshold && (action === 'TASK' || action === 'SPEC');\nreturn [{ json: { ...j, autoConvert, autoConvertAction: action, autoConvertThreshold: threshold } }];`,
      },
    },
    {
      id: "if-capture-auto-convert",
      name: "If /capture auto-convert",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [5500, 920],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.autoConvert }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-capture-auto-task",
      name: "If auto action TASK",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [5720, 860],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.autoConvertAction }}", rightValue: "TASK", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "linear-capture-auto-task",
      name: "Linear: capture auto task",
      type: "n8n-nodes-base.linear",
      typeVersion: 1,
      position: [5940, 820],
      parameters: {
        resource: "issue",
        operation: "create",
        title: "={{ String(($('Extract command').first().json.args || 'Inbox item')).split('\\n')[0].slice(0, 140) || 'Inbox item' }}",
        description: "={{ 'Auto-converted from Telegram intake\\n\\nProject: ' + ($('Extract command').first().json.projectKey || 'n/a') + '\\nShortId: ' + ($('Extract command').first().json.shortId || 'n/a') + '\\nInbox: ' + ($('Set capture routing context').first().json.inboxUrl || '') + '\\n\\n' + ($('Extract command').first().json.args || '') }}",
        teamId: "={{ $('Extract command').first().json.linearTeamId || $env.LINEAR_TEAM_ID }}",
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-capture-auto-task",
      name: "Format capture auto TASK",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [6160, 820],
      parameters: {
        jsCode: `if ($json.error) {\n  return [{ json: { text: '⚠️ Auto-convert TASK failed: ' + String($json.error.message || $json.error.description || JSON.stringify($json.error)).slice(0, 260) } }];\n}\nconst url = String($json.url || '');\nconst id = String($json.identifier || $json.id || 'N/A');\nconst inbox = String($('Set capture routing context').first().json.inboxUrl || '');\nreturn [{ json: { text: '🤖 Auto-converted to TASK (' + Number($('Decide capture auto-convert').first().json.suggestedConfidence || 0).toFixed(2) + ')\\nLinear: ' + id + (url ? ('\\n' + url) : '') + (inbox ? ('\\nInbox: ' + inbox) : '') } }];`,
      },
    },
    {
      id: "notion-capture-auto-spec",
      name: "Notion: capture auto spec",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [5940, 980],
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
        jsonBody: "={{ { parent: { database_id: $('Extract command').first().json.notionSpecsDatabaseId }, properties: { Name: { title: [ { type: 'text', text: { content: String(($('Extract command').first().json.args || 'Spec')).split('\\n')[0].slice(0, 120) || 'Spec' } } ] }, ProjectKey: { rich_text: [ { type: 'text', text: { content: $('Extract command').first().json.projectKey || '' } } ] } }, ...( $('Extract command').first().json.notionSpecTemplateId ? { template: { type: 'template_id', template_id: $('Extract command').first().json.notionSpecTemplateId } } : {} ) } }}",
        options: {},
      },
    },
    {
      id: "fmt-capture-auto-spec",
      name: "Format capture auto SPEC",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [6160, 980],
      parameters: {
        jsCode: `if ($json.error) {\n  return [{ json: { text: '⚠️ Auto-convert SPEC failed: ' + String($json.error.message || $json.error.description || JSON.stringify($json.error)).slice(0, 260) } }];\n}\nconst specUrl = String($json.url || '');\nconst inbox = String($('Set capture routing context').first().json.inboxUrl || '');\nreturn [{ json: { text: '🤖 Auto-converted to SPEC (' + Number($('Decide capture auto-convert').first().json.suggestedConfidence || 0).toFixed(2) + ')\\nSpec: ' + specUrl + (inbox ? ('\\nInbox: ' + inbox) : '') } }];`,
      },
    },
    {
      id: "telegram-capture-inline",
      name: "Telegram: capture actions",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [5060, 820],
      continueOnFail: true,
      alwaysOutputData: true,
      parameters: {
        method: "POST",
        url: "={{ 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/sendMessage' }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ { chat_id: $('Extract command').first().json.chatId, message_thread_id: Number($('Extract command').first().json.threadId || 0) || undefined, text: '✅ Captured to Inbox (`' + (($json.shortId || $('Extract command').first().json.shortId || '')) + '`)\\nSuggested: *' + (($json.suggestedAction || $('Extract command').first().json.suggestedAction || 'IDEA')) + '*\\nType: ' + (($json.artifactType || $('Extract command').first().json.artifactType || 'Text')), parse_mode: 'Markdown', reply_markup: { inline_keyboard: (() => { const sid = String(($json.shortId || $('Extract command').first().json.shortId || '')); const currentProject = String(($json.projectKey || $('Extract command').first().json.projectKey || '')).toLowerCase(); const projects = Array.isArray(($json.projects || $('Extract command').first().json.projects)) ? ($json.projects || $('Extract command').first().json.projects) : []; const moveButtons = projects.filter((p) => String(p?.key || '').trim().toLowerCase() && String(p?.key || '').trim().toLowerCase() !== currentProject).slice(0, 3).map((p) => ({ text: '🗂 ' + String(p.label || p.key || '').slice(0, 20), callback_data: 'a=MOVE&i=' + sid + '&p=' + String(p.key || '') })).filter((btn) => String(btn.callback_data || '').length <= 64); const rows = [ [ { text: '✅ Task', callback_data: 'a=TASK&i=' + sid }, { text: '🧾 Spec', callback_data: 'a=SPEC&i=' + sid } ], [ { text: '💡 Idea', callback_data: 'a=IDEA&i=' + sid }, { text: '💤 Archive', callback_data: 'a=ARCHIVE&i=' + sid } ] ]; if (moveButtons.length) rows.push(moveButtons); return rows; })() } } }}",
        options: {},
      },
    },
    {
      id: "set-capture-config-missing",
      name: "Set /capture config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3740, 940],
      parameters: {
        mode: "raw",
        jsonOutput: JSON.stringify({ text: "⚠️ Intake capture requires NOTION_TOKEN + notionInboxDatabaseId + TELEGRAM_BOT_TOKEN." }),
        options: {},
      },
    },

    {
      id: "authorize-privileged-command",
      name: "Authorize privileged command",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2200, 440],
      parameters: {
        jsCode: `const current = $json || {};\nconst command = String(current.command || '').toLowerCase();\nconst toSet = (input) => new Set(String(input || '').split(',').map((x) => x.trim()).filter(Boolean));\nconst privileged = toSet($env.WF5_PRIVILEGED_COMMANDS || '/deploy,/create');\nif (!privileged.has(command)) {\n  return [{ json: { ...current, privilegedCommand: false, privilegedAuthorized: true, privilegedReason: 'not privileged' } }];\n}\nconst allowedChats = toSet($env.WF5_RBAC_ALLOWED_CHAT_IDS || $env.TELEGRAM_CHAT_ID || '');\nconst allowedUsers = toSet($env.WF5_RBAC_ALLOWED_USER_IDS || '');\nconst allowedNames = toSet(String($env.WF5_RBAC_ALLOWED_USERNAMES || '').toLowerCase());\nconst chatId = String(current.chatId || '');\nconst userId = String(current.userId || '');\nconst username = String(current.username || '').toLowerCase();\nconst authorized = (chatId && allowedChats.has(chatId))\n  || (userId && allowedUsers.has(userId))\n  || (username && allowedNames.has(username));\nif (authorized) {\n  return [{ json: { ...current, privilegedCommand: true, privilegedAuthorized: true, privilegedReason: 'allowlist matched' } }];\n}\nconst detail = [\n  '🚫 Command blocked by RBAC policy.',\n  'Command: ' + command,\n  chatId ? ('chatId: ' + chatId) : 'chatId: unknown',\n  userId ? ('userId: ' + userId) : 'userId: unknown',\n  username ? ('username: @' + username) : 'username: unknown',\n  'Configure allowlists: WF5_RBAC_ALLOWED_CHAT_IDS / WF5_RBAC_ALLOWED_USER_IDS / WF5_RBAC_ALLOWED_USERNAMES'\n].join('\\\\n');\nreturn [{ json: { ...current, privilegedCommand: true, privilegedAuthorized: false, privilegedReason: detail, text: detail } }];`,
      },
    },
    {
      id: "if-privileged-authorized",
      name: "If privileged authorized",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2420, 440],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.privilegedAuthorized }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
      },
    },
    {
      id: "if-privileged-is-create",
      name: "If privileged route is /create",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2640, 440],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $json.command }}", rightValue: "/create", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
      },
    },
    {
      id: "set-rbac-denied",
      name: "Set RBAC denied",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2860, 640],
      parameters: {
        mode: "manual",
        assignments: { assignments: [{ name: "text", type: "string", value: "={{ $json.text || '🚫 Command blocked by RBAC policy.' }}" }] },
        options: {},
      },
    },
    {
      id: "if-create",
      name: "If /create",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [1980, 320],
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
      position: [3080, 320],
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
      position: [3300, 240],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{ leftValue: "={{ $('Extract command').first().json.linearTeamId || $env.LINEAR_TEAM_ID || '' }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } }],
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
      position: [3520, 160],
      parameters: {
        resource: "issue",
        operation: "create",
        title: "={{ $('Extract command').first().json.args }}",
        description: "=Created from Telegram /create by @{{ $('Extract command').first().json.username || 'unknown' }}",
        teamId: "={{ $('Extract command').first().json.linearTeamId || $env.LINEAR_TEAM_ID }}",
      },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-create",
      name: "Format /create",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3740, 160],
      parameters: {
        jsCode: `if ($json.error) {\n  const err = $json.error;\n  const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\n  const body = err.responseBody ?? err.body ?? err.data ?? '';\n  const detail = (typeof err.message === 'string' && err.message)\n    || (typeof err.description === 'string' && err.description)\n    || (typeof body === 'string' ? body : JSON.stringify(body))\n    || JSON.stringify(err);\n  const msg = String(detail).slice(0, 260);\n  const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);\n  return [{ json: { text: '⚠️ /create failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg } }];\n}\nconst issue = $json;\nconst ident = issue.identifier || issue.id || 'N/A';\nconst url = issue.url || issue.permalink || '';\nreturn [{ json: { text: '✅ Created Linear issue: ' + ident + '\\n' + url } }];`,
      },
    },
    {
      id: "set-create-missing-team",
      name: "Set /create config missing",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3520, 320],
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
      position: [3300, 400],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: "Usage: /create <title>" }), options: {} },
    },

    {
      id: "if-deploy",
      name: "If /deploy",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [2200, 560],
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
      position: [3080, 560],
      parameters: {
        jsCode: `const envArg = (($('Extract command').first().json.args || '').trim().toLowerCase() || 'staging');\nif (!['staging', 'production'].includes(envArg)) {\n  return [{ json: { valid: false, text: 'Usage: /deploy <staging|production>' } }];\n}\nif (!$env.GITHUB_PERSONAL_ACCESS_TOKEN) {\n  return [{ json: { valid: false, text: '⚠️ /deploy requires GITHUB_PERSONAL_ACCESS_TOKEN in n8n env.' } }];\n}\nconst workflow = envArg === 'production'\n  ? ($env.GITHUB_WORKFLOW_PRODUCTION || 'deploy-production.yml')\n  : ($env.GITHUB_WORKFLOW_STAGING || 'deploy-staging.yml');\nconst ref = envArg === 'production'\n  ? ($env.GITHUB_REF_PRODUCTION || 'main')\n  : ($env.GITHUB_REF_STAGING || 'main');\nreturn [{ json: { valid: true, env: envArg, workflow, ref } }];`,
      },
    },
    {
      id: "if-deploy-valid",
      name: "If deploy payload valid",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3300, 560],
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
      position: [3520, 480],
      continueOnFail: true,
      alwaysOutputData: true,
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
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3740, 480],
      parameters: {
        jsCode: `const p = $('Prepare deploy payload').first().json;\nconst err = $json.error || null;\nif (!err) {\n  return [{ json: { text: '🚀 Deploy dispatched: *' + p.env + '*\\\\nWorkflow: ' + p.workflow + '\\\\nRef: ' + p.ref } }];\n}\nconst status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\nconst body = err.responseBody ?? err.body ?? err.data ?? '';\nconst detail = (typeof err.message === 'string' && err.message)\n  || (typeof err.description === 'string' && err.description)\n  || (typeof body === 'string' ? body : JSON.stringify(body))\n  || JSON.stringify(err);\nconst msg = String(detail).slice(0, 260);\nconst rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);\nreturn [{ json: { text: '⚠️ Deploy failed for *' + p.env + '*\\\\nWorkflow: ' + p.workflow + '\\\\nRef: ' + p.ref + '\\\\n' + (rateLimited ? '(rate-limited) ' : '') + msg } }];`,
      },
    },
    {
      id: "set-deploy-usage",
      name: "Set /deploy usage",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [3520, 640],
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
      position: [2420, 760],
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
      position: [2860, 760],
      parameters: { resource: "issue", operation: "getAll", returnAll: true },
      credentials: { linearApi: { name: "AIPipeline Linear" } },
    },
    {
      id: "fmt-standup",
      name: "Format /standup",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3080, 760],
      parameters: {
        jsCode: `const ctx = $('Extract command').first().json || {};\nconst rows = $input.all().map(i => i.json || {});\nconst err = rows.find(r => r.error)?.error || null;\nif (err) {\n  const status = Number(err.statusCode ?? err.status ?? err.httpCode ?? err.code ?? 0);\n  const body = err.responseBody ?? err.body ?? err.data ?? '';\n  const detail = (typeof err.message === 'string' && err.message)\n    || (typeof err.description === 'string' && err.description)\n    || (typeof body === 'string' ? body : JSON.stringify(body))\n    || JSON.stringify(err);\n  const msg = String(detail).slice(0, 260);\n  const rateLimited = status === 429 || /429|rate\\s*limit|too many requests/i.test(String(status) + ' ' + msg);\n  return [{ json: { text: '⚠️ /standup failed' + (rateLimited ? ' (rate-limited)' : '') + ': ' + msg } }];\n}\nconst projectKey = String(ctx.projectKey || '').toLowerCase();\nconst projectLabel = String(ctx.projectLabel || '').toLowerCase();\nconst projectId = String(ctx.linearProjectId || '').toLowerCase();\nconst filtered = rows.filter((it) => {\n  if (!projectKey && !projectId) return true;\n  const issueProjectId = String(it.project?.id || '').toLowerCase();\n  const issueProjectName = String(it.project?.name || '').toLowerCase();\n  const issueProjectKey = String(it.project?.key || '').toLowerCase();\n  return (projectId && issueProjectId && projectId === issueProjectId)\n    || (projectKey && (projectKey === issueProjectName || projectKey === issueProjectKey))\n    || (projectLabel && issueProjectName && projectLabel === issueProjectName);\n});\nconst buckets = new Map();\nfor (const it of filtered) {\n  const key = it.state?.type || it.state?.name || 'Other';\n  buckets.set(key, (buckets.get(key) || 0) + 1);\n}\nconst lines = [...buckets.entries()].map(([k,v]) => '• ' + k + ': ' + v);\nconst scope = projectKey ? (' [' + projectKey + ']') : '';\nconst text = '📝 *Standup digest*' + scope + '\\nDate: ' + new Date().toISOString().slice(0,10) + '\\n' + (lines.join('\\n') || 'No issues');\nreturn [{ json: { text } }];`,
      },
    },

    {
      id: "set-unknown",
      name: "Set unknown command",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [2860, 920],
      parameters: { mode: "raw", jsonOutput: JSON.stringify({ text: "Unknown command. Use /help." }), options: {} },
    },

    {
      id: "telegram-send",
      name: "Telegram Send",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [3320, 320],
      parameters: {
        operation: "sendMessage",
        chatId: "={{ $('Extract command').first().json.chatId || $('Extract command').first().json.callbackChatId }}",
        text: "={{ $json.text || JSON.stringify($json, null, 2) }}",
        additionalFields: { parse_mode: "Markdown", replyMarkup: "={{ $json.replyMarkup ? JSON.stringify($json.replyMarkup) : undefined }}" },
      },
      credentials: { telegramApi: { name: "AIPipeline Telegram" } },
    },
    {
      id: "assess-telegram-send",
      name: "Assess Telegram command delivery",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [3540, 320],
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
      id: "if-telegram-send-failed",
      name: "If Telegram command delivery failed",
      type: "n8n-nodes-base.if",
      typeVersion: 2.3,
      position: [3760, 320],
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
      id: "dlq-park-wf5-telegram",
      name: "DLQ: park WF-5 Telegram failure",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3980, 320],
      parameters: {
        method: "POST",
        url: DLQ_PARK_URL,
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: "Authorization", value: "={{ $env.DLQ_INGEST_TOKEN ? ('Bearer ' + $env.DLQ_INGEST_TOKEN) : '' }}" }],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ { sourceWorkflow: 'WF-5', failureType: 'telegram_send_failed', reason: $('Assess Telegram command delivery').first().json.reason || 'unknown error', rateLimited: $('Assess Telegram command delivery').first().json.rateLimited || false, context: $('Extract command').first().json } }}",
        options: {},
      },
    },
  ],
  connections: {
    "Telegram Trigger": { main: [[{ node: "Extract command", type: "main", index: 0 }]] },
    "Extract command": { main: [[{ node: "Deduplicate command", type: "main", index: 0 }]] },
    "Deduplicate command": { main: [[{ node: "If duplicate command", type: "main", index: 0 }]] },
    "If duplicate command": { main: [[], [{ node: "If /callback", type: "main", index: 0 }]] },
    "If /callback": { main: [[{ node: "If callback TASK", type: "main", index: 0 }], [{ node: "If /status", type: "main", index: 0 }]] },
    "If callback TASK": { main: [[{ node: "Linear: callback create issue", type: "main", index: 0 }], [{ node: "If callback SPEC", type: "main", index: 0 }]] },
    "Linear: callback create issue": { main: [[{ node: "Format callback TASK", type: "main", index: 0 }]] },
    "Format callback TASK": { main: [[{ node: "Telegram: answer callback", type: "main", index: 0 }, { node: "Telegram: edit callback message", type: "main", index: 0 }]] },
    "If callback SPEC": { main: [[{ node: "Notion: callback create spec", type: "main", index: 0 }], [{ node: "If callback IDEA", type: "main", index: 0 }]] },
    "Notion: callback create spec": { main: [[{ node: "Format callback SPEC", type: "main", index: 0 }]] },
    "Format callback SPEC": { main: [[{ node: "Telegram: answer callback", type: "main", index: 0 }, { node: "Telegram: edit callback message", type: "main", index: 0 }]] },
    "If callback IDEA": { main: [[{ node: "Notion: callback create idea", type: "main", index: 0 }], [{ node: "If callback MOVE", type: "main", index: 0 }]] },
    "Notion: callback create idea": { main: [[{ node: "Format callback IDEA", type: "main", index: 0 }]] },
    "Format callback IDEA": { main: [[{ node: "Telegram: answer callback", type: "main", index: 0 }, { node: "Telegram: edit callback message", type: "main", index: 0 }]] },
    "If callback MOVE": { main: [[{ node: "Set callback MOVE", type: "main", index: 0 }], [{ node: "If callback ARCHIVE", type: "main", index: 0 }]] },
    "Set callback MOVE": { main: [[{ node: "Telegram: answer callback", type: "main", index: 0 }, { node: "Telegram: edit callback message", type: "main", index: 0 }]] },
    "If callback ARCHIVE": { main: [[{ node: "Set callback ARCHIVE", type: "main", index: 0 }], [{ node: "Set callback summary", type: "main", index: 0 }]] },
    "Set callback ARCHIVE": { main: [[{ node: "Telegram: answer callback", type: "main", index: 0 }, { node: "Telegram: edit callback message", type: "main", index: 0 }]] },
    "Set callback summary": { main: [[{ node: "Telegram: answer callback", type: "main", index: 0 }, { node: "Telegram: edit callback message", type: "main", index: 0 }]] },

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

    "If /search": { main: [[{ node: "If /search has query", type: "main", index: 0 }], [{ node: "If /project", type: "main", index: 0 }]] },
    "If /search has query": { main: [[{ node: "Notion: search", type: "main", index: 0 }], [{ node: "Set /search usage", type: "main", index: 0 }]] },
    "Notion: search": { main: [[{ node: "Format /search", type: "main", index: 0 }]] },
    "Format /search": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /search usage": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /project": { main: [[{ node: "Set /project", type: "main", index: 0 }], [{ node: "If /projects", type: "main", index: 0 }]] },
    "Set /project": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /projects": { main: [[{ node: "Set /projects", type: "main", index: 0 }], [{ node: "If /links", type: "main", index: 0 }]] },
    "Set /projects": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /links": { main: [[{ node: "Set /links", type: "main", index: 0 }], [{ node: "If /activity", type: "main", index: 0 }]] },
    "Set /links": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /activity": { main: [[{ node: "Linear: Get issues for /activity", type: "main", index: 0 }], [{ node: "If /progress", type: "main", index: 0 }]] },
    "Linear: Get issues for /activity": { main: [[{ node: "Format /activity", type: "main", index: 0 }]] },
    "Format /activity": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /progress": { main: [[{ node: "Linear: Get issues for /progress", type: "main", index: 0 }], [{ node: "If /inbox", type: "main", index: 0 }]] },
    "Linear: Get issues for /progress": { main: [[{ node: "Format /progress", type: "main", index: 0 }]] },
    "Format /progress": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /inbox": { main: [[{ node: "If /inbox env configured", type: "main", index: 0 }], [{ node: "If /triage", type: "main", index: 0 }]] },
    "If /inbox env configured": { main: [[{ node: "Notion: query Inbox", type: "main", index: 0 }], [{ node: "Set /inbox config missing", type: "main", index: 0 }]] },
    "Notion: query Inbox": { main: [[{ node: "Format /inbox", type: "main", index: 0 }]] },
    "Format /inbox": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /inbox config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /triage": { main: [[{ node: "Set /triage next item", type: "main", index: 0 }], [{ node: "If /idea", type: "main", index: 0 }]] },
    "Set /triage next item": { main: [[{ node: "If /triage item found", type: "main", index: 0 }]] },
    "If /triage item found": { main: [[{ node: "Telegram: triage actions", type: "main", index: 0 }], [{ node: "Set /triage empty", type: "main", index: 0 }]] },
    "Telegram: triage actions": { main: [[{ node: "Assess Telegram command delivery", type: "main", index: 0 }]] },
    "Set /triage empty": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /idea": { main: [[{ node: "If /idea env configured", type: "main", index: 0 }], [{ node: "If /spec", type: "main", index: 0 }]] },
    "If /idea env configured": { main: [[{ node: "Notion: create idea", type: "main", index: 0 }], [{ node: "Set /idea config missing", type: "main", index: 0 }]] },
    "Notion: create idea": { main: [[{ node: "Format /idea", type: "main", index: 0 }]] },
    "Format /idea": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /idea config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /spec": { main: [[{ node: "If /spec env configured", type: "main", index: 0 }], [{ node: "If /capture", type: "main", index: 0 }]] },
    "If /spec env configured": { main: [[{ node: "Notion: create spec", type: "main", index: 0 }], [{ node: "Set /spec config missing", type: "main", index: 0 }]] },
    "Notion: create spec": { main: [[{ node: "Format /spec", type: "main", index: 0 }]] },
    "Format /spec": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /spec config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "If /capture": { main: [[{ node: "If /capture env configured", type: "main", index: 0 }], [{ node: "If /create", type: "main", index: 0 }]] },
    "If /capture env configured": { main: [[{ node: "If /capture AI configured", type: "main", index: 0 }], [{ node: "Set /capture config missing", type: "main", index: 0 }]] },
    "If /capture AI configured": { main: [[{ node: "OpenAI: classify capture", type: "main", index: 0 }], [{ node: "If /capture has file", type: "main", index: 0 }]] },
    "OpenAI: classify capture": { main: [[{ node: "Parse capture AI action", type: "main", index: 0 }]] },
    "Parse capture AI action": { main: [[{ node: "If /capture has file", type: "main", index: 0 }]] },
    "If /capture has file": { main: [[{ node: "Telegram: get capture file", type: "main", index: 0 }], [{ node: "Notion: capture inbox item", type: "main", index: 0 }]] },
    "Telegram: get capture file": { main: [[{ node: "App: ingest capture file", type: "main", index: 0 }]] },
    "App: ingest capture file": { main: [[{ node: "Notion: capture inbox item (with file)", type: "main", index: 0 }]] },
    "Notion: capture inbox item (with file)": { main: [[{ node: "Set capture routing context", type: "main", index: 0 }]] },
    "Notion: capture inbox item": { main: [[{ node: "Set capture routing context", type: "main", index: 0 }]] },
    "Set capture routing context": { main: [[{ node: "Decide capture auto-convert", type: "main", index: 0 }]] },
    "Decide capture auto-convert": { main: [[{ node: "If /capture auto-convert", type: "main", index: 0 }]] },
    "If /capture auto-convert": { main: [[{ node: "If auto action TASK", type: "main", index: 0 }], [{ node: "Telegram: capture actions", type: "main", index: 0 }]] },
    "If auto action TASK": { main: [[{ node: "Linear: capture auto task", type: "main", index: 0 }], [{ node: "Notion: capture auto spec", type: "main", index: 0 }]] },
    "Linear: capture auto task": { main: [[{ node: "Format capture auto TASK", type: "main", index: 0 }]] },
    "Format capture auto TASK": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Notion: capture auto spec": { main: [[{ node: "Format capture auto SPEC", type: "main", index: 0 }]] },
    "Format capture auto SPEC": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Telegram: capture actions": { main: [[{ node: "Assess Telegram command delivery", type: "main", index: 0 }]] },
    "Set /capture config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /create": { main: [[{ node: "Authorize privileged command", type: "main", index: 0 }], [{ node: "If /deploy", type: "main", index: 0 }]] },
    "Authorize privileged command": { main: [[{ node: "If privileged authorized", type: "main", index: 0 }]] },
    "If privileged authorized": { main: [[{ node: "If privileged route is /create", type: "main", index: 0 }], [{ node: "Set RBAC denied", type: "main", index: 0 }]] },
    "If privileged route is /create": { main: [[{ node: "If /create has title", type: "main", index: 0 }], [{ node: "Prepare deploy payload", type: "main", index: 0 }]] },
    "If /create has title": { main: [[{ node: "If LINEAR_TEAM_ID set", type: "main", index: 0 }], [{ node: "Set /create usage", type: "main", index: 0 }]] },
    "If LINEAR_TEAM_ID set": { main: [[{ node: "Linear: Create issue", type: "main", index: 0 }], [{ node: "Set /create config missing", type: "main", index: 0 }]] },
    "Linear: Create issue": { main: [[{ node: "Format /create", type: "main", index: 0 }]] },
    "Format /create": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /create config missing": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /create usage": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set RBAC denied": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /deploy": { main: [[{ node: "Authorize privileged command", type: "main", index: 0 }], [{ node: "If /standup", type: "main", index: 0 }]] },
    "Prepare deploy payload": { main: [[{ node: "If deploy payload valid", type: "main", index: 0 }]] },
    "If deploy payload valid": { main: [[{ node: "GitHub: dispatch workflow", type: "main", index: 0 }], [{ node: "Set /deploy usage", type: "main", index: 0 }]] },
    "GitHub: dispatch workflow": { main: [[{ node: "Set /deploy ok", type: "main", index: 0 }]] },
    "Set /deploy ok": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set /deploy usage": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "If /standup": { main: [[{ node: "Linear: Get issues for /standup", type: "main", index: 0 }], [{ node: "Set unknown command", type: "main", index: 0 }]] },
    "Linear: Get issues for /standup": { main: [[{ node: "Format /standup", type: "main", index: 0 }]] },
    "Format /standup": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },
    "Set unknown command": { main: [[{ node: "Telegram Send", type: "main", index: 0 }]] },

    "Telegram Send": { main: [[{ node: "Assess Telegram command delivery", type: "main", index: 0 }]] },
    "Assess Telegram command delivery": { main: [[{ node: "If Telegram command delivery failed", type: "main", index: 0 }]] },
    "If Telegram command delivery failed": { main: [[{ node: "DLQ: park WF-5 Telegram failure", type: "main", index: 0 }], []] },
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
  const updated = await request("PUT", `/api/v1/workflows/${WF5_ID}`, workflow);
  console.log("WF-5 updated.", updated.id, updated.name);
  console.log("Next: open n8n UI, verify credentials (Telegram/Linear), activate if needed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
