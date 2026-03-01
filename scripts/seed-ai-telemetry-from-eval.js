#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { heuristicSeverity } = require("../src/evals/runtime.js");
const { appendAiTelemetryEvent } = require("../src/opsStore.js");

function parseArgs(argv) {
  const out = {
    dataset: "evals/datasets/sentry-severity-alpha.json",
    limit: 50,
    model: "gpt-4o-mini",
    fallbackRate: 0.1,
    clearWindow: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dataset" && argv[i + 1]) {
      out.dataset = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--limit" && argv[i + 1]) {
      out.limit = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--model" && argv[i + 1]) {
      out.model = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--fallback-rate" && argv[i + 1]) {
      out.fallbackRate = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--clear-window") {
      out.clearWindow = true;
    }
  }
  return out;
}

function loadDataset(datasetPath) {
  const raw = fs.readFileSync(datasetPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Dataset must be JSON array");
  return parsed;
}

function main() {
  const args = parseArgs(process.argv);
  const datasetPath = path.resolve(process.cwd(), args.dataset);
  const rows = loadDataset(datasetPath);
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.min(args.limit, rows.length) : rows.length;
  const fallbackRate =
    Number.isFinite(args.fallbackRate) && args.fallbackRate >= 0 && args.fallbackRate <= 1 ? args.fallbackRate : 0.1;
  const now = new Date();

  if (args.clearWindow) {
    const storeFile = path.resolve(process.cwd(), ".runtime-logs/ai-online-telemetry.jsonl");
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    fs.writeFileSync(storeFile, "", "utf8");
  }

  let written = 0;
  for (let i = 0; i < limit; i += 1) {
    const c = rows[i];
    const predicted = heuristicSeverity(c.input || {});
    const observedAt = new Date(now.getTime() - (limit - i) * 60 * 1000).toISOString();
    const fallbackUsed = i < Math.round(limit * fallbackRate);
    appendAiTelemetryEvent({
      source: "seed-eval-dataset",
      observedAt,
      model: args.model,
      fallbackUsed,
      expectedSeverity: c?.expected?.severity || "non_critical",
      predictedSeverity: predicted,
      promptTokens: 900,
      completionTokens: 140,
      caseId: c?.caseId || `seed-${i}`,
    });
    written += 1;
  }

  console.log("Seeded AI online telemetry events");
  console.log("dataset:", datasetPath);
  console.log("written:", written);
}

main();
