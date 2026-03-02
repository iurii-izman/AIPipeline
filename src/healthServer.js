/**
 * Minimal health HTTP server for AIPipeline.
 * Serves GET /health, GET /status, GET /. Port from env PORT (default 3000).
 * @module healthServer
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { context: otelContext, trace, SpanStatusCode } = require("@opentelemetry/api");
const { log, correlationIdFromRequest } = require("./logger.js");
const {
  getDashboardHtml,
  searchDashboard,
  createDashboardArtifact,
  triageDashboardIntake,
} = require("./dashboard.js");
const {
  canBypassDashboardAuth,
  dashboardActionsEnabled,
  isLoopbackAddress,
  launchAipipelineCursor,
  runStackControl,
  getLocalRuntimeStatus,
} = require("./local-ops.js");
const {
  appendAiTelemetryEvent,
  appendDlqEvent,
  findDlqEventById,
  markDlqEvent,
  readAiTelemetryEvents,
  readDlqEvents,
} = require("./opsStore.js");

const DEFAULT_PORT = 3000;
const SERVER_SOCKETS = Symbol("aipipelineServerSockets");
const SERVER_ACTIVE_REQUESTS = Symbol("aipipelineActiveRequests");
const SERVER_IS_DRAINING = Symbol("aipipelineIsDraining");
const rateBuckets = new Map();
const tracer = trace.getTracer("aipipeline-health-server");

const MODEL_TOKEN_PRICING_PER_1K = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
};

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

function getShutdownTimeoutMs() {
  return Number(process.env.SHUTDOWN_TIMEOUT_MS || 10_000);
}

function getN8nUrl() {
  return process.env.N8N_URL || "http://localhost:5678";
}

function getN8nProbeTimeoutMs() {
  const parsed = Number(process.env.N8N_PROBE_TIMEOUT_MS || 3_000);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3_000;
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

function getDlqIngestToken() {
  return process.env.DLQ_INGEST_TOKEN || "";
}

function getTelemetryIngestToken() {
  return process.env.TELEMETRY_INGEST_TOKEN || "";
}

function getDlqReplayToken() {
  return process.env.DLQ_REPLAY_TOKEN || getDlqIngestToken();
}

function getIntakeIngestToken() {
  return process.env.INTAKE_INGEST_TOKEN || getDlqIngestToken();
}

function checkBearerAuth(req, expectedToken) {
  if (!expectedToken) return true;
  const token = extractBearerToken(req);
  return Boolean(token && token === expectedToken);
}

function parseJsonBody(req, maxBytes = getMaxRequestBodyBytes()) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("payload too large"));
        return;
      }
      raw += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function estimateEventCostUsd(event) {
  if (typeof event.costUsd === "number" && Number.isFinite(event.costUsd)) {
    return event.costUsd;
  }
  const model = String(event.model || "").trim();
  const pricing = MODEL_TOKEN_PRICING_PER_1K[model];
  if (!pricing) return 0;
  const promptTokens = Number(event.promptTokens || 0);
  const completionTokens = Number(event.completionTokens || 0);
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
}

function buildTelemetrySummary(events, sinceIso) {
  let fallbackCount = 0;
  let mismatchCount = 0;
  let mismatchDen = 0;
  let criticalMissCount = 0;
  let criticalMissDen = 0;
  let costUsdTotal = 0;

  for (const event of events) {
    if (event.fallbackUsed === true) fallbackCount += 1;
    if (event.expectedSeverity && event.predictedSeverity) {
      mismatchDen += 1;
      if (event.expectedSeverity !== event.predictedSeverity) mismatchCount += 1;
      if (event.expectedSeverity === "critical") {
        criticalMissDen += 1;
        if (event.predictedSeverity !== "critical") criticalMissCount += 1;
      }
    }
    costUsdTotal += estimateEventCostUsd(event);
  }

  return {
    since: sinceIso,
    sampleSize: events.length,
    fallbackRate: events.length ? fallbackCount / events.length : 0,
    mismatchRate: mismatchDen ? mismatchCount / mismatchDen : 0,
    criticalMissRate: criticalMissDen ? criticalMissCount / criticalMissDen : 0,
    costUsdTotal: Number(costUsdTotal.toFixed(6)),
  };
}

function findReplayCandidate(events, preferredId) {
  if (preferredId) {
    return events.find((event) => String(event.id || "") === String(preferredId)) || null;
  }
  const parked = events.filter((event) => String(event.status || "parked") === "parked");
  if (!parked.length) return null;
  parked.sort((a, b) => String(a.parkedAt || "").localeCompare(String(b.parkedAt || "")));
  return parked[0];
}

function dispatchReplay(target, payload, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(target);
    } catch (err) {
      reject(new Error(`invalid replay target: ${target}`));
      return;
    }
    const data = JSON.stringify(payload || {});
    const client = u.protocol === "https:" ? https : http;
    const req = client.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: `${u.pathname || "/"}${u.search || ""}`,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk.toString("utf8");
        });
        res.on("end", () => {
          resolve({
            statusCode: Number(res.statusCode || 0),
            ok: Number(res.statusCode || 0) >= 200 && Number(res.statusCode || 0) < 300,
            body,
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("replay request timeout"));
    });
    req.write(data);
    req.end();
  });
}

function getIntakeStorageDir() {
  const configured = String(process.env.INTAKE_FILES_DIR || "").trim();
  if (configured) return configured;
  return path.resolve(process.cwd(), ".runtime-logs/intake-files");
}

function appendAuditEvent(action, status, details = {}) {
  try {
    const logDir = path.resolve(process.cwd(), ".runtime-logs");
    const logFile = path.join(logDir, "audit.log");
    fs.mkdirSync(logDir, { recursive: true });
    const payload = {
      eventType: "audit",
      ts: new Date().toISOString(),
      action: String(action || "unknown_action"),
      status: String(status || "success"),
      actor: process.env.USER || process.env.USERNAME || "unknown",
      details: details && typeof details === "object" ? details : { value: String(details || "") },
    };
    fs.appendFileSync(logFile, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (err) {
    log("error", "audit append failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

function safeFileSegment(value, fallback = "file") {
  const cleaned = String(value || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function buildIntakePublicUrl(fileId) {
  return `/intake/files/${encodeURIComponent(fileId)}`;
}

async function ingestTelegramFile({ filePath, fileName, shortId, telegramBotToken }) {
  if (!filePath || !telegramBotToken) {
    throw new Error("filePath and telegramBotToken are required");
  }
  const sourceUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${filePath.replace(/^\/+/, "")}`;
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`telegram file download failed (${response.status})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const now = Date.now();
  const baseName = safeFileSegment(fileName || path.basename(filePath) || "file");
  const ext = path.extname(baseName) || path.extname(filePath) || "";
  const idPrefix = safeFileSegment(shortId || "intake");
  const id = `${idPrefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const storedName = `${id}${ext}`;
  const storageDir = getIntakeStorageDir();
  fs.mkdirSync(storageDir, { recursive: true });
  const storedPath = path.join(storageDir, storedName);
  fs.writeFileSync(storedPath, bytes);
  const metaPath = `${storedPath}.json`;
  const metadata = {
    id,
    shortId: shortId || "",
    sourceFilePath: filePath,
    sourceFileName: fileName || path.basename(filePath),
    storedName,
    storedPath,
    size: bytes.length,
    storedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  return {
    id,
    storedPath,
    storedName,
    size: bytes.length,
    publicUrl: buildIntakePublicUrl(id),
  };
}

/**
 * Pings n8n (GET base URL). Returns "reachable" or "unreachable".
 * @returns {Promise<string>}
 */
