#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { readAiTelemetryEvents } = require("../src/opsStore.js");

const MODEL_TOKEN_PRICING_PER_1K = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
};

function parseArgs(argv) {
  const out = {
    days: 30,
    monthlyBudgetUsd: Number(process.env.COST_BUDGET_USD || 25),
    strictBudget: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--days" && argv[i + 1]) {
      out.days = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--monthly-budget" && argv[i + 1]) {
      out.monthlyBudgetUsd = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--strict-budget") {
      out.strictBudget = true;
    }
  }
  return out;
}

function estimateCostUsd(event) {
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

function main() {
  const args = parseArgs(process.argv);
  const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();

  const events = readAiTelemetryEvents().filter((event) => {
    const observedAt = String(event.observedAt || event.evaluatedAt || "");
    return !observedAt || observedAt >= sinceIso;
  });

  const byModel = new Map();
  let totalCost = 0;
  for (const event of events) {
    const model = String(event.model || "unknown");
    const cost = estimateCostUsd(event);
    totalCost += cost;
    const prev = byModel.get(model) || { count: 0, costUsd: 0 };
    byModel.set(model, {
      count: prev.count + 1,
      costUsd: prev.costUsd + cost,
    });
  }

  const outDir = path.resolve(process.cwd(), ".out/cost");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const mdPath = path.join(outDir, `cost-report-${stamp}.md`);
  const jsonPath = path.join(outDir, `cost-report-${stamp}.json`);

  const budgetRatio = args.monthlyBudgetUsd > 0 ? totalCost / args.monthlyBudgetUsd : 0;
  const budgetBreached = args.monthlyBudgetUsd > 0 && totalCost > args.monthlyBudgetUsd;

  const modelsTable = Array.from(byModel.entries())
    .sort((a, b) => b[1].costUsd - a[1].costUsd)
    .map(([model, stats]) => `| ${model} | ${stats.count} | ${stats.costUsd.toFixed(4)} |`)
    .join("\n");

  const report = {
    generatedAt: new Date().toISOString(),
    since: sinceIso,
    days: args.days,
    monthlyBudgetUsd: args.monthlyBudgetUsd,
    totalCostUsd: Number(totalCost.toFixed(6)),
    budgetBreached,
    sampleSize: events.length,
    byModel: Array.from(byModel.entries()).map(([model, stats]) => ({
      model,
      count: stats.count,
      costUsd: Number(stats.costUsd.toFixed(6)),
    })),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    mdPath,
    [
      "# AI Cost Report",
      "",
      `- generatedAt: \`${report.generatedAt}\``,
      `- since: \`${sinceIso}\``,
      `- sampleSize: \`${events.length}\``,
      `- totalCostUsd: \`${report.totalCostUsd.toFixed(4)}\``,
      `- monthlyBudgetUsd: \`${args.monthlyBudgetUsd.toFixed(2)}\``,
      `- budgetRatio: \`${(budgetRatio * 100).toFixed(2)}%\``,
      `- budgetStatus: \`${budgetBreached ? "breached" : "ok"}\``,
      "",
      "## Model Breakdown",
      "",
      "| model | events | costUsd |",
      "|---|---:|---:|",
      modelsTable || "| n/a | 0 | 0.0000 |",
      "",
      `JSON report: \`${jsonPath}\``,
    ].join("\n")
  );

  console.log("Cost report generated");
  console.log("markdown:", mdPath);
  console.log("json:", jsonPath);
  console.log("sampleSize:", events.length);
  console.log("totalCostUsd:", report.totalCostUsd.toFixed(4));
  console.log("budgetBreached:", budgetBreached);

  if (args.strictBudget && budgetBreached) {
    process.exitCode = 2;
  }
}

main();
