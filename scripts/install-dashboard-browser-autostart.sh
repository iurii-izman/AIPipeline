#!/usr/bin/env bash
# Install desktop autostart entry to open local AIPipeline dashboard on login.
# Usage:
#   ./scripts/install-dashboard-browser-autostart.sh
#   ./scripts/install-dashboard-browser-autostart.sh --disable

set -euo pipefail

DISABLE="false"
for arg in "$@"; do
  case "$arg" in
    --disable) DISABLE="true" ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/aipipeline-dashboard.desktop"

mkdir -p "$AUTOSTART_DIR"

if [[ "$DISABLE" == "true" ]]; then
  rm -f "$DESKTOP_FILE"
  echo "Removed: $DESKTOP_FILE"
  exit 0
fi

cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=AIPipeline Dashboard
Comment=Open local AIPipeline dashboard on desktop login
Exec=bash -lc 'sleep 8; xdg-open http://localhost:3000/dashboard >/dev/null 2>&1 || true'
Terminal=false
X-GNOME-Autostart-enabled=true
OnlyShowIn=GNOME;COSMIC;KDE;XFCE;LXQt;
DESKTOP

echo "Installed: $DESKTOP_FILE"
echo "Dashboard will auto-open on GUI login."
