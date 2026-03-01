import type { ClassificationDecision, EvalCase, EvalGate, EvalMetrics, EvalResult, Severity } from "./types";

type Counts = {
  tpCritical: number;
  fpCritical: number;
  fnCritical: number;
  tpNonCritical: number;
  fpNonCritical: number;
  fnNonCritical: number;
};

function f1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function div(num: number, den: number): number {
  if (den === 0) return 0;
  return num / den;
}

function buildCounts(cases: EvalCase[], decisions: ClassificationDecision[]): Counts {
  // Keep deterministic matching by index; callers should pass aligned arrays.
  const counts: Counts = {
    tpCritical: 0,
    fpCritical: 0,
    fnCritical: 0,
    tpNonCritical: 0,
    fpNonCritical: 0,
    fnNonCritical: 0,
  };

  for (let i = 0; i < cases.length; i += 1) {
    const expected = cases[i]?.expected.severity;
    const predicted = decisions[i]?.severity;
    if (!expected || !predicted) continue;

    if (expected === "critical" && predicted === "critical") counts.tpCritical += 1;
    if (expected !== "critical" && predicted === "critical") counts.fpCritical += 1;
    if (expected === "critical" && predicted !== "critical") counts.fnCritical += 1;

    if (expected === "non_critical" && predicted === "non_critical") counts.tpNonCritical += 1;
    if (expected !== "non_critical" && predicted === "non_critical") counts.fpNonCritical += 1;
    if (expected === "non_critical" && predicted !== "non_critical") counts.fnNonCritical += 1;
  }

  return counts;
}

export function calculateMetrics(cases: EvalCase[], decisions: ClassificationDecision[]): EvalMetrics {
  if (cases.length !== decisions.length) {
    throw new Error("cases and decisions length mismatch");
  }

  const counts = buildCounts(cases, decisions);

  const precisionCritical = div(counts.tpCritical, counts.tpCritical + counts.fpCritical);
  const recallCritical = div(counts.tpCritical, counts.tpCritical + counts.fnCritical);
  const fnrCritical = div(counts.fnCritical, counts.tpCritical + counts.fnCritical);

  const precisionNonCritical = div(counts.tpNonCritical, counts.tpNonCritical + counts.fpNonCritical);
  const recallNonCritical = div(counts.tpNonCritical, counts.tpNonCritical + counts.fnNonCritical);

  const macroF1 = (f1(precisionCritical, recallCritical) + f1(precisionNonCritical, recallNonCritical)) / 2;

  return {
    precisionCritical,
    recallCritical,
    fnrCritical,
    macroF1,
  };
}

export function gateEval(metrics: EvalMetrics, gate: EvalGate): boolean {
  return (
    metrics.precisionCritical >= gate.minPrecisionCritical &&
    metrics.recallCritical >= gate.minRecallCritical &&
    metrics.fnrCritical <= gate.maxFnrCritical
  );
}

export function makeEvalResult(params: {
  modelVersionTag: string;
  cases: EvalCase[];
  decisions: ClassificationDecision[];
  gate: EvalGate;
  now?: string;
}): EvalResult {
  const metrics = calculateMetrics(params.cases, params.decisions);
  return {
    modelVersionTag: params.modelVersionTag,
    evaluatedAt: params.now || new Date().toISOString(),
    sampleSize: params.cases.length,
    metrics,
    pass: gateEval(metrics, params.gate),
  };
}

export function heuristicSeverity(input: { title: string; payloadSnippet?: string; level?: string }): Severity {
  const text = `${input.title || ""} ${input.payloadSnippet || ""}`.toLowerCase();
  const level = (input.level || "").toLowerCase();
  if (level === "fatal") return "critical";
  if (/(database|db).{0,40}(timeout|connection pool|too many connections|exhausted)/i.test(text)) return "critical";
  if (/(panic|crash loop|outofmemory|oom|auth outage|payment outage)/i.test(text)) return "critical";
  return "non_critical";
}
