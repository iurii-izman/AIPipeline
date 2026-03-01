function div(num, den) {
  if (den === 0) return 0;
  return num / den;
}

function f1(precision, recall) {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function calculateMetrics(cases, decisions) {
  if (cases.length !== decisions.length) {
    throw new Error("cases and decisions length mismatch");
  }

  let tpCritical = 0;
  let fpCritical = 0;
  let fnCritical = 0;
  let tpNonCritical = 0;
  let fpNonCritical = 0;
  let fnNonCritical = 0;

  for (let i = 0; i < cases.length; i += 1) {
    const expected = cases[i]?.expected?.severity;
    const predicted = decisions[i]?.severity;
    if (!expected || !predicted) continue;

    if (expected === "critical" && predicted === "critical") tpCritical += 1;
    if (expected !== "critical" && predicted === "critical") fpCritical += 1;
    if (expected === "critical" && predicted !== "critical") fnCritical += 1;

    if (expected === "non_critical" && predicted === "non_critical") tpNonCritical += 1;
    if (expected !== "non_critical" && predicted === "non_critical") fpNonCritical += 1;
    if (expected === "non_critical" && predicted !== "non_critical") fnNonCritical += 1;
  }

  const precisionCritical = div(tpCritical, tpCritical + fpCritical);
  const recallCritical = div(tpCritical, tpCritical + fnCritical);
  const fnrCritical = div(fnCritical, tpCritical + fnCritical);

  const precisionNonCritical = div(tpNonCritical, tpNonCritical + fpNonCritical);
  const recallNonCritical = div(tpNonCritical, tpNonCritical + fnNonCritical);

  return {
    precisionCritical,
    recallCritical,
    fnrCritical,
    macroF1: (f1(precisionCritical, recallCritical) + f1(precisionNonCritical, recallNonCritical)) / 2,
  };
}

function gateEval(metrics, gate) {
  return (
    metrics.precisionCritical >= gate.minPrecisionCritical &&
    metrics.recallCritical >= gate.minRecallCritical &&
    metrics.fnrCritical <= gate.maxFnrCritical
  );
}

function makeEvalResult(params) {
  const metrics = calculateMetrics(params.cases, params.decisions);
  return {
    modelVersionTag: params.modelVersionTag,
    evaluatedAt: params.now || new Date().toISOString(),
    sampleSize: params.cases.length,
    metrics,
    pass: gateEval(metrics, params.gate),
  };
}

function heuristicSeverity(input) {
  const text = `${input.title || ""} ${input.payloadSnippet || ""}`.toLowerCase();
  const level = (input.level || "").toLowerCase();
  if (level === "fatal") return "critical";
  if (/(database|db).{0,40}(timeout|connection pool|too many connections|exhausted)/i.test(text)) return "critical";
  if (/(panic|crash loop|outofmemory|oom|auth outage|payment outage)/i.test(text)) return "critical";
  return "non_critical";
}

module.exports = {
  calculateMetrics,
  gateEval,
  makeEvalResult,
  heuristicSeverity,
};
