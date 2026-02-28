#!/usr/bin/env node
/**
 * Set labels on Linear issues (type or domain). Uses GraphQL API.
 * Run: source scripts/load-env-from-keyring.sh && node scripts/linear-apply-labels.js
 * Labels from docs/linear-setup.md: Infra, Documentation, Feature, etc.
 */

const https = require("https");

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
if (!LINEAR_API_KEY) {
  console.error("LINEAR_API_KEY not set. Run: source scripts/load-env-from-keyring.sh");
  process.exit(1);
}

function graphql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: "api.linear.app",
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: LINEAR_API_KEY,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (ch) => (buf += ch));
        res.on("end", () => {
          try {
            const j = JSON.parse(buf);
            if (j.errors) reject(new Error(JSON.stringify(j.errors)));
            else resolve(j.data);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Get teams and their labels
  const teamsData = await graphql(`
    query {
      teams {
        nodes {
          id
          key
          name
          labels {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `);
  const teams = teamsData.teams?.nodes || [];
  const team = teams.find((t) => t.key === "AIP" || t.name?.toLowerCase().includes("aipipeline")) || teams[0];
  if (!team) {
    console.error("No team found");
    process.exit(1);
  }
  const labelByName = {};
  (team.labels?.nodes || []).forEach((l) => {
    labelByName[l.name] = l.id;
  });

  // 2. Get issues for this team
  const issuesData = await graphql(
    `
    query($teamId: String!) {
      team(id: $teamId) {
        issues(first: 50) {
          nodes {
            id
            identifier
            title
            labelIds
          }
        }
      }
    }
    `,
    { teamId: team.id }
  );
  const issues = issuesData.team?.issues?.nodes || [];

  // 3. Map issue to label (by title/keywords)
  const assignLabel = (issue) => {
    const t = (issue.title || "").toLowerCase();
    const id = issue.identifier || "";
    if (t.includes("notion") || t.includes("documentation") || id === "AIP-1") return "Documentation";
    if (t.includes("linear") && t.includes("label")) return "Infra";
    if (t.includes("github") || t.includes("n8n") || t.includes("telegram") || t.includes("sync") || t.includes("deploy") || t.includes("team") || t.includes("import") || t.includes("connect") || t.includes("tool")) return "Infra";
    return "Infra";
  };

  let updated = 0;
  for (const issue of issues) {
    const labelName = assignLabel(issue);
    const labelId = labelByName[labelName];
    if (!labelId) {
      console.warn(`Label "${labelName}" not found for team. Skipping ${issue.identifier}`);
      continue;
    }
    if (issue.labelIds && issue.labelIds.includes(labelId)) {
      continue;
    }
    await graphql(
      `
      mutation($id: String!, $labelIds: [String!]) {
        issueUpdate(id: $id, input: { labelIds: $labelIds }) {
          success
          issue { id identifier }
        }
      }
      `,
      { id: issue.id, labelIds: [...(issue.labelIds || []), labelId] }
    );
    console.log(`  ${issue.identifier}: added label "${labelName}"`);
    updated++;
  }
  console.log(`Done. Updated ${updated} issue(s) with labels.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
