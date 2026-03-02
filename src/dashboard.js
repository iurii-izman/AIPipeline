const { loadProjectRegistry, getProjectByKey, resolveDefaultProject } = require("./projectRegistry.js");
const { getLocalRuntimeStatus } = require("./local-ops.js");

const CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 60_000);
const cache = new Map();

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function percent(done, total) {
  if (!total) return "0.0";
  return ((done / total) * 100).toFixed(1);
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeStateFilter(value) {
  const safe = String(value || "all").trim().toLowerCase();
  if (["all", "open", "started", "completed", "canceled"].includes(safe)) return safe;
  return "all";
}

function normalizeDashboardOptions(optionsOrProjectKey) {
  if (typeof optionsOrProjectKey === "string") {
    return {
      projectKey: optionsOrProjectKey,
      stateFilter: "all",
      query: "",
      taskLimit: 10,
      inboxLimit: 8,
      activityLimit: 8,
      actionsEnabled: false,
    };
  }

  const options = optionsOrProjectKey || {};
  return {
    projectKey: String(options.projectKey || ""),
    stateFilter: normalizeStateFilter(options.stateFilter),
    query: String(options.query || options.q || "").trim(),
    taskLimit: clampInt(options.taskLimit, 1, 50, 10),
    inboxLimit: clampInt(options.inboxLimit, 1, 25, 8),
    activityLimit: clampInt(options.activityLimit, 1, 25, 8),
    actionsEnabled: options.actionsEnabled === true,
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  return { ok: response.ok, status: response.status, payload };
}

function notionErrorDetail(response) {
  return (
    response?.payload?.message ||
    response?.payload?.error ||
    response?.payload?.code ||
    `Notion request failed (${response?.status || 0})`
  );
}

async function fetchLinearIssues(projectId) {
  const apiKey = process.env.LINEAR_API_KEY || "";
  if (!apiKey) return { rows: [], error: "LINEAR_API_KEY is not configured" };

  const baseQuery =
    "query($first:Int!){issues(first:$first){nodes{id identifier title url updatedAt state{name type} project{id name}}}}";
  const filteredQuery =
    "query($first:Int!,$projectId:ID!){issues(first:$first, filter:{project:{id:{eq:$projectId}}}){nodes{id identifier title url updatedAt state{name type} project{id name}}}}";
  const hasProject = Boolean(projectId);

  const response = await requestJson("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: hasProject ? filteredQuery : baseQuery,
      variables: hasProject ? { first: 200, projectId } : { first: 200 },
    }),
  });

  if (!response.ok || response.payload?.errors?.length) {
    const detail = response.payload?.errors?.[0]?.message || `Linear request failed (${response.status})`;
    return { rows: [], error: detail };
  }

  const rows = Array.isArray(response.payload?.data?.issues?.nodes) ? response.payload.data.issues.nodes : [];
  return { rows, error: "" };
}

async function notionRequestWithFallbacks(databaseId, payload, token) {
  const endpoints = [
    `https://api.notion.com/v1/data-sources/${databaseId}/query`,
    `https://api.notion.com/v1/databases/${databaseId}/query`,
  ];

  let lastError = "";
  for (const endpoint of endpoints) {
    const response = await requestJson(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": process.env.NOTION_VERSION || "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });

    if (response.ok) {
      return {
        ok: true,
        rows: Array.isArray(response.payload?.results) ? response.payload.results : [],
      };
    }
    lastError = notionErrorDetail(response);
    if (response.status === 401 || response.status === 403) {
      return { ok: false, rows: [], error: `Notion request failed (${response.status}): ${lastError}` };
    }
  }

  return { ok: false, rows: [], error: lastError || "Notion request failed" };
}

async function fetchNotionRows(databaseId, payload = {}) {
  const token = process.env.NOTION_TOKEN || "";
  if (!token || !databaseId) return { rows: [], error: "" };
  const response = await notionRequestWithFallbacks(databaseId, payload, token);
  return { rows: response.rows || [], error: response.ok ? "" : `Notion request failed: ${response.error}` };
}

