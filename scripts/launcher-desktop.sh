#!/bin/zsh
# Electron desktop launcher logic.
#
# Do not execute this file directly via ./scripts/launcher-desktop.sh from
# Finder; double-click run_desktop.command at the project root instead. The
# .command stub invokes this script as an argument to /bin/zsh, which
# keeps macOS AppleSystemPolicy from rejecting it after a Cursor edit.

set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
cd "$SCRIPT_DIR" || exit 1

LOG_DIR="${SCRIPT_DIR}/data/logs"
mkdir -p "$LOG_DIR" >/dev/null 2>&1 || true
LOG_FILE="${LOG_DIR}/desktop-launcher-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

PROJECT_TITLE="AI Learning Assistant Desktop"

pause_on_failure() {
  if [ -t 0 ] && [ "${AILA_NO_PAUSE:-}" != "1" ]; then
    echo
    echo "Press any key to close this window."
    read -k 1 _unused
  fi
}

fail() {
  echo
  echo "Launch failed: $1"
  echo "Log file: ${LOG_FILE}"
  pause_on_failure
  exit 1
}

echo "$PROJECT_TITLE"
echo "Launcher log: ${LOG_FILE}"
echo "Starting Electron shell..."
echo "Use ./run_web.command for Docker plus browser QA without Electron."

if [ -x "apps/desktop/node_modules/.bin/electron" ] && command -v node >/dev/null 2>&1; then
  echo "The desktop window will handle Docker startup and show any startup errors."
  (
    cd apps/desktop || exit 1
    ./node_modules/.bin/electron .
  )
  electron_status=$?
  if [ "$electron_status" -ne 0 ]; then
    fail "Electron exited with status ${electron_status}."
  fi
  exit 0
fi

fail "Electron dependencies are not installed or Node.js is not on PATH. Run npm --prefix apps/desktop install for Electron, or use ./run_web.command for browser QA."
