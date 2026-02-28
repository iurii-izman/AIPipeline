import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { start } from "../src/healthServer.js";

function getJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data) as Record<string, unknown>));
    }).on("error", reject);
  });
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

  afterEach(() => {
    if (server) server.close();
    server = undefined;
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
});
