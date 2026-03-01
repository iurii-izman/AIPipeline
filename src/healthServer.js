/**
 * Minimal health HTTP server for AIPipeline.
 * Serves GET /health, GET /status, GET /. Port from env PORT (default 3000).
 * @module healthServer
 */

const http = require("http");
const { log, correlationIdFromRequest } = require("./logger.js");

const DEFAULT_PORT = 3000;
const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const rateBuckets = new Map();

function resetRateLimiter() {
  rateBuckets.clear();
}

function getRateLimitWindowMs() {
  return Number(process.env.HEALTH_RATE_LIMIT_WINDOW_MS || 60_000);
}

function getRateLimitMaxRequests() {
  return Number(process.env.HEALTH_RATE_LIMIT_MAX_REQUESTS || 60);
}

function getMaxRequestBodyBytes() {
  return Number(process.env.MAX_REQUEST_BODY_BYTES || 1_048_576);
}

function enforceRateLimit(key) {
  const rateLimitWindowMs = getRateLimitWindowMs();
  const rateLimitMaxRequests = getRateLimitMaxRequests();
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= rateLimitWindowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (bucket.count >= rateLimitMaxRequests) return false;
  bucket.count += 1;
  return true;
}

function extractBearerToken(req) {
  const value = req.headers?.authorization;
  if (!value || typeof value !== "string") return "";
  const parts = value.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return "";
  return parts[1];
}

function getStatusAuthToken() {
  return process.env.STATUS_AUTH_TOKEN || "";
}

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
  const remoteAddress = req.socket?.remoteAddress || "unknown";
  const contentLengthRaw = req.headers?.["content-length"];
  const contentLength = Number(Array.isArray(contentLengthRaw) ? contentLengthRaw[0] : contentLengthRaw);
  const maxRequestBodyBytes = getMaxRequestBodyBytes();
  const rateLimitWindowMs = getRateLimitWindowMs();
  const rateLimitMaxRequests = getRateLimitMaxRequests();
  res.setHeader("x-correlation-id", correlationId);
  log("info", "http request received", {
    correlationId,
    method: req.method,
    url,
    remoteAddress,
  });

  if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
    res.writeHead(413);
    res.end();
    log("error", "request rejected due to content length", {
      correlationId,
      contentLength,
      maxAllowedBytes: maxRequestBodyBytes,
      url,
    });
    return;
  }

  if ((url === "/health" || url === "/status") && !enforceRateLimit(`${remoteAddress}:${url}`)) {
    res.writeHead(429);
    res.end();
    log("error", "rate limit exceeded", {
      correlationId,
      url,
      remoteAddress,
      rateLimitMaxRequests,
      rateLimitWindowMs,
    });
    return;
  }

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
    const statusAuthToken = getStatusAuthToken();
    if (statusAuthToken) {
      const token = extractBearerToken(req);
      if (!token || token !== statusAuthToken) {
        res.writeHead(401);
        res.end();
        log("error", "status endpoint unauthorized", {
          correlationId,
          remoteAddress,
        });
        return;
      }
    }
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

module.exports = { start, requestHandler, resetRateLimiter };
