import http from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LinearClient } from "../../src/modules/linear-client";
import { NotionClient } from "../../src/modules/notion-client";
import { GitHubClient } from "../../src/modules/github-client";

type RouteHandler = (req: http.IncomingMessage, body: string) => { status: number; payload: unknown };

function createServer(handler: RouteHandler): Promise<http.Server & { port: number }> {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const out = handler(req, body);
      res.statusCode = out.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(out.payload));
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to get server address"));
        return;
      }
      resolve(Object.assign(server, { port: address.port }));
    });
    server.on("error", reject);
  });
}

function makeLocalFetcher(port: number) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const u = new URL(input);
    const rewritten = `http://127.0.0.1:${port}${u.pathname}${u.search}`;
    return fetch(rewritten, init);
  };
}

describe("integration/http-clients", () => {
  let server: (http.Server & { port: number }) | undefined;

  beforeEach(() => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "lin_team";
    process.env.NOTION_TOKEN = "notion_key";
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_key";
    process.env.GITHUB_OWNER = "owner";
    process.env.GITHUB_REPO = "repo";
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it("LinearClient retries on 429 and succeeds via real HTTP", async () => {
    let calls = 0;
    server = await createServer((_req, _body) => {
      calls += 1;
      if (calls === 1) return { status: 429, payload: { errors: [{ message: "rate limited" }] } };
      return {
        status: 200,
        payload: { data: { issues: { nodes: [{ id: "1", identifier: "AIP-1", title: "Issue" }] } } },
      };
    });

    const client = new LinearClient({ fetcher: makeLocalFetcher(server.port), defaultTimeoutMs: 1000 });
    const issue = await client.findIssue("AIP-1");

    expect(issue?.identifier).toBe("AIP-1");
    expect(calls).toBe(2);
  });

  it("NotionClient creates page via real HTTP", async () => {
    server = await createServer((req, body) => {
      const parsed = JSON.parse(body || "{}");
      expect(req.url).toBe("/v1/pages");
      expect(parsed.parent.database_id).toBe("db-1");
      return { status: 200, payload: { id: "page-1", url: "https://notion.so/page-1" } };
    });

    const client = new NotionClient({ fetcher: makeLocalFetcher(server.port), defaultTimeoutMs: 1000 });
    const page = await client.createPage({ parentDatabaseId: "db-1", title: "Hello" });

    expect(page).toEqual({ id: "page-1", url: "https://notion.so/page-1" });
  });

  it("GitHubClient gets repository via real HTTP", async () => {
    server = await createServer((req) => {
      expect(req.url).toBe("/repos/owner/repo");
      return {
        status: 200,
        payload: { id: 42, full_name: "owner/repo", private: false, default_branch: "main" },
      };
    });

    const client = new GitHubClient({ fetcher: makeLocalFetcher(server.port), defaultTimeoutMs: 1000 });
    const repo = await client.getRepository();

    expect(repo.fullName).toBe("owner/repo");
  });
});
