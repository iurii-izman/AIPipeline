#!/usr/bin/env node

/**
 * Minimal offline AI eval harness for WF-3 severity classification.
 *
 * Usage:
 *   node scripts/run-ai-eval.js \
 *     --dataset evals/datasets/sentry-severity-alpha.json \
 *     --model-tag alpha-heuristic-v1 \
 *     --fail-on-gate
 */

const fs = require("node:fs");
const path = require("node:path");
const { heuristicSeverity, makeEvalResult } = require("../src/evals/runtime.js");

function parseArgs(argv) {
  const out = {
    dataset: "evals/datasets/sentry-severity-alpha.json",
    modelTag: "alpha-heuristic-v1",
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
    if (a === "--fail-on-gate") {
      out.failOnGate = true;
    }
  }

  return out;
}

function loadDataset(datasetPath) {
  const raw = fs.readFileSync(datasetPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Dataset must be JSON array");
  }
  return parsed;
}

function main() {
  const args = parseArgs(process.argv);
  const datasetPath = path.resolve(process.cwd(), args.dataset);
  const cases = loadDataset(datasetPath);

  const decisions = cases.map((c) => ({
    modelVersionTag: args.modelTag,
    severity: heuristicSeverity(c.input || {}),
    confidence: 0.7,
    reason: "heuristic-baseline",
    fallbackUsed: true,
  }));

  const gate = {
    minPrecisionCritical: 0.7,
    minRecallCritical: 0.95,
    maxFnrCritical: 0.05,
  };

  const result = makeEvalResult({
    modelVersionTag: args.modelTag,
    cases,
    decisions,
    gate,
  });

  const outDir = path.resolve(process.cwd(), ".out/evals");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `eval-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log("AI eval completed");
  console.log("dataset:", datasetPath);
  console.log("report:", outPath);
  console.log("metrics:", JSON.stringify(result.metrics));
  console.log("pass:", result.pass);

  if (args.failOnGate && !result.pass) {
    process.exitCode = 2;
  }
}

main();
