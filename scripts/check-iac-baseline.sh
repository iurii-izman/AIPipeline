#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IAC_DIR="$REPO_ROOT/infra/terraform"

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

cd "$IAC_DIR"
terraform fmt -check -recursive
terraform init -backend=false -input=false >/dev/null
terraform validate

echo "IaC baseline check passed."
