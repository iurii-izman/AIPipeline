/**
 * Sentry — init as early as possible. DSN from env (keyring or .env).
 * See docs/sentry-setup-step-by-step.md
 */
const Sentry = require("@sentry/node");
const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
}

let otelSdk;
const otelEnabled = String(process.env.OTEL_ENABLED || process.env.OTEL_PILOT_ENABLED || "false").toLowerCase() === "true";

if (otelEnabled) {
  try {
    if (String(process.env.OTEL_DEBUG || "false").toLowerCase() === "true") {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";
    const exporterHost = (() => {
      try {
        return new URL(exporterUrl).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    const otelModeFromEnv = String(process.env.OTEL_EXPORTER_MODE || "").toLowerCase();
    const otelMode =
      otelModeFromEnv ||
      (["localhost", "127.0.0.1", "host.containers.internal"].includes(exporterHost) ? "pilot" : "managed");
    const headers = Object.fromEntries(
      String(process.env.OTEL_EXPORTER_OTLP_HEADERS || "")
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const idx = chunk.indexOf("=");
          if (idx <= 0) return ["", ""];
          return [chunk.slice(0, idx).trim(), chunk.slice(idx + 1).trim()];
        })
        .filter(([key]) => Boolean(key))
    );
    otelSdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || "aipipeline-control-plane",
      traceExporter: new OTLPTraceExporter({ url: exporterUrl, headers }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    otelSdk
      .start()
      .then(() => {
        console.log(JSON.stringify({ level: "info", message: "otel started", otelMode, exporterUrl }));
      })
      .catch((err) => {
        console.error(JSON.stringify({ level: "error", message: "otel start failed", otelMode, error: String(err) }));
      });

    const shutdown = () => {
      if (!otelSdk) return Promise.resolve();
      return otelSdk.shutdown().catch(() => {});
    };
    process.once("beforeExit", shutdown);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "otel initialization failed", error: String(err) }));
  }
}
