#!/usr/bin/env node
/**
 * Audit GitHub merged PR closures against Linear issue states.
 *
 * Usage:
 *   source scripts/load-env-from-keyring.sh
 *   node scripts/audit-linear-github-closure.js
 *   node scripts/audit-linear-github-closure.js --limit 200 --write-markdown
 *   node scripts/audit-linear-github-closure.js --fail-on-mismatch
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

function parseArgs(argv) {
  const out = {
    limit: 100,
    writeMarkdown: false,
    failOnMismatch: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write-markdown") {
      out.writeMarkdown = true;
      continue;
    }
    if (arg === "--fail-on-mismatch") {
      out.failOnMismatch = true;
      continue;
    }
    if (arg === "--limit") {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) {
        out.limit = Math.min(300, Math.floor(value));
        i += 1;
      }
    }
  }

  return out;
}

function requestJson({ hostname, path: reqPath, method = "GET", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname,
        path: reqPath,
        method,
        headers: {
          ...headers,
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => {
          out += c;
        });
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = out ? JSON.parse(out) : {};
          } catch {
            return reject(new Error(`Invalid JSON from ${hostname}${reqPath}: ${out.slice(0, 500)}`));
          }
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} ${hostname}${reqPath}: ${JSON.stringify(parsed).slice(0, 700)}`));
          }
          resolve(parsed);
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractIssueIdentifiers(text) {
  if (!text) return [];
  const ids = new Set();
  const closureRegex = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+((?:[A-Z]+-\d+)(?:\s*,\s*[A-Z]+-\d+)*)/gi;
  let match;
  while ((match = closureRegex.exec(text)) !== null) {
    const chunk = match[1] || "";
    const issueMatches = chunk.match(/[A-Z]+-\d+/g) || [];
    for (const id of issueMatches) ids.add(id.toUpperCase());
  }
  return [...ids];
}

async function fetchMergedPullRequests({ owner, repo, githubToken, limit }) {
  const prs = await requestJson({
    hostname: "api.github.com",
    path: `/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${Math.min(limit, 100)}`,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "AIPipeline-ClosureAudit",
    },
  });
  return Array.isArray(prs) ? prs.filter((pr) => pr && pr.merged_at).slice(0, limit) : [];
}

async function fetchLinearIssues({ linearApiKey, teamId }) {
  const data = await requestJson({
    hostname: "api.linear.app",
    path: "/graphql",
    method: "POST",
    headers: {
      Authorization: linearApiKey,
    },
    body: {
      query:
        "query($teamId:String!){team(id:$teamId){issues(first:250){nodes{id identifier title url state{name type} updatedAt}}}}",
      variables: { teamId },
    },
  });

  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${JSON.stringify(data.errors).slice(0, 700)}`);
  }
  const nodes = data?.data?.team?.issues?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function toStateType(state) {
  return String(state?.type || "").toLowerCase();
}

function buildMarkdownReport(summary) {
  const lines = [];
  lines.push("# Linear ↔ GitHub Closure Audit");
  lines.push("");
  lines.push(`- timestamp: ${summary.timestamp}`);
  lines.push(`- repo: ${summary.owner}/${summary.repo}`);
  lines.push(`- merged_prs_scanned: ${summary.mergedPrsScanned}`);
  lines.push(`- closure_ids_found: ${summary.closureIdsFound}`);
  lines.push(`- referenced_not_done: ${summary.referencedNotDone.length}`);
  lines.push("");
  if (summary.referencedNotDone.length === 0) {
    lines.push("All referenced closure issues are in completed/canceled state.");
    lines.push("");
    return lines.join("\n");
  }
  lines.push("## Referenced But Not Done");
  lines.push("");
  for (const item of summary.referencedNotDone) {
    lines.push(
      `- ${item.identifier}: state=${item.stateName || "unknown"} (${item.stateType || "unknown"}) | PR #${item.prNumber} ${item.prUrl}`
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);

  const owner = process.env.GITHUB_OWNER || "iurii-izman";
  const repo = process.env.GITHUB_REPO || "AIPipeline";
  const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "";
  const linearApiKey = process.env.LINEAR_API_KEY || "";
  const teamId = process.env.LINEAR_TEAM_ID || "";

  if (!githubToken) throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN is required");
  if (!linearApiKey) throw new Error("LINEAR_API_KEY is required");
  if (!teamId) throw new Error("LINEAR_TEAM_ID is required");

  const prs = await fetchMergedPullRequests({ owner, repo, githubToken, limit: args.limit });
  const issues = await fetchLinearIssues({ linearApiKey, teamId });

  const linearByIdentifier = new Map(issues.map((issue) => [String(issue.identifier || "").toUpperCase(), issue]));

  const referencedNotDone = [];
  const allClosureIds = new Set();

  for (const pr of prs) {
    const ids = new Set([
      ...extractIssueIdentifiers(pr.title || ""),
      ...extractIssueIdentifiers(pr.body || ""),
    ]);
    for (const id of ids) {
      allClosureIds.add(id);
      const issue = linearByIdentifier.get(id);
      if (!issue) {
        referencedNotDone.push({
          identifier: id,
          stateName: "missing_in_linear_team_scope",
          stateType: "missing",
          prNumber: pr.number,
          prUrl: pr.html_url,
        });
        continue;
      }
      const stateType = toStateType(issue.state);
      if (stateType !== "completed" && stateType !== "canceled") {
        referencedNotDone.push({
          identifier: id,
          stateName: issue.state?.name || "unknown",
          stateType,
          prNumber: pr.number,
          prUrl: pr.html_url,
        });
      }
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    owner,
    repo,
    mergedPrsScanned: prs.length,
    closureIdsFound: allClosureIds.size,
    referencedNotDone,
  };

  if (args.writeMarkdown) {
    const outDir = path.join(path.resolve(__dirname, ".."), ".out");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "linear-github-closure-audit.md");
    fs.writeFileSync(outFile, buildMarkdownReport(summary), "utf8");
  }

  console.log(JSON.stringify(summary, null, 2));

  if (args.failOnMismatch && referencedNotDone.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