async function fetchNotionInboxRows(databaseId, projectKey, pageSize) {
  if (!process.env.NOTION_TOKEN || !databaseId) return { rows: [], error: "" };

  const hasProject = Boolean(projectKey && projectKey.trim());
  const statusSelect = { property: "Status", select: { equals: "New" } };
  const statusStatus = { property: "Status", status: { equals: "New" } };
  const projectFilter = { property: "ProjectKey", rich_text: { equals: projectKey } };
  const filters = [
    hasProject ? { and: [statusSelect, projectFilter] } : statusSelect,
    statusSelect,
    hasProject ? { and: [statusStatus, projectFilter] } : statusStatus,
    statusStatus,
    null,
  ];

  let lastError = "";
  for (const filter of filters) {
    const payload = {
      page_size: pageSize,
      ...(filter ? { filter } : {}),
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    };
    const response = await fetchNotionRows(databaseId, payload);
    if (!response.error) return { rows: response.rows, error: "" };
    lastError = response.error;
    if (/401|403/.test(lastError)) return { rows: [], error: `Notion inbox request failed: ${lastError}` };
  }

  if (String(lastError).toLowerCase().includes("invalid request url")) return { rows: [], error: "" };
  return { rows: [], error: `Notion inbox request failed: ${lastError || "unknown error"}` };
}

function matchStateFilter(row, stateFilter) {
  const type = String(row?.state?.type || "").toLowerCase();
  if (stateFilter === "all") return true;
  if (stateFilter === "open") return !["started", "completed", "canceled"].includes(type);
  return type === stateFilter;
}

function sortByUpdatedDesc(rows) {
  return rows.slice().sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));
}

function buildLinearSummary(rows, stateFilter, taskLimit) {
  const buckets = {
    completed: 0,
    started: 0,
    canceled: 0,
    open: 0,
  };

  for (const row of rows) {
    const type = String(row?.state?.type || "").toLowerCase();
    if (type === "completed") buckets.completed += 1;
    else if (type === "started") buckets.started += 1;
    else if (type === "canceled") buckets.canceled += 1;
    else buckets.open += 1;
  }

  const filtered = sortByUpdatedDesc(rows.filter((row) => matchStateFilter(row, stateFilter)));
  const total = rows.length;
  const done = buckets.completed;

  return {
    total,
    done,
    percent: percent(done, total),
    buckets,
    filteredCount: filtered.length,
    stateFilter,
    topTasks: filtered.slice(0, taskLimit),
  };
}

function titleFromNotionRow(row) {
  const properties = row?.properties || {};
  for (const key of Object.keys(properties)) {
    const prop = properties[key];
    if (prop?.type !== "title") continue;
    const title = Array.isArray(prop.title) ? prop.title.map((entry) => String(entry?.plain_text || "")).join("") : "";
    return title || "(untitled)";
  }
  return "(untitled)";
}

function rowRichTextValue(row, propertyName) {
  const prop = row?.properties?.[propertyName];
  if (!prop) return "";
  if (prop.type === "rich_text") {
    return Array.isArray(prop.rich_text) ? prop.rich_text.map((entry) => String(entry?.plain_text || "")).join("") : "";
  }
  if (prop.type === "title") {
    return Array.isArray(prop.title) ? prop.title.map((entry) => String(entry?.plain_text || "")).join("") : "";
  }
  if (prop.type === "select") return String(prop.select?.name || "");
  if (prop.type === "status") return String(prop.status?.name || "");
  return "";
}

function rowSummaryText(row) {
  const title = titleFromNotionRow(row);
  const status = rowRichTextValue(row, "Status");
  const project = rowRichTextValue(row, "ProjectKey");
  return [title, status, project].filter(Boolean).join(" | ");
}

function aggregateProjectsSummary(projects, rows) {
  return projects.map((project) => {
    const byProject = rows.filter((row) => {
      const rowProjectId = String(row?.project?.id || "");
      if (project.linearProjectId) return rowProjectId === String(project.linearProjectId);
      return false;
    });

    const done = byProject.filter((row) => String(row?.state?.type || "") === "completed").length;
    const started = byProject.filter((row) => String(row?.state?.type || "") === "started").length;

    return {
      key: project.key,
      label: project.label,
      emoji: project.emoji,
      total: byProject.length,
      done,
      started,
      percent: percent(done, byProject.length),
    };
  });
}

function buildActivityFeed(topTasks, inboxRows, activityLimit) {
  const taskEvents = topTasks.map((row) => ({
    ts: String(row?.updatedAt || ""),
    label: `Task ${row?.identifier || "N/A"}: ${row?.title || "(untitled)"}`,
    url: row?.url || "#",
    kind: "task",
  }));

  const inboxEvents = inboxRows.map((row) => ({
    ts: String(row?.last_edited_time || row?.created_time || ""),
    label: `Inbox: ${titleFromNotionRow(row)}`,
    url: row?.url || "#",
    kind: "inbox",
  }));

  return taskEvents
    .concat(inboxEvents)
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    .slice(0, activityLimit);
}

