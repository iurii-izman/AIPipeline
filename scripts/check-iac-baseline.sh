#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IAC_DIR="$REPO_ROOT/infra/terraform"

strict=false
report_file=""
declare -a envs=("staging" "production")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift
      ;;
    --report-file)
      report_file="${2:-}"
      shift 2
      ;;
    --env)
      env_name="${2:-}"
      if [[ "$env_name" != "staging" && "$env_name" != "production" ]]; then
        echo "--env must be one of: staging, production" >&2
        exit 1
      fi
      envs=("$env_name")
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--strict] [--env staging|production] [--report-file path]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$IAC_DIR" ]]; then
  echo "IaC baseline directory missing: infra/terraform" >&2
  exit 1
fi

required=(
  "$IAC_DIR/versions.tf"
  "$IAC_DIR/variables.tf"
  "$IAC_DIR/main.tf"
  "$IAC_DIR/outputs.tf"
  "$IAC_DIR/environments/staging/terraform.tfvars.example"
  "$IAC_DIR/environments/production/terraform.tfvars.example"
)

for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing IaC baseline file: $f" >&2
    exit 1
  fi
done

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform binary not found. Install terraform to run full validation." >&2
  exit 1
fi

if [[ -z "$report_file" ]]; then
  report_file="$REPO_ROOT/.out/iac/iac-plan-report.json"
fi

mkdir -p "$(dirname "$report_file")"
tmp_results="$(mktemp)"
plan_artifacts_dir="$REPO_ROOT/.out/iac/plans"
mkdir -p "$plan_artifacts_dir"

cd "$IAC_DIR"
terraform fmt -check -recursive
terraform init -backend=false -input=false >/dev/null
terraform validate

overall_ok=true
for env_name in "${envs[@]}"; do
  tfvars_file="$IAC_DIR/environments/$env_name/terraform.tfvars.example"
  plan_out="$IAC_DIR/.terraform-plan-$env_name.out"
  plan_txt="$plan_artifacts_dir/terraform-plan-$env_name.txt"
  status="ok"
  error_msg=""

  if ! terraform plan -input=false -lock=false -refresh=false -var-file="$tfvars_file" -out="$plan_out" >"$plan_txt" 2>&1; then
    status="failed"
    error_msg="$(tail -n 30 "$plan_txt" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g')"
    overall_ok=false
  fi

  rm -f "$plan_out"
  echo "$env_name|$status|$error_msg" >> "$tmp_results"
done

node - "$tmp_results" "$report_file" "$strict" <<'NODE'
const fs = require("node:fs");
const [tmpPath, reportPath, strictFlag] = process.argv.slice(2);
const lines = fs.readFileSync(tmpPath, "utf8").trim().split("\n").filter(Boolean);
const environments = lines.map((line) => {
  const [environment, status, ...rest] = line.split("|");
  return {
    environment,
    status,
    error: rest.join("|") || "",
  };
});
const failed = environments.filter((entry) => entry.status !== "ok");
const payload = {
  generatedAt: new Date().toISOString(),
  strict: strictFlag === "true",
  summary: {
    total: environments.length,
    failed: failed.length,
    ok: environments.length - failed.length,
  },
  environments,
};
fs.mkdirSync(require("node:path").dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`iac report: ${reportPath}`);
console.log(`iac summary: ${payload.summary.ok}/${payload.summary.total} ok`);
if (payload.strict && failed.length > 0) process.exit(1);
NODE

rm -f "$tmp_results"

if [[ "$overall_ok" == "true" ]]; then
  echo "IaC baseline check passed."
  exit 0
fi

echo "IaC baseline check found plan failures."
if [[ "$strict" == "true" ]]; then
  exit 1
fi
