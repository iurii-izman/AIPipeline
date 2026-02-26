#!/usr/bin/env bash
# Run n8n in Podman. Set N8N_BASIC_AUTH_USER and N8N_BASIC_AUTH_PASSWORD (e.g. from .env).

set -e
VOLUME_NAME="${N8N_VOLUME:-n8n_data}"
CONTAINER_NAME="${N8N_CONTAINER:-n8n}"
IMAGE="${N8N_IMAGE:-docker.io/n8nio/n8n}"

if ! podman volume exists "$VOLUME_NAME" 2>/dev/null; then
  podman volume create "$VOLUME_NAME"
fi

USER="${N8N_BASIC_AUTH_USER:-}"
PASS="${N8N_BASIC_AUTH_PASSWORD:-}"
if [[ -z "$USER" || -z "$PASS" ]]; then
  echo "Set N8N_BASIC_AUTH_USER and N8N_BASIC_AUTH_PASSWORD (e.g. in .env)" >&2
  exit 1
fi

if podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container $CONTAINER_NAME already exists. Start with: podman start $CONTAINER_NAME"
  exit 0
fi

podman run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 5678:5678 \
  -v "$VOLUME_NAME:/home/node/.n8n" \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER="$USER" \
  -e N8N_BASIC_AUTH_PASSWORD="$PASS" \
  -e WEBHOOK_URL=http://localhost:5678/ \
  "$IMAGE"

echo "n8n started. Open http://localhost:5678"
