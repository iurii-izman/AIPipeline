const { loadProjectRegistry, getProjectByKey, resolveDefaultProject } = require("./projectRegistry.js");

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

async function fetchLinearIssues(projectId) {
  const apiKey = process.env.LINEAR_API_KEY || "";
  if (!apiKey) return { rows: [], error: "LINEAR_API_KEY is not configured" };

  const baseQuery =
    "query($first:Int!){issues(first:$first){nodes{id identifier title url updatedAt state{name type} project{id name}}}}";
  const filteredQuery =
    "query($first:Int!,$projectId:String!){issues(first:$first, filter:{project:{id:{eq:$projectId}}}){nodes{id identifier title url updatedAt state{name type} project{id name}}}}";
  const hasProject = Boolean(projectId);
  const response = await requestJson("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: hasProject ? filteredQuery : baseQuery,
      variables: hasProject ? { first: 100, projectId } : { first: 100 },
    }),
  });

  if (!response.ok || response.payload?.errors?.length) {
    const detail = response.payload?.errors?.[0]?.message || `Linear request failed (${response.status})`;
    return { rows: [], error: detail };
  }

  const rows = Array.isArray(response.payload?.data?.issues?.nodes) ? response.payload.data.issues.nodes : [];
  return { rows, error: "" };
}

async function fetchNotionInboxRows(databaseId, projectKey) {
  const token = process.env.NOTION_TOKEN || "";
  if (!token || !databaseId) return { rows: [], error: "" };
  const filter =
    projectKey && projectKey.trim()
      ? {
          and: [
            { property: "Status", select: { equals: "New" } },
            { property: "ProjectKey", rich_text: { equals: projectKey } },
          ],
        }
      : { property: "Status", select: { equals: "New" } };

  const response = await requestJson(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": process.env.NOTION_VERSION || "2025-09-03",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: 8,
      filter,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }),
  });

  if (!response.ok) {
    return { rows: [], error: `Notion inbox request failed (${response.status})` };
  }
  const rows = Array.isArray(response.payload?.results) ? response.payload.results : [];
  return { rows, error: "" };
}

function buildLinearSummary(rows) {
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
  const total = rows.length;
  const done = buckets.completed;
  const active = rows
    .slice()
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 10);
  return {
    total,
    done,
    percent: percent(done, total),
    buckets,
    topTasks: active,
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
      return `<li><a href="${url}" target="_blank" rel="noreferrer">${title}</a></li>`;
    })
    .join("");

  const links = data.project?.links || {};
  const linksHtml = ["linear", "notion", "github", "sentry", "n8n"]
    .filter((name) => Boolean(links[name]))
    .map((name) => `<a href="${escapeHtml(String(links[name]))}" target="_blank" rel="noreferrer">${name}</a>`)
    .join(" · ");

  const projectTabs = data.projects
    .map((project) => {
      const selected = data.project?.key === project.key;
      const href = `/dashboard?project=${encodeURIComponent(project.key)}`;
      return `<a class="tab${selected ? " selected" : ""}" href="${href}">${escapeHtml(
        `${project.emoji || ""} ${project.label}`.trim()
      )}</a>`;
    })
    .join("");

  const notices = [data.linear.error, data.inbox.error].filter(Boolean).map((msg) => `<li>${escapeHtml(msg)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="60" />
  <title>AIPipeline Dashboard</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, sans-serif; margin: 0; padding: 24px; background: #f2f5f7; color: #17212a; }
    .wrap { max-width: 1040px; margin: 0 auto; display: grid; gap: 16px; }
    .card { background: #fff; border: 1px solid #d7e0e7; border-radius: 12px; padding: 16px; }
    h1, h2 { margin: 0 0 10px; }
    h1 { font-size: 26px; }
    h2 { font-size: 18px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tab { display: inline-block; padding: 8px 12px; border-radius: 999px; border: 1px solid #c6d4df; color: #1d3f58; text-decoration: none; background: #f7fbff; }
    .tab.selected { background: #1d3f58; color: #fff; border-color: #1d3f58; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .stat { background: #f7fbff; border: 1px solid #d4e3ee; border-radius: 10px; padding: 10px; }
    .bar { width: 100%; height: 10px; border-radius: 8px; background: #e5edf2; overflow: hidden; margin-top: 8px; }
    .bar > span { display: block; height: 100%; background: #2e8b57; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e6edf2; font-size: 14px; }
    th { color: #4e6579; }
    a { color: #005f99; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { margin: 0; padding-left: 20px; }
    .muted { color: #5f7385; font-size: 13px; }
    .errors { color: #8a1f17; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>AIPipeline Dashboard</h1>
      <div class="muted">Updated: ${escapeHtml(data.generatedAt)}</div>
      <div class="row" style="margin-top:10px;">${projectTabs || '<span class="muted">No projects configured</span>'}</div>
    </div>

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
      <h2>Open Tasks</h2>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>State</th></tr></thead>
        <tbody>${taskRows || '<tr><td colspan="3" class="muted">No tasks found.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Inbox (Status=New)</h2>
      <ul>${inboxRows || '<li class="muted">No new items.</li>'}</ul>
      <div class="muted" style="margin-top:8px;">Count: ${data.inbox.rows.length}</div>
    </div>

    <div class="card">
      <h2>Quick Links</h2>
      <div>${linksHtml || '<span class="muted">No links configured for selected project.</span>'}</div>
    </div>

    ${notices ? `<div class="card"><h2>Warnings</h2><ul class="errors">${notices}</ul></div>` : ""}
  </div>
</body>
</html>`;
}

async function buildDashboardData(projectKey) {
  const registry = loadProjectRegistry();
  const selected = getProjectByKey(registry, projectKey) || (projectKey ? null : resolveDefaultProject(registry));
  const effectiveProject = selected || null;
  const notionInboxFallback =
    (effectiveProject && effectiveProject.notionInboxDatabaseId) || process.env.NOTION_INBOX_DATABASE_ID || "";

  const [linear, inbox] = await Promise.all([
    fetchLinearIssues(effectiveProject?.linearProjectId || ""),
    fetchNotionInboxRows(notionInboxFallback, effectiveProject?.key || ""),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    project: effectiveProject,
    projects: registry.projects,
    linear: { ...buildLinearSummary(linear.rows), error: linear.error },
    inbox,
  };
}

async function getDashboardHtml(projectKey = "") {
  const cacheKey = `dashboard:${projectKey || "all"}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.html;
  const data = await buildDashboardData(projectKey);
  const html = renderDashboardHtml(data);
  cache.set(cacheKey, { ts: now, html });
  return html;
}

module.exports = { getDashboardHtml };