function checkN8n(correlationId) {
  return tracer.startActiveSpan("n8n.health.probe", (span) =>
    new Promise((resolve) => {
      const n8nUrl = getN8nUrl();
      const n8nProbeTimeoutMs = getN8nProbeTimeoutMs();
      const u = new URL(n8nUrl);
      span.setAttributes({
        "aipipeline.correlation_id": correlationId,
        "server.address": u.hostname,
        "server.port": Number(u.port || 80),
      });

      const startedAt = Date.now();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        span.end();
        resolve(value);
      };

      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port || 80,
          path: u.pathname || "/",
          method: "GET",
          timeout: n8nProbeTimeoutMs,
        },
        (res) => {
          req.setTimeout(0);
          res.resume();
          span.setAttribute("http.response.status_code", Number(res.statusCode || 0));
          log("info", "n8n health probe completed", {
            correlationId,
            n8nUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
          });
          finish("reachable");
        }
      );

      req.on("error", (err) => {
        if (settled) return;
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        log("error", "n8n health probe failed", {
          correlationId,
          n8nUrl,
          durationMs: Date.now() - startedAt,
          error: err.message,
        });
        finish("unreachable");
      });

      req.on("timeout", () => {
        if (settled) return;
        req.destroy();
        span.setStatus({ code: SpanStatusCode.ERROR, message: "timeout" });
        log("error", "n8n health probe timeout", {
          correlationId,
          n8nUrl,
          durationMs: Date.now() - startedAt,
        });
        finish("unreachable");
      });
      req.end();
    })
  );
}

