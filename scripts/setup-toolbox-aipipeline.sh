#!/usr/bin/env bash
# Установка Node.js в toolbox aipipeline (Fedora). Запускать изнутри контейнера:
#   toolbox enter aipipeline
#   cd /path/to/AIPipeline && ./scripts/setup-toolbox-aipipeline.sh

set -e
if ! grep -q "VARIANT_ID=toolbx" /etc/os-release 2>/dev/null; then
  echo "Не похоже на toolbox. Запускай внутри: toolbox enter aipipeline"
  exit 1
fi

echo "Installing Node.js and npm in toolbox..."
sudo dnf install -y nodejs npm

echo "Done. Check: node --version && npm --version"
node --version
npm --version
