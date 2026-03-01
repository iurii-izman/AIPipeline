#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { heuristicSeverity, makeEvalResult } = require("../src/evals/runtime.js");
const { readAiTelemetryEvents } = require("../src/opsStore.js");

function parseArgs(argv) {
  const out = {
    dataset: "evals/datasets/sentry-severity-alpha.json",
    modelTag: "alpha-heuristic-v2",
    minCases: 100,
    onlineWindowDays: 30,
    minOnlineSamples: 20,
    maxFallbackRate: 0.2,
    maxMismatchRate: 0.15,
    maxCriticalMissRate: 0.1,
    failOnGate: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dataset" && argv[i + 1]) {
      out.dataset = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--model-tag" && argv[i + 1]) {
      out.modelTag = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--min-cases" && argv[i + 1]) {
      out.minCases = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--online-window-days" && argv[i + 1]) {
      out.onlineWindowDays = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--min-online-samples" && argv[i + 1]) {
      out.minOnlineSamples = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--max-fallback-rate" && argv[i + 1]) {
      out.maxFallbackRate = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--max-mismatch-rate" && argv[i + 1]) {
      out.maxMismatchRate = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--max-critical-miss-rate" && argv[i + 1]) {
      out.maxCriticalMissRate = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--fail-on-gate") {
      out.failOnGate = true;
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

function countLabels(cases) {
  const out = { critical: 0, nonCritical: 0 };
  for (const c of cases) {
    if (c?.expected?.severity === "critical") out.critical += 1;
    if (c?.expected?.severity === "non_critical") out.nonCritical += 1;
  }
  return out;
}

function summarizeOnline(events) {
  let fallbackCount = 0;
  let mismatchCount = 0;
  let mismatchDen = 0;
  let criticalMissCount = 0;
  let criticalMissDen = 0;

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
  }

  return {
    sampleSize: events.length,
    fallbackRate: events.length ? fallbackCount / events.length : 0,
    mismatchRate: mismatchDen ? mismatchCount / mismatchDen : 0,
    criticalMissRate: criticalMissDen ? criticalMissCount / criticalMissDen : 0,
    labeledSampleSize: mismatchDen,
    criticalLabeledSampleSize: criticalMissDen,
  };
}

function sanitizeForFileName(raw) {
  return String(raw || "eval").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function main() {
  const args = parseArgs(process.argv);
  const datasetPath = path.resolve(process.cwd(), args.dataset);
  const cases = loadDataset(datasetPath);
  if (cases.length < args.minCases) {
    throw new Error(`Dataset is too small: ${cases.length}. Required at least ${args.minCases} cases.`);
  }

  const offlineDecisions = cases.map((c) => ({
    modelVersionTag: args.modelTag,
    severity: heuristicSeverity(c.input || {}),
    confidence: 0.7,
    reason: "heuristic-baseline-v2",
    fallbackUsed: true,
  }));

  const offlineGate = {
    minPrecisionCritical: 0.7,
    minRecallCritical: 0.95,
    maxFnrCritical: 0.05,
  };

  const offlineResult = makeEvalResult({
    modelVersionTag: args.modelTag,
    cases,
    decisions: offlineDecisions,
    gate: offlineGate,
  });

  const sinceIso = new Date(Date.now() - args.onlineWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const onlineEvents = readAiTelemetryEvents().filter((event) => {
    const observedAt = String(event.observedAt || event.evaluatedAt || "");
    return !observedAt || observedAt >= sinceIso;
  });
  const onlineSummary = summarizeOnline(onlineEvents);

  const onlineGateEnabled = onlineSummary.sampleSize >= args.minOnlineSamples;
  const onlinePass =
    onlineSummary.fallbackRate <= args.maxFallbackRate &&
    onlineSummary.mismatchRate <= args.maxMismatchRate &&
    onlineSummary.criticalMissRate <= args.maxCriticalMissRate;

  const pass = offlineResult.pass && (!onlineGateEnabled || onlinePass);

  const outDir = path.resolve(process.cwd(), ".out/evals");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const outPath = path.join(outDir, `eval-v2-${sanitizeForFileName(args.modelTag)}-${stamp}.json`);

  const report = {
    version: "v2",
    evaluatedAt: new Date().toISOString(),
    modelVersionTag: args.modelTag,
    pass,
    offline: {
      ...offlineResult,
      gate: offlineGate,
      datasetPath: args.dataset,
      labels: countLabels(cases),
    },
    online: {
      ...onlineSummary,
      gateEnabled: onlineGateEnabled,
      gate: {
        maxFallbackRate: args.maxFallbackRate,
        maxMismatchRate: args.maxMismatchRate,
        maxCriticalMissRate: args.maxCriticalMissRate,
        minOnlineSamples: args.minOnlineSamples,
      },
      pass: onlineGateEnabled ? onlinePass : true,
      note: onlineGateEnabled ? "online gate enforced" : "online gate skipped (insufficient sample)",
      since: sinceIso,
    },
    summary: {
      generatedBy: "scripts/run-ai-eval-v2.js",
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("AI eval v2 completed");
  console.log("dataset:", datasetPath);
  console.log("report:", outPath);
  console.log("offlinePass:", offlineResult.pass);
  console.log("onlineGateEnabled:", onlineGateEnabled);
  console.log("onlineSampleSize:", onlineSummary.sampleSize);
  console.log("onlineFallbackRate:", onlineSummary.fallbackRate.toFixed(4));
  console.log("onlineMismatchRate:", onlineSummary.mismatchRate.toFixed(4));
  console.log("onlineCriticalMissRate:", onlineSummary.criticalMissRate.toFixed(4));
  console.log("pass:", pass);

  if (args.failOnGate && !pass) {
    process.exitCode = 2;
  }
}

main();