/**
 * Handles incoming request: /health, /status (JSON), / → 200.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function requestHandler(req, res) {
  return tracer.startActiveSpan("http.request", (span) => {
    const url = req.url?.split("?")[0] ?? "/";
    const correlationId = correlationIdFromRequest(req);
    const remoteAddress = req.socket?.remoteAddress || "unknown";
    const contentLengthRaw = req.headers?.["content-length"];
    const contentLength = Number(Array.isArray(contentLengthRaw) ? contentLengthRaw[0] : contentLengthRaw);
    const maxRequestBodyBytes = getMaxRequestBodyBytes();
    const rateLimitWindowMs = getRateLimitWindowMs();
    const rateLimitMaxRequests = getRateLimitMaxRequests();

    span.setAttributes({
      "aipipeline.correlation_id": correlationId,
      "http.request.method": req.method || "GET",
      "url.path": url,
      "client.address": remoteAddress,
    });
    const finishSpan = () => {
      span.setAttribute("http.response.status_code", Number(res.statusCode || 0));
      if (res.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
      }
      span.end();
    };
    res.once("finish", finishSpan);

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

    if (
      (url === "/health" ||
        url === "/status" ||
        url === "/dashboard" ||
        url.startsWith("/ops/")) &&
      !enforceRateLimit(`${remoteAddress}:${url}`)
    ) {
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
      if (!checkBearerAuth(req, getStatusAuthToken())) {
        res.writeHead(401);
        res.end();
        log("error", "status endpoint unauthorized", {
          correlationId,
          remoteAddress,
        });
        return;
      }
      const exporterEndpoint = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "");
      const exporterIsLocal = /localhost|127\.0\.0\.1|host\.containers\.internal/.test(exporterEndpoint.toLowerCase());
      const env = {
        github: Boolean(process.env.GITHUB_PERSONAL_ACCESS_TOKEN),
        linear: Boolean(process.env.LINEAR_API_KEY),
        notion: Boolean(process.env.NOTION_TOKEN),
        telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        sentry: Boolean(process.env.SENTRY_DSN),
        n8nApiKey: Boolean(process.env.N8N_API_KEY),
        otelEnabled: String(process.env.OTEL_ENABLED || process.env.OTEL_PILOT_ENABLED || "false").toLowerCase() === "true",
        otelManaged: String(process.env.OTEL_EXPORTER_MODE || "").toLowerCase() === "managed" || (Boolean(exporterEndpoint) && !exporterIsLocal),
        otelExporterConfigured: Boolean(exporterEndpoint),
      };
      checkN8n(correlationId)
        .then((n8nStatus) => {
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
        })
        .catch((err) => {
          span.recordException(err);
          res.writeHead(500);
          res.end();
          log("error", "status endpoint failed", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "GET" && url === "/dashboard") {
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk) {
        res.writeHead(401);
        res.end();
        return;
      }
      const parsed = new URL(req.url || "/dashboard", "http://localhost");
      const projectKey = parsed.searchParams.get("project") || "";
      const stateFilter = parsed.searchParams.get("state") || "all";
      const query = parsed.searchParams.get("q") || "";
      const taskLimit = parsed.searchParams.get("tasks") || "";
      const inboxLimit = parsed.searchParams.get("inbox") || "";
      const activityLimit = parsed.searchParams.get("activity") || "";

      getDashboardHtml({
        projectKey,
        stateFilter,
        query,
        taskLimit,
        inboxLimit,
        activityLimit,
        actionsEnabled: dashboardActionsEnabled(),
      })
        .then((html) => {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.writeHead(200);
          res.end(html);
        })
        .catch((err) => {
          span.recordException(err);
          res.setHeader("Content-Type", "application/json");
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
          log("error", "dashboard endpoint failed", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "GET" && url === "/dashboard/search") {
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk) {
        res.writeHead(401);
        res.end();
        return;
      }
      const parsed = new URL(req.url || "/dashboard/search", "http://localhost");
      const q = parsed.searchParams.get("q") || "";
      const projectKey = parsed.searchParams.get("project") || "";
      const limit = parsed.searchParams.get("limit") || "25";
      searchDashboard({ q, projectKey, limit })
        .then((payload) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, ...payload }));
        })
        .catch((err) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), results: [] }));
        });
      return;
    }

    if (req.method === "POST" && url === "/dashboard/create") {
      if (!isLoopbackAddress(remoteAddress)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk || !dashboardActionsEnabled()) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then(async (payload) => {
          const result = await createDashboardArtifact(payload || {});
          res.setHeader("Content-Type", "application/json");
          res.writeHead(result.ok ? 200 : 400);
          res.end(JSON.stringify(result));
          log("info", "dashboard create action", {
            correlationId,
            ok: result.ok,
            projectKey: String(payload?.projectKey || ""),
            type: String(payload?.type || ""),
          });
          appendAuditEvent("dashboard.create", result.ok ? "success" : "failed", {
            correlationId,
            ok: result.ok,
            projectKey: String(payload?.projectKey || ""),
            type: String(payload?.type || ""),
            artifactUrl: String(result?.artifactUrl || ""),
            error: String(result?.error || ""),
          });
        })
        .catch((err) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
          appendAuditEvent("dashboard.create", "failed", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "POST" && url === "/dashboard/triage") {
      if (!isLoopbackAddress(remoteAddress)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk || !dashboardActionsEnabled()) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then(async (payload) => {
          const result = await triageDashboardIntake(payload || {});
          res.setHeader("Content-Type", "application/json");
          res.writeHead(result.ok ? 200 : 400);
          res.end(JSON.stringify(result));
          log("info", "dashboard triage action", {
            correlationId,
            ok: result.ok,
            action: String(payload?.action || ""),
            projectKey: String(payload?.projectKey || ""),
          });
          appendAuditEvent("dashboard.triage", result.ok ? "success" : "failed", {
            correlationId,
            ok: result.ok,
            action: String(payload?.action || ""),
            projectKey: String(payload?.projectKey || ""),
            intakeItemId: String(payload?.intakeItemId || ""),
            notionPageId: String(payload?.notionPageId || ""),
            artifactUrl: String(result?.artifactUrl || ""),
            error: String(result?.error || ""),
          });
        })
        .catch((err) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
          appendAuditEvent("dashboard.triage", "failed", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "GET" && url === "/ops/status") {
      if (!isLoopbackAddress(remoteAddress)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk) {
        res.writeHead(401);
        res.end();
        return;
      }
      getLocalRuntimeStatus()
        .then((payload) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, ...payload }));
        })
        .catch((err) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
        });
      return;
    }

    if (req.method === "POST" && url === "/ops/stack") {
      if (!isLoopbackAddress(remoteAddress)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk || !dashboardActionsEnabled()) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then(async (payload) => {
          const action = String(payload.action || "");
          const profile = String(payload.profile || "");
          const result = await runStackControl(action, profile);
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, ...result }));
        })
        .catch((err) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
        });
      return;
    }

    if (req.method === "POST" && url === "/ops/cursor") {
      if (!isLoopbackAddress(remoteAddress)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const authOk = checkBearerAuth(req, getStatusAuthToken()) || canBypassDashboardAuth(remoteAddress);
      if (!authOk || !dashboardActionsEnabled()) {
        res.writeHead(401);
        res.end();
        return;
      }
      launchAipipelineCursor()
        .then((result) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
        });
      return;
    }

    if (req.method === "POST" && url === "/dlq/park") {
      if (!checkBearerAuth(req, getDlqIngestToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then((payload) => {
          const item = {
            ...payload,
            id: payload.id || `dlq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            status: payload.status || "parked",
            parkedAt: payload.parkedAt || new Date().toISOString(),
            persistedBy: "aipipeline-health-server",
          };
          const filePath = appendDlqEvent(item);
          res.setHeader("Content-Type", "application/json");
          res.writeHead(202);
          res.end(JSON.stringify({ ok: true, id: item.id, filePath }));
          log("info", "dlq event persisted", { correlationId, id: item.id, filePath });
        })
        .catch((err) => {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: "invalid json payload" }));
          log("error", "dlq park payload rejected", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "POST" && url === "/dlq/mark") {
      if (!checkBearerAuth(req, getDlqIngestToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then((payload) => {
          const id = String(payload.id || "").trim();
          if (!id) {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: "id is required" }));
            return;
          }
          const result = markDlqEvent(id, {
            status: payload.status || "updated",
            lastReplayError: payload.lastReplayError || "",
            lastReplayResultAt: payload.lastReplayResultAt || new Date().toISOString(),
          });
          res.setHeader("Content-Type", "application/json");
          res.writeHead(result.found ? 200 : 404);
          res.end(JSON.stringify({ ok: result.found, ...result, id }));
        })
        .catch((err) => {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: "invalid json payload" }));
          log("error", "dlq mark payload rejected", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "GET" && url === "/dlq/events") {
      if (!checkBearerAuth(req, getStatusAuthToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      const all = readDlqEvents();
      const limitRaw = req.url?.includes("?") ? new URL(`http://localhost${req.url}`).searchParams.get("limit") : null;
      const limit = Number(limitRaw || "50");
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50;
      const rows = all.slice(-safeLimit).reverse();
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, total: all.length, count: rows.length, rows }));
      return;
    }

    if (req.method === "POST" && url === "/dlq/replay") {
      if (!checkBearerAuth(req, getDlqReplayToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then(async (payload) => {
          const id = String(payload.id || "").trim();
          const event = id ? findDlqEventById(id) : findReplayCandidate(readDlqEvents(), "");
          if (!event) {
            res.writeHead(404);
            res.end(JSON.stringify({ ok: false, error: "no replay candidate found" }));
            return;
          }
          const replayTarget = String(event.replayTarget || "");
          if (!replayTarget) {
            markDlqEvent(event.id, {
              status: "replay_skipped_no_target",
              lastReplayError: "replayTarget is empty",
              lastReplayResultAt: new Date().toISOString(),
            });
            res.writeHead(409);
            res.end(JSON.stringify({ ok: false, id: event.id, error: "replayTarget is empty" }));
            return;
          }

          const replayResult = await dispatchReplay(replayTarget, event.replayPayload || event.context || {});
          const nextStatus = replayResult.ok ? "replayed" : "replay_failed";
          markDlqEvent(event.id, {
            status: nextStatus,
            lastReplayError: replayResult.ok ? "" : `HTTP ${replayResult.statusCode}`,
            lastReplayResultAt: new Date().toISOString(),
          });
          res.setHeader("Content-Type", "application/json");
          res.writeHead(replayResult.ok ? 200 : 502);
          res.end(
            JSON.stringify({
              ok: replayResult.ok,
              id: event.id,
              status: nextStatus,
              replayTarget,
              replayStatusCode: replayResult.statusCode,
            })
          );
        })
        .catch((err) => {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
          log("error", "durable dlq replay failed", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "POST" && url === "/telemetry/ai-event") {
      if (!checkBearerAuth(req, getTelemetryIngestToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then((payload) => {
          const event = {
            ...payload,
            observedAt: payload.observedAt || new Date().toISOString(),
            source: payload.source || "wf-3",
          };
          const filePath = appendAiTelemetryEvent(event);
          res.setHeader("Content-Type", "application/json");
          res.writeHead(202);
          res.end(JSON.stringify({ ok: true, filePath }));
          log("info", "ai telemetry event persisted", { correlationId, filePath });
        })
        .catch((err) => {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: "invalid json payload" }));
          log("error", "ai telemetry payload rejected", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "POST" && url === "/intake/telegram-file") {
      if (!checkBearerAuth(req, getIntakeIngestToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      parseJsonBody(req)
        .then(async (payload) => {
          const filePath = String(payload.filePath || "").trim();
          const fileName = String(payload.fileName || "").trim();
          const shortId = String(payload.shortId || "").trim();
          const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
          if (!filePath || !token) {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: "filePath and TELEGRAM_BOT_TOKEN are required" }));
            return;
          }
          const result = await ingestTelegramFile({ filePath, fileName, shortId, telegramBotToken: token });
          res.setHeader("Content-Type", "application/json");
          res.writeHead(201);
          res.end(JSON.stringify({ ok: true, ...result }));
          log("info", "intake file stored", {
            correlationId,
            id: result.id,
            size: result.size,
            storedPath: result.storedPath,
          });
        })
        .catch((err) => {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
          log("error", "intake file ingest failed", {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "GET" && url.startsWith("/intake/files/")) {
      if (!checkBearerAuth(req, getStatusAuthToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      const fileId = decodeURIComponent(url.slice("/intake/files/".length));
      const storageDir = getIntakeStorageDir();
      const files = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];
      const match = files.find((entry) => entry.startsWith(`${safeFileSegment(fileId)}_`) || entry.startsWith(`${safeFileSegment(fileId)}.`) || entry === fileId || entry.startsWith(fileId));
      if (!match) {
        res.writeHead(404);
        res.end();
        return;
      }
      const fullPath = path.join(storageDir, match);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory() || fullPath.endsWith(".json")) {
        res.writeHead(404);
        res.end();
        return;
      }
      const stream = fs.createReadStream(fullPath);
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      stream.pipe(res);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(500);
        }
        res.end();
      });
      return;
    }

    if (req.method === "GET" && url === "/telemetry/ai-summary") {
      if (!checkBearerAuth(req, getStatusAuthToken())) {
        res.writeHead(401);
        res.end();
        return;
      }
      const daysRaw = req.url?.includes("?") ? new URL(`http://localhost${req.url}`).searchParams.get("days") : null;
      const days = Number(daysRaw || "30");
      const windowDays = Number.isFinite(days) && days > 0 ? days : 30;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      const sinceIso = since.toISOString();
      const events = readAiTelemetryEvents().filter((event) => {
        const observedAt = String(event.observedAt || event.evaluatedAt || "");
        return !observedAt || observedAt >= sinceIso;
      });
      const summary = buildTelemetrySummary(events, sinceIso);
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...summary }));
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
  });
}

/**
 * Starts the health server. Resolves when server is listening.
 * @param {number} [port] - Port to listen on (default from env PORT or 3000).
 * @returns {Promise<http.Server>}
 */
