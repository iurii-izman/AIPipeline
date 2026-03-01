export type Severity = "critical" | "non_critical";

export type IncidentType = "db_timeout_cascade" | "critical_generic" | "non_critical";

export type EvalCase = {
  caseId: string;
  source: "sentry";
  input: {
    title: string;
    level?: string;
    culprit?: string;
    project?: string;
    payloadSnippet?: string;
  };
  expected: {
    severity: Severity;
    incidentType?: IncidentType;
  };
  meta?: {
    labeledBy: string;
    labeledAt: string;
    notes?: string;
  };
};

export type ClassificationDecision = {
  modelVersionTag: string;
  severity: Severity;
  confidence: number;
  reason: string;
  fallbackUsed: boolean;
};

export type EvalMetrics = {
  precisionCritical: number;
  recallCritical: number;
  fnrCritical: number;
  macroF1: number;
};

export type EvalResult = {
  modelVersionTag: string;
  evaluatedAt: string;
  sampleSize: number;
  metrics: EvalMetrics;
  pass: boolean;
};

export type EvalGate = {
  minPrecisionCritical: number;
  minRecallCritical: number;
  maxFnrCritical: number;
};
