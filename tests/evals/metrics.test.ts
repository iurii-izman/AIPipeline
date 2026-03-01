import { describe, expect, it } from "vitest";
import { calculateMetrics, gateEval, heuristicSeverity, makeEvalResult } from "../../src/evals/metrics";
import type { ClassificationDecision, EvalCase } from "../../src/evals/types";

function mkCase(id: string, severity: "critical" | "non_critical", title: string): EvalCase {
  return {
    caseId: id,
    source: "sentry",
    input: { title },
    expected: { severity },
  };
}

function mkDecision(severity: "critical" | "non_critical"): ClassificationDecision {
  return {
    modelVersionTag: "alpha-v1",
    severity,
    confidence: 0.9,
    reason: "test",
    fallbackUsed: false,
  };
}

describe("eval metrics", () => {
  it("calculates precision/recall/fnr", () => {
    const cases: EvalCase[] = [
      mkCase("1", "critical", "db timeout cascade"),
      mkCase("2", "critical", "oom"),
      mkCase("3", "non_critical", "ui glitch"),
      mkCase("4", "non_critical", "minor warning"),
    ];
    const decisions: ClassificationDecision[] = [
      mkDecision("critical"),
      mkDecision("non_critical"),
      mkDecision("non_critical"),
      mkDecision("critical"),
    ];

    const metrics = calculateMetrics(cases, decisions);
    expect(metrics.precisionCritical).toBeCloseTo(0.5, 5);
    expect(metrics.recallCritical).toBeCloseTo(0.5, 5);
    expect(metrics.fnrCritical).toBeCloseTo(0.5, 5);
  });

  it("applies gate thresholds", () => {
    const pass = gateEval(
      { precisionCritical: 0.72, recallCritical: 0.97, fnrCritical: 0.03, macroF1: 0.81 },
      { minPrecisionCritical: 0.7, minRecallCritical: 0.95, maxFnrCritical: 0.05 }
    );
    const fail = gateEval(
      { precisionCritical: 0.66, recallCritical: 0.97, fnrCritical: 0.03, macroF1: 0.78 },
      { minPrecisionCritical: 0.7, minRecallCritical: 0.95, maxFnrCritical: 0.05 }
    );

    expect(pass).toBe(true);
    expect(fail).toBe(false);
  });

  it("builds EvalResult object", () => {
    const cases = [mkCase("1", "critical", "db timeout")];
    const decisions = [mkDecision("critical")];

    const result = makeEvalResult({
      modelVersionTag: "alpha-v2",
      cases,
      decisions,
      gate: { minPrecisionCritical: 0.7, minRecallCritical: 0.95, maxFnrCritical: 0.05 },
      now: "2026-03-01T00:00:00.000Z",
    });

    expect(result.modelVersionTag).toBe("alpha-v2");
    expect(result.sampleSize).toBe(1);
    expect(result.pass).toBe(true);
  });

  it("provides heuristic baseline", () => {
    expect(heuristicSeverity({ title: "db timeout cascade detected", level: "error" })).toBe("critical");
    expect(heuristicSeverity({ title: "layout warning", level: "warning" })).toBe("non_critical");
  });
});