function start(port = Number(process.env.PORT) || DEFAULT_PORT) {
  const server = http.createServer(requestHandler);
  const sockets = new Set();
  server[SERVER_SOCKETS] = sockets;
  server[SERVER_ACTIVE_REQUESTS] = 0;
  server[SERVER_IS_DRAINING] = false;
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("request", (_req, res) => {
    server[SERVER_ACTIVE_REQUESTS] += 1;
    res.on("finish", () => {
      server[SERVER_ACTIVE_REQUESTS] = Math.max(0, server[SERVER_ACTIVE_REQUESTS] - 1);
      if (server[SERVER_IS_DRAINING] && server[SERVER_ACTIVE_REQUESTS] === 0) {
        for (const socket of sockets) {
          if (!socket.destroyed) socket.end();
        }
        if (typeof server.closeIdleConnections === "function") {
          server.closeIdleConnections();
        }
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve(server));
    server.on("error", reject);
  });
}

/**
 * Gracefully stops server by refusing new connections and draining active sockets.
 * If drain timeout is reached, destroys remaining sockets.
 * @param {http.Server} server
 * @param {number} [timeoutMs]
 * @returns {Promise<{ forced: boolean, openSockets: number }>}
 */
function stop(server, timeoutMs = getShutdownTimeoutMs()) {
  return new Promise((resolve, reject) => {
    if (!server || typeof server.close !== "function") {
      resolve({ forced: false, openSockets: 0 });
      return;
    }

    const sockets = server[SERVER_SOCKETS] || new Set();
    server[SERVER_IS_DRAINING] = true;

    if ((server[SERVER_ACTIVE_REQUESTS] || 0) === 0) {
      for (const socket of sockets) {
        if (!socket.destroyed) socket.end();
      }
    }
    let settled = false;
    const settle = (err, forced) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (err) {
        reject(err);
        return;
      }
      resolve({ forced, openSockets: sockets.size });
    };

    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (typeof server.closeAllConnections === "function") {
              server.closeAllConnections();
            }
            for (const socket of sockets) socket.destroy();
            settle(null, true);
          }, timeoutMs)
        : null;
    if (timer && typeof timer.unref === "function") timer.unref();

    server.close((err) => settle(err, false));
  });
}

module.exports = { start, stop, requestHandler, resetRateLimiter };
