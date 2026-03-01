import http from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimiter, start } from "../src/healthServer.js";

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
  const originalStatusAuthToken = process.env.STATUS_AUTH_TOKEN;
  const originalRateLimit = process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS;
  const originalMaxBodyBytes = process.env.MAX_REQUEST_BODY_BYTES;

  beforeEach(() => {
    resetRateLimiter();
    delete process.env.STATUS_AUTH_TOKEN;
    delete process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS;
    delete process.env.MAX_REQUEST_BODY_BYTES;
  });

  afterEach(() => {
    if (server) server.close();
    server = undefined;
    process.env.STATUS_AUTH_TOKEN = originalStatusAuthToken;
    process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS = originalRateLimit;
    process.env.MAX_REQUEST_BODY_BYTES = originalMaxBodyBytes;
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
});
