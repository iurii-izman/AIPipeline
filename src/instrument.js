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
const otelEnabled = String(process.env.OTEL_PILOT_ENABLED || "false").toLowerCase() === "true";

if (otelEnabled) {
  try {
    if (String(process.env.OTEL_DEBUG || "false").toLowerCase() === "true") {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";
    otelSdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || "aipipeline-control-plane",
      traceExporter: new OTLPTraceExporter({ url: exporterUrl }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    otelSdk
      .start()
      .then(() => {
        console.log(JSON.stringify({ level: "info", message: "otel pilot started", exporterUrl }));
      })
      .catch((err) => {
        console.error(JSON.stringify({ level: "error", message: "otel pilot start failed", error: String(err) }));
      });

    const shutdown = () => {
      if (!otelSdk) return Promise.resolve();
      return otelSdk.shutdown().catch(() => {});
    };
    process.once("beforeExit", shutdown);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "otel pilot initialization failed", error: String(err) }));
  }
}
