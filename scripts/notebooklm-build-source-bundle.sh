#!/usr/bin/env bash
# Build NotebookLM source bundle from selected project docs.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/.out/notebooklm-sources"
BUNDLE_TS="$(date +%Y%m%d-%H%M%S)"
BUNDLE_FILE="$ROOT_DIR/.out/notebooklm-sources-$BUNDLE_TS.tar.gz"

mkdir -p "$OUT_DIR"
rm -rf "$OUT_DIR"/*

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
}

copy_if_exists "$ROOT_DIR/PIPELINE.md" "$OUT_DIR/PIPELINE.md"
copy_if_exists "$ROOT_DIR/README.md" "$OUT_DIR/README.md"
copy_if_exists "$ROOT_DIR/docs/status-summary.md" "$OUT_DIR/docs/status-summary.md"
copy_if_exists "$ROOT_DIR/docs/NEXT-STEPS.md" "$OUT_DIR/docs/NEXT-STEPS.md"
copy_if_exists "$ROOT_DIR/docs/tz-remaining-work.md" "$OUT_DIR/docs/tz-remaining-work.md"
copy_if_exists "$ROOT_DIR/docs/data-mapping.md" "$OUT_DIR/docs/data-mapping.md"
copy_if_exists "$ROOT_DIR/docs/observability.md" "$OUT_DIR/docs/observability.md"
copy_if_exists "$ROOT_DIR/docs/n8n-workflows/README.md" "$OUT_DIR/docs/n8n-workflows/README.md"
copy_if_exists "$ROOT_DIR/docs/live-uat-telegram.md" "$OUT_DIR/docs/live-uat-telegram.md"
copy_if_exists "$ROOT_DIR/docs/uat-evidence-2026-02-28.md" "$OUT_DIR/docs/uat-evidence-2026-02-28.md"

cat > "$OUT_DIR/manifest.json" <<MANIFEST
{
  "generatedAt": "$(date -Iseconds)",
  "project": "AIPipeline",
  "bundlePurpose": "NotebookLM source sync",
  "files": [
    "PIPELINE.md",
    "README.md",
    "docs/status-summary.md",
    "docs/NEXT-STEPS.md",
    "docs/tz-remaining-work.md",
    "docs/data-mapping.md",
    "docs/observability.md",
    "docs/n8n-workflows/README.md",
    "docs/live-uat-telegram.md",
    "docs/uat-evidence-2026-02-28.md"
  ]
}
MANIFEST

cat > "$OUT_DIR/FAQ.md" <<'FAQ'
# AIPipeline FAQ (NotebookLM Seed)

## What is the stable n8n endpoint?
`https://n8n.aipipeline.cc`

## Which workflows are active?
WF-1 through WF-7.

## How are failures handled?
Retry/backoff + partial-failure fallbacks + centralized DLQ/replay (WF-7).

## Where is source of truth for current status?
`docs/status-summary.md` and `docs/NEXT-STEPS.md`.

## Where is evidence for live UAT?
`docs/live-uat-telegram.md` and `docs/uat-evidence-2026-02-28.md`.
FAQ

mkdir -p "$ROOT_DIR/.out"
tar -czf "$BUNDLE_FILE" -C "$OUT_DIR" .

echo "NotebookLM source bundle ready: $BUNDLE_FILE"
echo "Unpacked source dir: $OUT_DIR"