function buildDashboardHref(options, overrides = {}) {
  const merged = { ...options, ...overrides };
  const params = new URLSearchParams();
  if (merged.projectKey) params.set("project", merged.projectKey);
  if (merged.query) params.set("q", merged.query);
  if (merged.stateFilter && merged.stateFilter !== "all") params.set("state", merged.stateFilter);
  if (merged.taskLimit !== 10) params.set("tasks", String(merged.taskLimit));
  if (merged.inboxLimit !== 8) params.set("inbox", String(merged.inboxLimit));
  if (merged.activityLimit !== 8) params.set("activity", String(merged.activityLimit));
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function parseLinearIssueCreate(responsePayload) {
  const issue = responsePayload?.data?.issueCreate?.issue || null;
  if (!issue) return null;
  return {
    id: String(issue.id || ""),
    identifier: String(issue.identifier || ""),
    url: String(issue.url || ""),
    title: String(issue.title || ""),
  };
}

async function createLinearIssueForDashboard({ project, title, body }) {
  const apiKey = process.env.LINEAR_API_KEY || "";
  if (!apiKey) return { ok: false, error: "LINEAR_API_KEY is not configured" };
  if (!project?.linearTeamId) return { ok: false, error: `linearTeamId is missing for project '${project?.key || "unknown"}'` };

  const mutation =
    "mutation($input: IssueCreateInput!){issueCreate(input:$input){success issue{id identifier url title}}}";
  const response = await requestJson("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          title: String(title || "Inbox item"),
          description: String(body || ""),
          teamId: String(project.linearTeamId),
          ...(project.linearProjectId ? { projectId: String(project.linearProjectId) } : {}),
        },
      },
    }),
  });

  if (!response.ok || response.payload?.errors?.length) {
    const detail = response.payload?.errors?.[0]?.message || `Linear issueCreate failed (${response.status})`;
    return { ok: false, error: detail };
  }

  const created = parseLinearIssueCreate(response.payload);
  if (!created) return { ok: false, error: "Linear issueCreate returned no issue" };
  return {
    ok: true,
    id: created.id || created.identifier,
    artifactUrl: created.url,
    artifactTitle: created.identifier || created.title || "Linear issue",
  };
}

async function notionCreatePageWithFallback({ databaseId, projectKey, title, body, source, artifactType }) {
  const token = process.env.NOTION_TOKEN || "";
  if (!token) return { ok: false, error: "NOTION_TOKEN is not configured" };
  if (!databaseId) return { ok: false, error: "Notion database id is required" };

  const titleContent = String(title || "Inbox item").slice(0, 120);
  const paragraphBody = String(body || "");
  const baseChildren = paragraphBody
    ? [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: paragraphBody.slice(0, 1900) } }],
          },
        },
      ]
    : [];

  const variants = [
    {
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ type: "text", text: { content: titleContent } }] },
        ...(projectKey ? { ProjectKey: { rich_text: [{ type: "text", text: { content: String(projectKey) } }] } } : {}),
        ...(source ? { Source: { select: { name: String(source) } } } : {}),
        ...(artifactType ? { ArtifactType: { select: { name: String(artifactType) } } } : {}),
      },
      ...(baseChildren.length ? { children: baseChildren } : {}),
    },
    {
      parent: { database_id: databaseId },
      properties: {
        Title: { title: [{ type: "text", text: { content: titleContent } }] },
      },
      ...(baseChildren.length ? { children: baseChildren } : {}),
    },
  ];

  let lastError = "";
  for (const payload of variants) {
    const response = await requestJson("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": process.env.NOTION_VERSION || "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      return { ok: true, id: String(response.payload?.id || ""), artifactUrl: String(response.payload?.url || "") };
    }
    lastError = notionErrorDetail(response);
  }

  return { ok: false, error: `Notion create page failed: ${lastError}` };
}

