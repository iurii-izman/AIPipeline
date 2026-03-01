# Release Scorecard v2 Template

Дата: YYYY-MM-DD  
Версия: vX.Y.Z  
Окружение: staging | production  
Owner: @owner

## 1) Release Decision

- Decision: `APPROVE` | `REJECT` | `HOLD`
- Decision owner:
- Decision timestamp:
- Release window:

## 2) Quality Gates

- Lint: pass/fail (evidence link)
- Build/typecheck: pass/fail (evidence link)
- Unit/integration/e2e: pass/fail (evidence link)
- Coverage threshold: pass/fail (evidence link)

## 3) Security and Supply Chain

- npm audit (high+): pass/fail
- CodeQL: pass/fail
- Docs link integrity: pass/fail
- SBOM (CycloneDX): attached yes/no
- Provenance (SLSA pilot): attached yes/no

## 4) AI Quality and Safety

- Eval alpha: pass/fail
- Eval safety: pass/fail
- Eval v2 (offline+online): pass/fail
- Model mode change in scope: yes/no
- If yes, safety gate evidence attached: yes/no

## 5) Reliability and Operations

- Env parity strict: pass/fail
- Observability alerts probe: pass/fail
- Backup retention timer healthy: yes/no
- DR cadence within 30 days: yes/no
- Cost report (30d): attached yes/no

## 6) Data Governance and Access

- Data governance policy check: pass/fail
- Access matrix reviewed: yes/no
- Privileged operation controls reviewed: yes/no
- Known open exceptions (with expiry date):

## 7) Risk Log and Mitigations

| Risk | Severity | Mitigation | Owner | ETA |
|---|---|---|---|---|
|  |  |  |  |  |

## 8) Evidence Links

- CI run:
- Release gate output:
- Eval reports:
- Eval v2 report:
- SBOM artifact:
- Provenance artifact:
- DR evidence report:
- Cost report:
- Change log / PR list:

## 9) Sign-off

- Engineering:
- Security:
- Product/Owner:
