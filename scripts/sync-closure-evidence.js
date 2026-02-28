#!/usr/bin/env node
/**
 * Sync closure evidence to Notion Sprint Log and optionally close Linear issue.
 *
 * Usage:
 *   source scripts/load-env-from-keyring.sh
 *   node scripts/sync-closure-evidence.js \
 *     --title "Post-hardening closure" \
 *     --summary "WF-2..WF-7 evidence synced" \
 *     --date 2026-02-28 \
 *     --linear AIP-11
 */

const https = require("https");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = "true";
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function requestJson(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: {
          ...headers,
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = buf ? JSON.parse(buf) : {};
          } catch (e) {
            return reject(new Error(`Invalid JSON from ${url}: ${buf.slice(0, 500)}`));
          }
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} ${url}: ${JSON.stringify(parsed).slice(0, 1000)}`));
          }
          resolve(parsed);
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createNotionSprintLog({ token, databaseId, title, summary, date, details }) {
  const payload = {
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ type: "text", text: { content: title } }] },
      Date: { date: { start: date } },
      Summary: { rich_text: [{ type: "text", text: { content: summary } }] },
    },
    children: details.map((line) => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: line } }] },
    })),
  };

  return requestJson("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
    body: payload,
  });
}

async function gqlLinear(apiKey, query, variables = {}) {
  const data = await requestJson("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: apiKey },
    body: { query, variables },
  });
  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${JSON.stringify(data.errors).slice(0, 1000)}`);
  }
  return data.data;
}

async function closeLinearIssueByIdentifier({ apiKey, teamId, issueIdentifier, comment }) {
  const team = await gqlLinear(
    apiKey,
    `query($teamId:String!){team(id:$teamId){id key states{nodes{id name type}} issues(first:250){nodes{id identifier state{id name type}}}}}`,
    { teamId }
  );

  const issue = (team.team.issues.nodes || []).find((i) => i.identifier === issueIdentifier);
  if (!issue) throw new Error(`Linear issue not found in team ${team.team.key}: ${issueIdentifier}`);

  const done = (team.team.states.nodes || []).find((s) => String(s.type).toLowerCase() === "completed");
  if (!done) throw new Error(`Done state not found in team ${team.team.key}`);

  const updated = await gqlLinear(
    apiKey,
    `mutation($id:String!,$stateId:String!){issueUpdate(id:$id,input:{stateId:$stateId}){success issue{id identifier state{name type}}}}`,
    { id: issue.id, stateId: done.id }
  );

  if (comment && comment.trim()) {
    await gqlLinear(
      apiKey,
      `mutation($issueId:String!,$body:String!){commentCreate(input:{issueId:$issueId,body:$body}){success comment{id}}}`,
      { issueId: issue.id, body: comment }
    );
  }

  return {
    identifier: updated.issueUpdate.issue.identifier,
    state: updated.issueUpdate.issue.state,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const title = args.title || "Closure evidence sync";
  const summary = args.summary || "Operational closure evidence synced.";
  const date = args.date || new Date().toISOString().slice(0, 10);
  const details = (args.details || "").split("|").map((x) => x.trim()).filter(Boolean);
  const linearIssue = args.linear || "";

  const notionToken = process.env.NOTION_TOKEN || "";
  const notionDb = process.env.NOTION_SPRINT_LOG_DATABASE_ID || "";

  const results = {};

  if (notionToken && notionDb) {
    const page = await createNotionSprintLog({
      token: notionToken,
      databaseId: notionDb,
      title,
      summary,
      date,
      details: details.length ? details : ["No additional details provided."],
    });
    results.notion = { id: page.id, url: page.url };
  } else {
    results.notion = { skipped: true, reason: "NOTION_TOKEN or NOTION_SPRINT_LOG_DATABASE_ID missing" };
  }

  if (linearIssue) {
    const apiKey = process.env.LINEAR_API_KEY || "";
    const teamId = process.env.LINEAR_TEAM_ID || "";
    if (!apiKey || !teamId) {
      results.linear = { skipped: true, reason: "LINEAR_API_KEY or LINEAR_TEAM_ID missing" };
    } else {
      const comment = [
        `Closure sync (${date}).`,
        "",
        summary,
        "",
        "Evidence updated in docs and Sprint Log.",
      ].join("\n");
      results.linear = await closeLinearIssueByIdentifier({ apiKey, teamId, issueIdentifier: linearIssue, comment });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
