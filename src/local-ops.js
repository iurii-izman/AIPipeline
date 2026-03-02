const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function isLoopbackAddress(address) {
  const value = String(address || "").trim();
  if (value === "::1") return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return mapped.startsWith("127.");
  }
  return value.startsWith("127.");
}

function dashboardPublicLocalEnabled() {
  return String(process.env.DASHBOARD_PUBLIC_LOCAL || "false").toLowerCase() === "true";
}

function dashboardActionsEnabled() {
  return String(process.env.DASHBOARD_ENABLE_ACTIONS || "false").toLowerCase() === "true";
}

function canBypassDashboardAuth(remoteAddress) {
  return dashboardPublicLocalEnabled() && isLoopbackAddress(remoteAddress);
}

async function checkHttp(url, expectedStatuses = [200]) {
  try {
    const response = await fetch(url, { method: "GET" });
    return {
      ok: expectedStatuses.includes(Number(response.status)),
      statusCode: Number(response.status || 0),
    };
  } catch {
    return { ok: false, statusCode: 0 };
  }
}

async function checkProcess(pattern) {
  try {
    const result = await execFileAsync("pgrep", ["-f", pattern]);
    const stdout = String(result.stdout || "").trim();
    return Boolean(stdout);
  } catch {
    return false;
  }
}

function parseStackStatusOutput(stdout) {
  const text = String(stdout || "");
  const lineFor = (name) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${name}:`)) || "";

  const appLine = lineFor("app");
  const n8nLine = lineFor("n8n");
  const observabilityLine = lineFor("observability");
  const cloudflaredLine = lineFor("cloudflared");

  return {
    app: appLine.includes("running"),
    n8n: n8nLine.includes("running"),
    observability: observabilityLine.includes("healthy"),
    cloudflared: cloudflaredLine.includes("running"),
    raw: text,
  };
}

async function getLocalRuntimeStatus() {
  const [stackStatus, n8nHealth, lokiReady, grafanaHealth, cursorRunning] = await Promise.all([
    execFileAsync("./scripts/stack-control.sh", ["status", "full"], { cwd: process.cwd() })
      .then((result) => parseStackStatusOutput(result.stdout))
      .catch(() => ({ app: false, n8n: false, observability: false, cloudflared: false, raw: "" })),
    checkHttp("http://127.0.0.1:5678/healthz", [200]),
    checkHttp("http://127.0.0.1:3100/ready", [200]),
    checkHttp("http://127.0.0.1:3001/api/health", [200]),
    checkProcess("cursor|Cursor"),
  ]);

  return {
    stack: stackStatus,
    services: {
      app: { running: stackStatus.app, detail: stackStatus.app ? "running" : "stopped" },
      n8n: { running: stackStatus.n8n && n8nHealth.ok, detail: n8nHealth.ok ? "healthy" : "unreachable" },
      loki: {
        running: lokiReady.ok || lokiReady.statusCode === 503,
        detail: (() => {
          if (lokiReady.ok) return "ready";
          if (lokiReady.statusCode === 503) return "warming up";
          return "not ready";
        })(),
      },
      grafana: { running: grafanaHealth.ok, detail: grafanaHealth.ok ? "healthy" : "not ready" },
      cloudflared: { running: stackStatus.cloudflared, detail: stackStatus.cloudflared ? "running" : "stopped" },
      cursor: { running: cursorRunning, detail: cursorRunning ? "running" : "not running" },
    },
  };
}

function assertAllowedProfile(profile) {
  const value = String(profile || "core").trim().toLowerCase();
  if (!["core", "extended", "full"].includes(value)) {
    throw new Error("profile must be one of: core, extended, full");
  }
  return value;
}

function assertAllowedAction(action) {
  const value = String(action || "status").trim().toLowerCase();
  if (!["start", "stop", "restart", "status"].includes(value)) {
    throw new Error("action must be one of: start, stop, restart, status");
  }
  return value;
}

async function runStackControl(action, profile) {
  const safeAction = assertAllowedAction(action);
  const safeProfile = assertAllowedProfile(profile);
  const result = await execFileAsync("./scripts/stack-control.sh", [safeAction, safeProfile], { cwd: process.cwd() });
  return {
    action: safeAction,
    profile: safeProfile,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

async function launchAipipelineCursor() {
  const child = execFile("./scripts/aipipeline-cursor.sh", [], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return { ok: true, pid: Number(child.pid || 0) };
}

module.exports = {
  isLoopbackAddress,
  dashboardPublicLocalEnabled,
  dashboardActionsEnabled,
  canBypassDashboardAuth,
  getLocalRuntimeStatus,
  runStackControl,
  launchAipipelineCursor,
};
