/**
 * Minimal health HTTP server for AIPipeline.
 * Serves GET /health, GET /status, GET /. Port from env PORT (default 3000).
 * @module healthServer
 */

const http = require("http");

const DEFAULT_PORT = 3000;
const N8N_URL = process.env.N8N_URL || "http://localhost:5678";

/**
 * Pings n8n (GET base URL). Returns "reachable" or "unreachable".
 * @returns {Promise<string>}
 */
function checkN8n() {
  return new Promise((resolve) => {
    const u = new URL(N8N_URL);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname || "/",
        method: "GET",
        timeout: 3000,
      },
      () => resolve("reachable")
    );
    req.on("error", () => resolve("unreachable"));
    req.on("timeout", () => {
      req.destroy();
      resolve("unreachable");
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
  if (req.method === "GET" && url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        service: "aipipeline",
      })
    );
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
    checkN8n().then((n8nStatus) => {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          timestamp: new Date().toISOString(),
          service: "aipipeline",
          env,
          n8n: n8nStatus,
        })
      );
    });
    return;
  }
  if (req.method === "GET" && (url === "/" || url === "")) {
    res.writeHead(200);
    res.end("AIPipeline");
    return;
  }
  res.writeHead(404);
  res.end();
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
