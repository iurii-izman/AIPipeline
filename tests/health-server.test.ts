import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimiter, start, stop } from "../src/healthServer.js";

function request(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options?.method ?? "GET",
        headers: options?.headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: data,
          })
        );
      }
    );
    req.on("error", reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

async function getJson(url: string, headers?: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await request(url, { headers });
  return JSON.parse(res.body) as Record<string, unknown>;
}

function getText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function getStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const code = res.statusCode ?? 0;
      res.resume();
      resolve(code);
    }).on("error", reject);
  });
}

describe("health server", () => {
  let server: http.Server | undefined;
  let hangingN8n: http.Server | undefined;
  const originalStatusAuthToken = process.env.STATUS_AUTH_TOKEN;
  const originalRateLimit = process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS;
  const originalMaxBodyBytes = process.env.MAX_REQUEST_BODY_BYTES;
  const originalShutdownTimeoutMs = process.env.SHUTDOWN_TIMEOUT_MS;
  const originalN8nUrl = process.env.N8N_URL;
  const originalN8nProbeTimeoutMs = process.env.N8N_PROBE_TIMEOUT_MS;
  const originalDlqStoreFile = process.env.DLQ_STORE_FILE;
  const originalAiTelemetryStoreFile = process.env.AI_TELEMETRY_STORE_FILE;
  const originalDlqReplayToken = process.env.DLQ_REPLAY_TOKEN;
  const originalLinearApiKey = process.env.LINEAR_API_KEY;
  const originalNotionToken = process.env.NOTION_TOKEN;
  const originalNotionInboxDatabaseId = process.env.NOTION_INBOX_DATABASE_ID;
  const originalProjectsConfig = process.env.PROJECTS_CONFIG;
  const originalDefaultProjectKey = process.env.DEFAULT_PROJECT_KEY;
  const originalIntakeIngestToken = process.env.INTAKE_INGEST_TOKEN;
  const originalIntakeFilesDir = process.env.INTAKE_FILES_DIR;
  const originalTelegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalDashboardPublicLocal = process.env.DASHBOARD_PUBLIC_LOCAL;
  const originalDashboardEnableActions = process.env.DASHBOARD_ENABLE_ACTIONS;

  function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[name];
      return;
    }
    process.env[name] = value;
  }

  beforeEach(() => {
    resetRateLimiter();
    delete process.env.STATUS_AUTH_TOKEN;
    delete process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS;
    delete process.env.MAX_REQUEST_BODY_BYTES;
    delete process.env.LINEAR_API_KEY;
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_INBOX_DATABASE_ID;
    delete process.env.PROJECTS_CONFIG;
    delete process.env.DEFAULT_PROJECT_KEY;
    delete process.env.INTAKE_INGEST_TOKEN;
    delete process.env.INTAKE_FILES_DIR;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DASHBOARD_PUBLIC_LOCAL;
    delete process.env.DASHBOARD_ENABLE_ACTIONS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (server) server.close();
    if (hangingN8n) hangingN8n.close();
    server = undefined;
    hangingN8n = undefined;
    restoreEnv("STATUS_AUTH_TOKEN", originalStatusAuthToken);
    restoreEnv("HEALTH_RATE_LIMIT_MAX_REQUESTS", originalRateLimit);
    restoreEnv("MAX_REQUEST_BODY_BYTES", originalMaxBodyBytes);
    restoreEnv("SHUTDOWN_TIMEOUT_MS", originalShutdownTimeoutMs);
    restoreEnv("N8N_URL", originalN8nUrl);
    restoreEnv("N8N_PROBE_TIMEOUT_MS", originalN8nProbeTimeoutMs);
    restoreEnv("DLQ_STORE_FILE", originalDlqStoreFile);
    restoreEnv("AI_TELEMETRY_STORE_FILE", originalAiTelemetryStoreFile);
    restoreEnv("DLQ_REPLAY_TOKEN", originalDlqReplayToken);
    restoreEnv("LINEAR_API_KEY", originalLinearApiKey);
    restoreEnv("NOTION_TOKEN", originalNotionToken);
    restoreEnv("NOTION_INBOX_DATABASE_ID", originalNotionInboxDatabaseId);
    restoreEnv("PROJECTS_CONFIG", originalProjectsConfig);
    restoreEnv("DEFAULT_PROJECT_KEY", originalDefaultProjectKey);
    restoreEnv("INTAKE_INGEST_TOKEN", originalIntakeIngestToken);
    restoreEnv("INTAKE_FILES_DIR", originalIntakeFilesDir);
    restoreEnv("TELEGRAM_BOT_TOKEN", originalTelegramBotToken);
    restoreEnv("DASHBOARD_PUBLIC_LOCAL", originalDashboardPublicLocal);
    restoreEnv("DASHBOARD_ENABLE_ACTIONS", originalDashboardEnableActions);
    resetRateLimiter();
  });

  it("serves /health, /status, / and 404", async () => {
    const runningServer = await start(0);
    server = runningServer;

    const address = runningServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Server did not provide numeric address");
    }
    const port = address.port;

    const health = await getJson(`http://127.0.0.1:${port}/health`);
    expect(health.ok).toBe(true);
    expect(health.service).toBe("aipipeline");

    const status = await getJson(`http://127.0.0.1:${port}/status`);
    expect(status.ok).toBe(true);
    expect(typeof status.n8n).toBe("string");

    const root = await getText(`http://127.0.0.1:${port}/`);
    expect(root).toBe("AIPipeline");

    const notFound = await getStatus(`http://127.0.0.1:${port}/unknown`);
    expect(notFound).toBe(404);
  });

  it("requires bearer token for /status when STATUS_AUTH_TOKEN is configured", async () => {
    process.env.STATUS_AUTH_TOKEN = "secret-token";
    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const unauthorized = await request(`http://127.0.0.1:${port}/status`);
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await request(`http://127.0.0.1:${port}/status`, {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(authorized.statusCode).toBe(200);
  });

  it("serves /dashboard and enforces the same bearer auth policy as /status", async () => {
    process.env.STATUS_AUTH_TOKEN = "secret-token";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [{ key: "aipipeline", label: "AIPipeline", emoji: "🔧", links: { github: "https://github.com/iurii-izman/AIPipeline" } }],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";
    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const unauthorized = await request(`http://127.0.0.1:${port}/dashboard`);
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await request(`http://127.0.0.1:${port}/dashboard?project=aipipeline`, {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(authorized.statusCode).toBe(200);
    expect(String(authorized.headers["content-type"] || "")).toContain("text/html");
    expect(authorized.body).toContain("AIPipeline Dashboard");
    expect(authorized.body).toContain("AIPipeline");
  });

  it("allows local dashboard access without bearer when DASHBOARD_PUBLIC_LOCAL is enabled", async () => {
    process.env.STATUS_AUTH_TOKEN = "secret-token";
    process.env.DASHBOARD_PUBLIC_LOCAL = "true";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [{ key: "aipipeline", label: "AIPipeline" }],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const response = await request(`http://127.0.0.1:${port}/dashboard`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("AIPipeline Dashboard");
  });

  it("exposes local ops controls only when DASHBOARD_ENABLE_ACTIONS is enabled", async () => {
    process.env.STATUS_AUTH_TOKEN = "secret-token";
    process.env.DASHBOARD_PUBLIC_LOCAL = "true";
    process.env.DASHBOARD_ENABLE_ACTIONS = "true";

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const stackStatus = await request(`http://127.0.0.1:${port}/ops/stack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", profile: "core" }),
    });
    expect(stackStatus.statusCode).toBe(200);
    expect(stackStatus.body).toContain("\"action\":\"status\"");
    expect(stackStatus.body).toContain("\"profile\":\"core\"");
  });

  it("exposes /dashboard/search with dashboard auth policy", async () => {
    process.env.STATUS_AUTH_TOKEN = "secret-token";
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [{ key: "aipipeline", label: "AIPipeline", linearProjectId: "lin-proj-1" }],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";
    global.fetch = vi.fn(async (url: string | URL) => {
      const value = String(url);
      if (value.includes("api.linear.app/graphql")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: {
                issues: {
                  nodes: [
                    {
                      id: "1",
                      identifier: "AIP-1",
                      title: "Demo search item",
                      url: "https://linear.app/issue/AIP-1",
                      updatedAt: "2026-03-02T12:00:00.000Z",
                      state: { name: "Todo", type: "backlog" },
                      project: { id: "lin-proj-1", name: "AIPipeline" },
                    },
                  ],
                },
              },
            }),
        };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) };
    }) as unknown as typeof fetch;

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const unauthorized = await request(`http://127.0.0.1:${port}/dashboard/search?q=demo`);
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await request(`http://127.0.0.1:${port}/dashboard/search?q=demo`, {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toContain("\"ok\":true");
    expect(authorized.body).toContain("Demo search item");
  });

  it("gates /dashboard/create and /dashboard/triage behind local actions flag", async () => {
    process.env.STATUS_AUTH_TOKEN = "secret-token";
    process.env.DASHBOARD_PUBLIC_LOCAL = "true";
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          linearTeamId: "team-1",
          linearProjectId: "proj-1",
          notionInboxDatabaseId: "inbox-db",
          notionSpecsDatabaseId: "specs-db",
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const disabled = await request(`http://127.0.0.1:${port}/dashboard/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectKey: "aipipeline", type: "task", title: "Demo" }),
    });
    expect(disabled.statusCode).toBe(401);

    process.env.DASHBOARD_ENABLE_ACTIONS = "true";
    global.fetch = vi.fn(async (url: string | URL) => {
      const value = String(url);
      if (value.includes("api.linear.app/graphql")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: { issueCreate: { issue: { id: "lin-1", identifier: "AIP-99", url: "https://linear.app/issue/AIP-99", title: "Demo" } } },
            }),
        };
      }
      if (value.includes("/v1/pages/")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "page-1" }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) };
    }) as unknown as typeof fetch;

    const createOk = await request(`http://127.0.0.1:${port}/dashboard/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectKey: "aipipeline", type: "task", title: "Demo" }),
    });
    expect(createOk.statusCode).toBe(200);
    expect(createOk.body).toContain("\"ok\":true");

    const triageBad = await request(`http://127.0.0.1:${port}/dashboard/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectKey: "aipipeline", action: "task" }),
    });
    expect(triageBad.statusCode).toBe(400);
    expect(triageBad.body).toContain("intake item was not found");
  });

  it("rate limits health endpoint", async () => {
    process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS = "2";
    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    expect(await getStatus(`http://127.0.0.1:${port}/health`)).toBe(200);
    expect(await getStatus(`http://127.0.0.1:${port}/health`)).toBe(200);
    expect(await getStatus(`http://127.0.0.1:${port}/health`)).toBe(429);
  });

  it("rejects requests with large content-length", async () => {
    process.env.MAX_REQUEST_BODY_BYTES = "8";
    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const res = await request(`http://127.0.0.1:${port}/health`, {
      method: "POST",
      headers: { "Content-Length": "64" },
      body: "hello",
    });
    expect(res.statusCode).toBe(413);
  });

  it("gracefully drains in-flight request and rejects new connections during shutdown", async () => {
    process.env.N8N_PROBE_TIMEOUT_MS = "200";
    process.env.SHUTDOWN_TIMEOUT_MS = "2000";

    const hangingServer = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((_req, _res) => {
        // Intentionally keep socket open until caller timeout in checkN8n.
      });
      s.listen(0, () => resolve(s));
    });
    hangingN8n = hangingServer;
    const hangingAddress = hangingServer.address();
    if (!hangingAddress || typeof hangingAddress === "string") {
      throw new Error("hanging n8n server did not provide numeric address");
    }
    process.env.N8N_URL = `http://127.0.0.1:${hangingAddress.port}`;

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const inFlightStatusRequest = request(`http://127.0.0.1:${port}/status`);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const stopPromise = stop(runningServer, 2000);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const postStopConnection:
      | { ok: true; statusCode: number }
      | { ok: false; err: unknown } = await request(`http://127.0.0.1:${port}/health`).then(
      (res) => ({ ok: true as const, statusCode: res.statusCode }),
      (err) => ({ ok: false as const, err })
    );
    if (postStopConnection.ok) {
      expect(postStopConnection.statusCode).not.toBe(200);
    } else {
      expect(postStopConnection.ok).toBe(false);
    }

    const inFlightStatusResult:
      | { ok: true; statusCode: number }
      | { ok: false; err: unknown } = await inFlightStatusRequest.then(
      (res) => ({ ok: true as const, statusCode: res.statusCode }),
      (err) => ({ ok: false as const, err })
    );
    if (inFlightStatusResult.ok) {
      expect(inFlightStatusResult.statusCode).toBe(200);
    } else {
      const code = (inFlightStatusResult.err as { code?: string } | undefined)?.code;
      expect(["ECONNRESET", "ECONNREFUSED"]).toContain(code);
    }

    const stopResult = await stopPromise;
    expect(stopResult.forced).toBe(false);
  });

  it("accepts telemetry events and returns online summary", async () => {
    process.env.AI_TELEMETRY_STORE_FILE = `.out/tests/ai-telemetry-${Date.now()}.jsonl`;
    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const eventPayload = {
      source: "test",
      model: "gpt-4o-mini",
      fallbackUsed: true,
      expectedSeverity: "critical",
      predictedSeverity: "critical",
      promptTokens: 1000,
      completionTokens: 100,
    };
    const ingest = await request(`http://127.0.0.1:${port}/telemetry/ai-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    });
    expect(ingest.statusCode).toBe(202);

    const summary = await getJson(`http://127.0.0.1:${port}/telemetry/ai-summary?days=30`);
    expect(summary.ok).toBe(true);
    expect(Number(summary.sampleSize)).toBeGreaterThanOrEqual(1);
    expect(Number(summary.fallbackRate)).toBeGreaterThanOrEqual(0);
  });

  it("supports durable dlq park/list/replay flow", async () => {
    process.env.DLQ_STORE_FILE = `.out/tests/dlq-${Date.now()}.jsonl`;
    process.env.DLQ_REPLAY_TOKEN = "dlq-token";

    const replayTarget = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((req, res) => {
        if (req.method === "POST") {
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(405);
        res.end();
      });
      s.listen(0, () => resolve(s));
    });
    hangingN8n = replayTarget;
    const replayAddress = replayTarget.address();
    if (!replayAddress || typeof replayAddress === "string") {
      throw new Error("Replay target did not provide numeric address");
    }

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const parkPayload = {
      sourceWorkflow: "WF-TEST",
      failureType: "integration_failure",
      reason: "test failure",
      replayTarget: `http://127.0.0.1:${replayAddress.port}/replay`,
      replayPayload: { hello: "world" },
    };
    const park = await request(`http://127.0.0.1:${port}/dlq/park`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parkPayload),
    });
    expect(park.statusCode).toBe(202);

    const listed = await getJson(`http://127.0.0.1:${port}/dlq/events?limit=10`);
    expect(listed.ok).toBe(true);
    const rows = Array.isArray(listed.rows) ? listed.rows : [];
    expect(rows.length).toBeGreaterThan(0);
    const id = String((rows[0] as Record<string, unknown>).id || "");
    expect(id).not.toBe("");

    const replay = await request(`http://127.0.0.1:${port}/dlq/replay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dlq-token",
      },
      body: JSON.stringify({ id }),
    });
    expect(replay.statusCode).toBe(200);
  });

  it("ingests Telegram files and serves stored intake files with auth", async () => {
    const tmpDir = path.resolve(`.out/tests/intake-files-${Date.now()}`);
    process.env.INTAKE_INGEST_TOKEN = "intake-token";
    process.env.STATUS_AUTH_TOKEN = "status-token";
    process.env.TELEGRAM_BOT_TOKEN = "telegram-test-token";
    process.env.INTAKE_FILES_DIR = tmpDir;

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const runningServer = await start(0);
    server = runningServer;
    const address = runningServer.address();
    if (!address || typeof address === "string") throw new Error("Server did not provide numeric address");
    const port = address.port;

    const ingest = await request(`http://127.0.0.1:${port}/intake/telegram-file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer intake-token",
      },
      body: JSON.stringify({
        filePath: "documents/spec.pdf",
        fileName: "spec.pdf",
        shortId: "kabc123",
      }),
    });
    expect(ingest.statusCode).toBe(201);
    const ingestJson = JSON.parse(ingest.body) as { ok: boolean; publicUrl?: string };
    expect(ingestJson.ok).toBe(true);
    expect(String(ingestJson.publicUrl || "")).toContain("/intake/files/");

    const unauthorizedFile = await request(`http://127.0.0.1:${port}${ingestJson.publicUrl || ""}`);
    expect(unauthorizedFile.statusCode).toBe(401);

    const fileRes = await request(`http://127.0.0.1:${port}${ingestJson.publicUrl || ""}`, {
      headers: { Authorization: "Bearer status-token" },
    });
    expect(fileRes.statusCode).toBe(200);
    expect(fileRes.body.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstFetchCall = fetchMock.mock.calls[0] as unknown[] | undefined;
    const firstFetchUrl = String(firstFetchCall?.[0] ?? "");
    expect(firstFetchUrl).toContain("/file/bottelegram-test-token/documents/spec.pdf");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
