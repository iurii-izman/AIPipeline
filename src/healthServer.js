/**
 * Minimal health HTTP server for AIPipeline.
 * Serves GET /health, GET /status, GET /. Port from env PORT (default 3000).
 * @module healthServer
 */

const http = require("http");
const { log, correlationIdFromRequest } = require("./logger.js");

const DEFAULT_PORT = 3000;
const N8N_URL = process.env.N8N_URL || "http://localhost:5678";

/**
 * Pings n8n (GET base URL). Returns "reachable" or "unreachable".
 * @returns {Promise<string>}
 */
function checkN8n(correlationId) {
  return new Promise((resolve) => {
    const u = new URL(N8N_URL);
    const startedAt = Date.now();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname || "/",
        method: "GET",
        timeout: 3000,
      },
      (res) => {
        req.setTimeout(0);
        res.resume();
        log("info", "n8n health probe completed", {
          correlationId,
          n8nUrl: N8N_URL,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        });
        finish("reachable");
      }
    );
    req.on("error", (err) => {
      if (settled) return;
      log("error", "n8n health probe failed", {
        correlationId,
        n8nUrl: N8N_URL,
        durationMs: Date.now() - startedAt,
        error: err.message,
      });
      finish("unreachable");
    });
    req.on("timeout", () => {
      if (settled) return;
      req.destroy();
      log("error", "n8n health probe timeout", {
        correlationId,
        n8nUrl: N8N_URL,
        durationMs: Date.now() - startedAt,
      });
      finish("unreachable");
    });
    req.end();
  });
}

/**
 * Handles incoming request: /health, /status (JSON), / → 200.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function requestHandler(req, res) {
  const url = req.url?.split("?")[0] ?? "/";
  const correlationId = correlationIdFromRequest(req);
  res.setHeader("x-correlation-id", correlationId);
  log("info", "http request received", {
    correlationId,
    method: req.method,
    url,
    remoteAddress: req.socket?.remoteAddress,
  });

  if (req.method === "GET" && url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        service: "aipipeline",
        correlationId,
      })
    );
    log("info", "health response sent", { correlationId, statusCode: 200 });
    return;
  }
  if (req.method === "GET" && url === "/status") {
    const env = {
      github: Boolean(process.env.GITHUB_PERSONAL_ACCESS_TOKEN),
      linear: Boolean(process.env.LINEAR_API_KEY),
      notion: Boolean(process.env.NOTION_TOKEN),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      sentry: Boolean(process.env.SENTRY_DSN),
      n8nApiKey: Boolean(process.env.N8N_API_KEY),
    };
    checkN8n(correlationId).then((n8nStatus) => {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          timestamp: new Date().toISOString(),
          service: "aipipeline",
          correlationId,
          env,
          n8n: n8nStatus,
        })
      );
      log("info", "status response sent", {
        correlationId,
        statusCode: 200,
        n8n: n8nStatus,
      });
    });
    return;
  }
  if (req.method === "GET" && (url === "/" || url === "")) {
    res.writeHead(200);
    res.end("AIPipeline");
    log("info", "root response sent", { correlationId, statusCode: 200 });
    return;
  }
  res.writeHead(404);
  res.end();
  log("info", "not found response sent", { correlationId, statusCode: 404, url });
}

/**
 * Starts the health server. Resolves when server is listening.
 * @param {number} [port] - Port to listen on (default from env PORT or 3000).
 * @returns {Promise<http.Server>}
 */
function start(port = Number(process.env.PORT) || DEFAULT_PORT) {
  const server = http.createServer(requestHandler);
  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve(server));
    server.on("error", reject);
  });
}

module.exports = { start, requestHandler };
