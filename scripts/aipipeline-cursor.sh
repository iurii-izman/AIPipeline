#!/usr/bin/env bash
# Запуск Cursor с env из keyring для AIPipeline. Можно вызывать из любой папки.
# Один раз добавь в PATH: ln -sf /var/home/user/Projects/AIPipeline/scripts/aipipeline-cursor.sh ~/.local/bin/aipipeline-cursor
# Дальше из любой папки: aipipeline-cursor

SCRIPT_PATH="${BASH_SOURCE[0]}"
[[ -L "$SCRIPT_PATH" ]] && SCRIPT_PATH=$(readlink -f "$SCRIPT_PATH" 2>/dev/null || realpath "$SCRIPT_PATH" 2>/dev/null)
PROJECT_ROOT=$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)
exec "$PROJECT_ROOT/scripts/load-env-from-keyring.sh" --cursor