async function notionUpdateStatusWithFallback(pageId, statusValue) {
  const token = process.env.NOTION_TOKEN || "";
  if (!token) return { ok: false, error: "NOTION_TOKEN is not configured" };
  if (!pageId) return { ok: false, error: "notion page id is required" };

  const variants = [{ Status: { status: { name: statusValue } } }, { Status: { select: { name: statusValue } } }];
  let lastError = "";
  for (const properties of variants) {
    const response = await requestJson(`https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": process.env.NOTION_VERSION || "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });
    if (response.ok) return { ok: true, updatedStatus: statusValue };
    lastError = notionErrorDetail(response);
  }

  return { ok: false, error: `Notion update status failed: ${lastError}` };
}

function normalizeSearchOptions(options = {}) {
  return {
    q: String(options.q || options.query || "").trim(),
    projectKey: String(options.projectKey || options.project || "").trim(),
    limit: clampInt(options.limit, 1, 100, 25),
  };
}

async function searchDashboard(options = {}) {
  const normalized = normalizeSearchOptions(options);
  if (!normalized.q) return { ok: true, results: [] };

  const registry = loadProjectRegistry();
  const selectedProject = getProjectByKey(registry, normalized.projectKey) || (!normalized.projectKey ? resolveDefaultProject(registry) : null);
  const q = normalized.q.toLowerCase();

  const notionInboxDatabaseId = (selectedProject && selectedProject.notionInboxDatabaseId) || process.env.NOTION_INBOX_DATABASE_ID || "";
  const notionSpecsDatabaseId = (selectedProject && selectedProject.notionSpecsDatabaseId) || process.env.NOTION_SPECS_DATABASE_ID || "";

  const [linear, inbox, specs] = await Promise.all([
    fetchLinearIssues(selectedProject?.linearProjectId || ""),
    fetchNotionRows(notionInboxDatabaseId, { page_size: Math.max(normalized.limit * 2, 30) }),
    fetchNotionRows(notionSpecsDatabaseId, { page_size: Math.max(normalized.limit * 2, 30) }),
  ]);

  const results = [];
  for (const issue of linear.rows || []) {
    const blob = [issue.identifier, issue.title, issue.state?.name, issue.project?.name].join(" ").toLowerCase();
    if (!blob.includes(q)) continue;
    results.push({
      source: "linear",
      id: String(issue.id || issue.identifier || ""),
      title: String(issue.title || "(untitled)"),
      subtitle: String(issue.identifier || "issue"),
      url: String(issue.url || ""),
      projectKey: String(selectedProject?.key || issue.project?.name || ""),
      updatedAt: String(issue.updatedAt || ""),
    });
  }
  for (const row of inbox.rows || []) {
    const title = titleFromNotionRow(row);
    if (![title, rowSummaryText(row)].join(" ").toLowerCase().includes(q)) continue;
    results.push({
      source: "notion-inbox",
      id: String(row?.id || ""),
      title,
      subtitle: "Inbox",
      url: String(row?.url || ""),
      projectKey: String(selectedProject?.key || rowRichTextValue(row, "ProjectKey") || ""),
      updatedAt: String(row?.last_edited_time || row?.created_time || ""),
    });
  }
  for (const row of specs.rows || []) {
    const title = titleFromNotionRow(row);
    if (![title, rowSummaryText(row)].join(" ").toLowerCase().includes(q)) continue;
    results.push({
      source: "notion-spec",
      id: String(row?.id || ""),
      title,
      subtitle: "Spec",
      url: String(row?.url || ""),
      projectKey: String(selectedProject?.key || rowRichTextValue(row, "ProjectKey") || ""),
      updatedAt: String(row?.last_edited_time || row?.created_time || ""),
    });
  }

  const sorted = results.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).slice(0, normalized.limit);
  return { ok: true, results: sorted, warnings: [linear.error, inbox.error, specs.error].filter(Boolean) };
}

async function createDashboardArtifact(options = {}) {
  const type = String(options.type || "").trim().toLowerCase();
  const title = String(options.title || "").trim();
  const body = String(options.body || "").trim();
  if (!title) return { ok: false, error: "title is required" };
  if (!["task", "spec", "idea", "note"].includes(type)) return { ok: false, error: "type must be one of: task, spec, idea, note" };

  const registry = loadProjectRegistry();
  const project = getProjectByKey(registry, options.projectKey) || resolveDefaultProject(registry);
  if (!project) return { ok: false, error: "project is not configured" };

  if (type === "task") {
    return createLinearIssueForDashboard({
      project,
      title,
      body: body || `Created from /dashboard/create\n\nProject: ${project.key}`,
    });
  }

  if (type === "spec") {
    return notionCreatePageWithFallback({
      databaseId: project.notionSpecsDatabaseId || process.env.NOTION_SPECS_DATABASE_ID || "",
      projectKey: project.key,
      title,
      body,
      source: "Dashboard",
      artifactType: "Spec",
    });
  }

  return notionCreatePageWithFallback({
    databaseId: project.notionInboxDatabaseId || process.env.NOTION_INBOX_DATABASE_ID || "",
    projectKey: project.key,
    title,
    body,
    source: "Dashboard",
    artifactType: type === "note" ? "Note" : "Idea",
  });
}

async function findInboxRowByShortId(databaseId, shortId) {
  if (!databaseId || !shortId) return null;
  const filters = [
    { property: "ShortId", rich_text: { equals: String(shortId) } },
    { property: "ShortId", rich_text: { contains: String(shortId) } },
  ];
  for (const filter of filters) {
    const result = await fetchNotionRows(databaseId, { page_size: 5, filter });
    if (result.rows.length > 0) return result.rows[0];
  }
  return null;
}

async function triageDashboardIntake(options = {}) {
  const action = String(options.action || "").trim().toLowerCase();
  if (!["task", "spec", "idea", "archive"].includes(action)) {
    return { ok: false, error: "action must be one of: task, spec, idea, archive" };
  }

  const registry = loadProjectRegistry();
  const project = getProjectByKey(registry, options.projectKey) || resolveDefaultProject(registry);
  if (!project) return { ok: false, error: "project is not configured" };

  const inboxDbId = project.notionInboxDatabaseId || process.env.NOTION_INBOX_DATABASE_ID || "";
  let pageId = String(options.notionPageId || "").trim();
  let row = null;
  if (pageId) {
    row = { id: pageId, properties: {} };
  } else if (options.intakeItemId) {
    row = await findInboxRowByShortId(inboxDbId, String(options.intakeItemId));
    pageId = String(row?.id || "");
  }
  if (!pageId) return { ok: false, error: "intake item was not found by notionPageId/intakeItemId" };

  const title = row ? titleFromNotionRow(row) : `Inbox ${String(options.intakeItemId || pageId).slice(0, 8)}`;
  const body = row ? rowSummaryText(row) : "";

  if (action === "archive") {
    const update = await notionUpdateStatusWithFallback(pageId, "Archived");
    return update.ok ? { ok: true, updatedStatus: "Archived", notionPageId: pageId } : update;
  }
  if (action === "idea") {
    const update = await notionUpdateStatusWithFallback(pageId, "Processed");
    return update.ok ? { ok: true, updatedStatus: "Processed", notionPageId: pageId } : update;
  }

  const artifact =
    action === "task"
      ? await createLinearIssueForDashboard({
          project,
          title,
          body: body || `Created from dashboard triage\n\nSource Notion page: ${pageId}`,
        })
      : await notionCreatePageWithFallback({
          databaseId: project.notionSpecsDatabaseId || process.env.NOTION_SPECS_DATABASE_ID || "",
          projectKey: project.key,
          title,
          body,
          source: "Dashboard",
          artifactType: "Spec",
        });
  if (!artifact.ok) return artifact;

  const mark = await notionUpdateStatusWithFallback(pageId, "Processed");
  return {
    ok: true,
    artifactUrl: artifact.artifactUrl || "",
    id: artifact.id || "",
    updatedStatus: mark.ok ? "Processed" : "",
    warning: mark.ok ? "" : mark.error || "",
    notionPageId: pageId,
  };
}

function renderDashboardHtml(data) {
  const projectTitle = data.project ? `${data.project.emoji || ""} ${data.project.label}`.trim() : "All Projects";

  const taskRows = data.linear.topTasks
    .map((row) => {
      const state = escapeHtml(row?.state?.name || "Unknown");
      const id = escapeHtml(row?.identifier || "N/A");
      const title = escapeHtml(row?.title || "(untitled)");
      const url = escapeHtml(row?.url || "#");
      return `<tr><td><a href="${url}" target="_blank" rel="noreferrer">${id}</a></td><td>${title}</td><td>${state}</td></tr>`;
    })
    .join("");

  const inboxRows = data.inbox.rows
    .map((row) => {
      const title = escapeHtml(titleFromNotionRow(row));
      const url = escapeHtml(String(row?.url || "#"));
      const rowId = escapeHtml(String(row?.id || ""));
      if (!data.options.actionsEnabled) {
        return `<li><a href="${url}" target="_blank" rel="noreferrer">${title}</a></li>`;
      }
      return `<li>
        <a href="${url}" target="_blank" rel="noreferrer">${title}</a>
        <span class="actions-inline">
          <button class="triage-btn" data-action="task" data-page-id="${rowId}" data-project-key="${escapeHtml(data.project?.key || "")}">Task</button>
          <button class="triage-btn" data-action="spec" data-page-id="${rowId}" data-project-key="${escapeHtml(data.project?.key || "")}">Spec</button>
          <button class="triage-btn" data-action="idea" data-page-id="${rowId}" data-project-key="${escapeHtml(data.project?.key || "")}">Idea</button>
          <button class="triage-btn" data-action="archive" data-page-id="${rowId}" data-project-key="${escapeHtml(data.project?.key || "")}">Archive</button>
        </span>
      </li>`;
    })
    .join("");

  const activityRows = data.activity
    .map((item) => {
      const icon = item.kind === "task" ? "[Task]" : "[Inbox]";
      return `<li>${icon} <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a> <span class="muted">${escapeHtml(item.ts)}</span></li>`;
    })
    .join("");

  const links = data.project?.links || {};
  const linksHtml = ["linear", "notion", "github", "sentry", "n8n"]
    .filter((name) => Boolean(links[name]))
    .map((name) => `<a href="${escapeHtml(String(links[name]))}" target="_blank" rel="noreferrer">${name}</a>`)
    .join(" · ");

  const allTabHref = buildDashboardHref(data.options, { projectKey: "" });
  const projectTabs = [
    `<a class="tab${data.project ? "" : " selected"}" href="${allTabHref}">All</a>`,
    ...data.projects.map((project) => {
      const selected = data.project?.key === project.key;
      const href = buildDashboardHref(data.options, { projectKey: project.key });
      return `<a class="tab${selected ? " selected" : ""}" href="${href}">${escapeHtml(`${project.emoji || ""} ${project.label}`.trim())}</a>`;
    }),
  ].join("");

  const stateTabs = ["all", "open", "started", "completed", "canceled"]
    .map((state) => {
      const selected = data.options.stateFilter === state;
      const href = buildDashboardHref(data.options, { stateFilter: state });
      return `<a class="chip${selected ? " selected" : ""}" href="${href}">${escapeHtml(state)}</a>`;
    })
    .join("");

  const projectCards = data.projectsSummary
    .map(
      (project) => `<div class="project-card">
        <div><strong>${escapeHtml(`${project.emoji || ""} ${project.label}`.trim())}</strong></div>
        <div class="muted">${project.done}/${project.total} done · ${project.started} in progress</div>
        <div class="bar small"><span style="width:${project.percent}%;"></span></div>
      </div>`
    )
    .join("");

  const runtimeRows = Object.entries(data.runtime.services)
    .map(([name, meta]) => {
      const stateClass = meta.running ? "ok" : "bad";
      return `<tr><td>${escapeHtml(name)}</td><td><span class="pill ${stateClass}">${meta.running ? "running" : "stopped"}</span></td><td>${escapeHtml(meta.detail)}</td></tr>`;
    })
    .join("");

  const controlPanel = data.options.actionsEnabled
    ? `<div class="card">
      <h2>Local Controls</h2>
      <div class="row">
        <button data-action="start" data-profile="core">Start core</button>
        <button data-action="start" data-profile="extended">Start extended</button>
        <button data-action="stop" data-profile="core">Stop core</button>
        <button data-action="restart" data-profile="extended">Restart extended</button>
        <button data-action="start" data-profile="full">Start full</button>
        <button id="launchCursor">Launch aipipeline-cursor</button>
      </div>
      <pre id="opsOutput" class="muted" style="margin-top:10px; white-space:pre-wrap;"></pre>
    </div>`
    : "";

  const createPanel = data.options.actionsEnabled
    ? `<div class="card">
      <h2>Quick Create</h2>
      <form id="quickCreateForm" class="row">
        <input id="quickCreateTitle" name="title" type="text" placeholder="Title" required />
        <select id="quickCreateType" name="type">
          <option value="task">Task</option>
          <option value="spec">Spec</option>
          <option value="idea">Idea</option>
          <option value="note">Note</option>
        </select>
        <button type="submit">Create</button>
      </form>
    </div>`
    : "";

  const searchRows = (data.search?.results || [])
    .map((item) => {
      const subtitle = escapeHtml([item.source, item.subtitle, item.projectKey].filter(Boolean).join(" · "));
      return `<li><a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title || "(untitled)")}</a> <span class="muted">${subtitle}</span></li>`;
    })
    .join("");

  const notices = [data.linear.error, data.inbox.error]
    .concat(Array.isArray(data.search?.warnings) ? data.search.warnings : [])
    .filter(Boolean)
    .map((msg) => `<li>${escapeHtml(msg)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="60" />
  <title>AIPipeline Dashboard</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 24px; background: #f2f5f7; color: #17212a; }
    .wrap { max-width: 1120px; margin: 0 auto; display: grid; gap: 16px; }
    .card { background: #fff; border: 1px solid #d7e0e7; border-radius: 12px; padding: 16px; }
    h1, h2 { margin: 0 0 10px; }
    h1 { font-size: 26px; }
    h2 { font-size: 18px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tab, .chip { display: inline-block; padding: 8px 12px; border-radius: 999px; border: 1px solid #c6d4df; color: #1d3f58; text-decoration: none; background: #f7fbff; text-transform: capitalize; }
    .tab.selected, .chip.selected { background: #1d3f58; color: #fff; border-color: #1d3f58; }
    button { border: 1px solid #c6d4df; background: #f7fbff; color: #1d3f58; border-radius: 10px; padding: 8px 12px; cursor: pointer; }
    button:hover { background: #eef6fc; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .stat { background: #f7fbff; border: 1px solid #d4e3ee; border-radius: 10px; padding: 10px; }
    .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .project-card { background: #f7fbff; border: 1px solid #d4e3ee; border-radius: 10px; padding: 10px; }
    .bar { width: 100%; height: 10px; border-radius: 8px; background: #e5edf2; overflow: hidden; margin-top: 8px; }
    .bar.small { height: 8px; margin-top: 6px; }
    .bar > span { display: block; height: 100%; background: #2e8b57; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e6edf2; font-size: 14px; }
    th { color: #4e6579; }
    a { color: #005f99; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { margin: 0; padding-left: 20px; }
    .muted { color: #5f7385; font-size: 13px; }
    .errors { color: #8a1f17; }
    .pill { border-radius: 999px; padding: 2px 8px; font-size: 12px; border: 1px solid transparent; }
    .pill.ok { background: #e6f4ea; color: #1f6b3a; border-color: #b7dfc6; }
    .pill.bad { background: #fdeaea; color: #8a1f17; border-color: #efc4c4; }
    .actions-inline { margin-left: 8px; display: inline-flex; gap: 6px; }
    input, select { border: 1px solid #c6d4df; background: #fff; color: #1d3f58; border-radius: 10px; padding: 8px 12px; min-height: 38px; }
    @media (max-width: 680px) { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>AIPipeline Dashboard</h1>
      <div class="muted">Updated: ${escapeHtml(data.generatedAt)} · <a href="${escapeHtml(buildDashboardHref(data.options))}">refresh</a></div>
      <div class="row" style="margin-top:10px;">${projectTabs || '<span class="muted">No projects configured</span>'}</div>
      <form id="dashboardSearchForm" class="row" style="margin-top:10px;">
        <input id="dashboardSearchInput" type="text" name="q" value="${escapeHtml(data.options.query || "")}" placeholder="Search Linear + Notion" />
        <button type="submit">Search</button>
      </form>
    </div>

    ${createPanel}

    <div class="card">
      <h2>${escapeHtml(projectTitle)} summary</h2>
      <div class="stats">
        <div class="stat"><strong>Total</strong><div>${data.linear.total}</div></div>
        <div class="stat"><strong>Done</strong><div>${data.linear.done}</div></div>
        <div class="stat"><strong>In progress</strong><div>${data.linear.buckets.started}</div></div>
        <div class="stat"><strong>Open</strong><div>${data.linear.buckets.open}</div></div>
      </div>
      <div class="bar"><span style="width:${data.linear.percent}%;"></span></div>
      <div class="muted">Completion: ${data.linear.percent}% (${data.linear.done}/${data.linear.total || 0})</div>
    </div>

    <div class="card">
      <h2>Projects Overview</h2>
      <div class="projects-grid">${projectCards || '<div class="muted">No project registry entries found.</div>'}</div>
    </div>

    <div class="card">
      <h2>Runtime Status</h2>
      <table>
        <thead><tr><th>Service</th><th>State</th><th>Detail</th></tr></thead>
        <tbody>${runtimeRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Open Tasks</h2>
      <div class="row" style="margin-bottom:10px;">${stateTabs}</div>
      <div class="muted" style="margin-bottom:8px;">Showing ${data.linear.topTasks.length} of ${data.linear.filteredCount} tasks (filter: ${escapeHtml(data.options.stateFilter)}, limit: ${data.options.taskLimit})</div>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>State</th></tr></thead>
        <tbody>${taskRows || '<tr><td colspan="3" class="muted">No tasks found.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Recent Activity</h2>
      <ul>${activityRows || '<li class="muted">No recent activity.</li>'}</ul>
    </div>

    <div class="card">
      <h2>Inbox (Status=New)</h2>
      <ul>${inboxRows || '<li class="muted">No new items.</li>'}</ul>
      <div class="muted" style="margin-top:8px;">Count: ${data.inbox.rows.length} (limit: ${data.options.inboxLimit})</div>
    </div>

    ${
      data.options.query
        ? `<div class="card">
      <h2>Search Results</h2>
      <div class="muted" style="margin-bottom:8px;">Query: ${escapeHtml(data.options.query)} · Results: ${(data.search?.results || []).length}</div>
      <ul>${searchRows || '<li class="muted">No results.</li>'}</ul>
    </div>`
        : ""
    }

    <div class="card">
      <h2>Quick Links</h2>
      <div>${linksHtml || '<span class="muted">No links configured for selected project.</span>'}</div>
    </div>

    ${controlPanel}
    ${notices ? `<div class="card"><h2>Warnings</h2><ul class="errors">${notices}</ul></div>` : ""}
  </div>
  <script>
    (function () {
      const output = document.getElementById("opsOutput");

      async function postJson(url, payload) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {}),
        });
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        if (!response.ok) throw new Error(data.error || ("HTTP " + response.status));
        return data;
      }

      document.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = button.getAttribute("data-action");
          const profile = button.getAttribute("data-profile");
          try {
            const data = await postJson("/ops/stack", { action, profile });
            if (output) output.textContent = (data.stdout || "OK").trim();
            setTimeout(() => location.reload(), 700);
          } catch (err) {
            if (output) output.textContent = String(err && err.message ? err.message : err);
          }
        });
      });

      const launchCursor = document.getElementById("launchCursor");
      if (launchCursor) {
        launchCursor.addEventListener("click", async () => {
          try {
            const data = await postJson("/ops/cursor", {});
            if (output) output.textContent = "Cursor launch requested (pid: " + (data.pid || "n/a") + ")";
          } catch (err) {
            if (output) output.textContent = String(err && err.message ? err.message : err);
          }
        });
      }

      const quickCreateForm = document.getElementById("quickCreateForm");
      if (quickCreateForm) {
        quickCreateForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const title = document.getElementById("quickCreateTitle")?.value || "";
          const type = document.getElementById("quickCreateType")?.value || "task";
          try {
            const data = await postJson("/dashboard/create", {
              projectKey: ${JSON.stringify(String(data.project?.key || ""))},
              type,
              title,
            });
            if (output) output.textContent = ("Created: " + (data.artifactUrl || data.id || "ok")).trim();
            setTimeout(() => location.reload(), 700);
          } catch (err) {
            if (output) output.textContent = String(err && err.message ? err.message : err);
          }
        });
      }

      document.querySelectorAll("button.triage-btn").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = button.getAttribute("data-action");
          const notionPageId = button.getAttribute("data-page-id");
          const projectKey = button.getAttribute("data-project-key");
          try {
            const data = await postJson("/dashboard/triage", { action, notionPageId, projectKey });
            if (output) output.textContent = (data.artifactUrl || data.updatedStatus || "OK").trim();
            setTimeout(() => location.reload(), 700);
          } catch (err) {
            if (output) output.textContent = String(err && err.message ? err.message : err);
          }
        });
      });

      const searchForm = document.getElementById("dashboardSearchForm");
      if (searchForm) {
        searchForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const q = String(document.getElementById("dashboardSearchInput")?.value || "").trim();
          const url = new URL(window.location.href);
          if (q) url.searchParams.set("q", q);
          else url.searchParams.delete("q");
          window.location.href = url.toString();
        });
      }
    })();
  </script>
</body>
</html>`;
}

async function buildDashboardData(options) {
  const registry = loadProjectRegistry();
  const selected = getProjectByKey(registry, options.projectKey) || (!options.projectKey ? resolveDefaultProject(registry) : null);
  const effectiveProject = selected || null;
  const notionInboxFallback =
    (effectiveProject && effectiveProject.notionInboxDatabaseId) || process.env.NOTION_INBOX_DATABASE_ID || "";

  const [linear, inbox, runtime, search] = await Promise.all([
    fetchLinearIssues(effectiveProject?.linearProjectId || ""),
    fetchNotionInboxRows(notionInboxFallback, effectiveProject?.key || "", options.inboxLimit),
    getLocalRuntimeStatus(),
    options.query ? searchDashboard({ q: options.query, projectKey: effectiveProject?.key || "", limit: Math.max(options.taskLimit, 10) }) : Promise.resolve({ ok: true, results: [], warnings: [] }),
  ]);

  const linearSummary = buildLinearSummary(linear.rows, options.stateFilter, options.taskLimit);

  return {
    generatedAt: new Date().toISOString(),
    options,
    project: effectiveProject,
    projects: registry.projects,
    projectsSummary: aggregateProjectsSummary(registry.projects, linear.rows),
    runtime,
    linear: { ...linearSummary, error: linear.error },
    inbox,
    search,
    activity: buildActivityFeed(linearSummary.topTasks, inbox.rows, options.activityLimit),
  };
}

async function getDashboardHtml(optionsOrProjectKey = "") {
  const options = normalizeDashboardOptions(optionsOrProjectKey);
  const cacheKey = `dashboard:${options.projectKey || "all"}:${options.stateFilter}:${options.query || ""}:${options.taskLimit}:${options.inboxLimit}:${options.activityLimit}:${options.actionsEnabled ? "actions" : "readonly"}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.html;
  const data = await buildDashboardData(options);
  const html = renderDashboardHtml(data);
  cache.set(cacheKey, { ts: now, html });
  return html;
}

module.exports = {
  getDashboardHtml,
  searchDashboard,
  createDashboardArtifact,
  triageDashboardIntake,
};
