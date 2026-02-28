/**
 * Sentry — init as early as possible. DSN from env (keyring or .env).
 * See docs/sentry-setup-step-by-step.md
 */
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
}
