#!/usr/bin/env bash
# PIPELINE Appendix B — автопроверка среды (Fedora Atomic).
# Запуск: ./scripts/system-check.sh
#
# Если VARIANT = "Toolbx Container Image" — ты внутри toolbox: Node/Podman/Flatpak
# на хосте; внутри контейнера их нет. Чтобы иметь Node в toolbox:
#   ./scripts/setup-toolbox-aipipeline.sh
# Полная картина (хост): запускай system-check на хосте, не из toolbox.

echo "=== OS ==="
cat /etc/os-release 2>/dev/null | grep -E "^(NAME|VERSION|VARIANT)" || true
echo ""

echo "=== Hardware ==="
echo "RAM: $(free -h | awk '/Mem:/ {print $2}')"
echo "CPU: $(lscpu | grep 'Model name' | cut -d: -f2 | xargs)"
echo "Cores: $(nproc)"
echo "Disk free: $(df -h /home 2>/dev/null | tail -1 | awk '{print $4}')"
echo ""

echo "=== Container Runtime ==="
podman --version 2>/dev/null || echo "Podman: NOT FOUND"
docker --version 2>/dev/null || echo "Docker: NOT FOUND"
echo ""

echo "=== Dev Tools ==="
node --version 2>/dev/null || echo "Node.js: NOT FOUND"
npm --version 2>/dev/null || echo "npm: NOT FOUND"
npx --version 2>/dev/null || echo "npx: NOT FOUND"
git --version 2>/dev/null || echo "git: NOT FOUND"
claude --version 2>/dev/null || echo "Claude Code: NOT FOUND"
echo ""

echo "=== Toolbox/Distrobox ==="
toolbox --version 2>/dev/null || echo "Toolbox: NOT FOUND"
distrobox --version 2>/dev/null || echo "Distrobox: NOT FOUND"
echo ""

echo "=== Flatpak ==="
flatpak --version 2>/dev/null || echo "Flatpak: NOT FOUND"
flatpak list --app 2>/dev/null | head -10
echo ""

echo "=== Running Containers ==="
podman ps 2>/dev/null || docker ps 2>/dev/null || echo "No container runtime active"
echo ""

echo "=== Network (key ports) ==="
ss -tlnp 2>/dev/null | grep -E ':(5678|3000|8080|9090)' || echo "No known service ports active"
echo ""

# Phase 0.5: Ready / Setup / Blockers (delivery-pipeline.md)
echo "=== Phase 0.5: Environment Report ==="
READY=""
SETUP=""
BLOCKERS=""

command -v node >/dev/null 2>&1 && READY="${READY:+$READY }Node.js" || SETUP="${SETUP:+$SETUP }Node.js (toolbox: ./scripts/setup-toolbox-aipipeline.sh)"
command -v podman >/dev/null 2>&1 && READY="${READY:+$READY }Podman" || SETUP="${SETUP:+$SETUP }Podman"
command -v git >/dev/null 2>&1 && READY="${READY:+$READY }git" || SETUP="${SETUP:+$SETUP }git"
command -v npx >/dev/null 2>&1 && READY="${READY:+$READY }npx" || SETUP="${SETUP:+$SETUP }npx"
[[ -n "$READY" ]] && echo "✅ Ready: $READY"
[[ -n "$SETUP" ]] && echo "🔧 Setup: $SETUP"
[[ -n "$BLOCKERS" ]] && echo "❓ Blockers: $BLOCKERS" || true
