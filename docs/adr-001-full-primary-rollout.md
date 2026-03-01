# ADR-001: Rollout Policy for `MODEL_CLASSIFIER_MODE=full_primary`

## Status
Accepted

## Date
2026-03-01

## Context
- WF-3 now supports `heuristic_only`, `shadow`, `full_primary`, and `MODEL_KILL_SWITCH`.
- Full primary mode changes incident classification behavior and can impact Linear/Telegram alert quality.
- Before this ADR, dataset size and rollback criteria were not decision-complete.

## Decision
- Rollout to `full_primary` is allowed only when all preconditions below are true:
  1. Eval dataset has `>=150` labeled cases (`evals/datasets/sentry-severity-alpha.json` currently 150).
  2. `npm run eval:alpha` passes gate thresholds:
     - `precisionCritical >= 0.70`
     - `recallCritical >= 0.95`
     - `fnrCritical <= 0.05`
  3. WF-3 schema safety is active:
     - input sanitization + delimiters (`BEGIN_SENTRY_EVENT`/`END_SENTRY_EVENT`)
     - strict LLM output schema validation
     - heuristic fallback on schema mismatch
  4. `MODEL_KILL_SWITCH=false` explicitly set in keyring/env.

- Rollout sequence:
  1. Keep `MODEL_CLASSIFIER_MODE=shadow` for at least 24h under normal traffic.
  2. Review generated incidents and false-negative candidates from Sentry/Linear.
  3. Switch to `MODEL_CLASSIFIER_MODE=full_primary`.
  4. Monitor first 2 hours with increased attention to critical incidents.

## Consequences
### Positive
- Controlled transition with measurable quality gates.
- Fast operational fallback path remains available via kill switch.

### Negative / Tradeoffs
- Rollout is slower and requires explicit pre-release validation.
- Additional operational discipline is required in the first monitoring window.

### Follow-up Actions
- Add broader dataset curation cycle (weekly refresh).
- Add reporting for mismatch/fallback rate in WF-3 telemetry.

## Rollback / Exit Criteria
- Immediate rollback to `heuristic_only` when at least one condition is true:
  1. Critical false negatives are detected in production flow.
  2. LLM schema mismatch/fallback rate exceeds 10% for 30 minutes.
  3. Any incident indicates unsafe model output propagation.

- Rollback steps:
  1. Set `MODEL_KILL_SWITCH=true` (or set `MODEL_CLASSIFIER_MODE=heuristic_only`).
  2. Restart affected runtime (`n8n` and app env if needed).
  3. Run `./scripts/health-check-env.sh` and verify `/status`.
  4. Open incident note in Notion/Linear with evidence and timeline.
