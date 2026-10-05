#!/bin/zsh
# Web/Docker launcher logic.
#
# Do not execute this file directly via ./scripts/launcher-web.sh from
# Finder; double-click run_web.command at the project root instead. The
# .command stub invokes this script as an argument to /bin/zsh, which
# keeps macOS AppleSystemPolicy from rejecting it after a Cursor edit.

set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
cd "$SCRIPT_DIR" || exit 1

LOG_DIR="${SCRIPT_DIR}/data/logs"
mkdir -p "$LOG_DIR" >/dev/null 2>&1 || true
LOG_FILE="${LOG_DIR}/web-launcher-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

PROJECT_TITLE="AI Learning Assistant Web"
PROJECT_NAME="ai-learning-assistant"
BACKEND_URL="${AILA_BACKEND_URL:-http://127.0.0.1:14242}"

LAUNCHER_STAGE="boot"
LAUNCHER_DONE=0

pause_on_failure() {
  if [ -t 0 ] && [ "${AILA_NO_PAUSE:-}" != "1" ]; then
    echo
    echo "Press any key to close this window."
    read -k 1 _unused 2>/dev/null || true
  fi
}

fail() {
  echo
  echo "Web launch failed: $1"
  echo "Log file: ${LOG_FILE}"
  LAUNCHER_DONE=1
  pause_on_failure
  exit 1
}

on_exit() {
  local code=$?
  if [ "$LAUNCHER_DONE" = "1" ]; then
    return
  fi
  echo
  echo "Launcher exited unexpectedly during stage \"${LAUNCHER_STAGE}\" (exit_code=${code})."
  echo "Common causes:"
  echo "  * The Terminal window was closed before launch finished."
  echo "  * Docker Desktop is still starting up or its daemon is unresponsive."
  echo "  * The network could not reach the Docker image registry."
  echo "Log file: ${LOG_FILE}"
  echo "To debug manually:  docker compose -p ${PROJECT_NAME} up --build"
  LAUNCHER_DONE=1
  pause_on_failure
}

on_signal() {
  echo
  echo "Launcher interrupted during stage \"${LAUNCHER_STAGE}\" (signal=$1)."
  echo "Log file: ${LOG_FILE}"
  LAUNCHER_DONE=1
  pause_on_failure
  exit 130
}

trap on_exit EXIT
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM
trap 'on_signal HUP' HUP

wait_for_backend() {
  local attempt=0
  while [ "$attempt" -lt 180 ]; do
    attempt=$((attempt + 1))
    if curl -fsS "${BACKEND_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    if [ $((attempt % 5)) -eq 0 ]; then
      echo "      Still waiting for backend health... ${attempt}/180"
    fi
    sleep 2
  done
  return 1
}

echo "$PROJECT_TITLE"
echo "Launcher log: ${LOG_FILE}"
echo

LAUNCHER_STAGE="docker_cli_check"
echo "[1/5] Checking Docker CLI..."
if ! command -v docker >/dev/null 2>&1; then
  fail "Docker Desktop was not found. Install Docker Desktop, then run this launcher again."
fi
echo "      Found: $(command -v docker)"

LAUNCHER_STAGE="docker_daemon_check"
echo "[2/5] Contacting Docker daemon (this may take a few seconds)..."
if ! docker info >/dev/null 2>&1; then
  echo "      Docker Desktop is not running. Attempting to open it..."
  open -a Docker >/dev/null 2>&1 || true
  daemon_attempt=0
  while [ "$daemon_attempt" -lt 60 ]; do
    daemon_attempt=$((daemon_attempt + 1))
    if docker info >/dev/null 2>&1; then
      break
    fi
    if [ $((daemon_attempt % 5)) -eq 0 ]; then
      echo "      Still waiting for Docker Desktop... ${daemon_attempt}/60"
    fi
    sleep 2
  done
fi

if ! docker info >/dev/null 2>&1; then
  fail "Docker Desktop did not become ready. Start Docker Desktop and run this launcher again."
fi
echo "      Docker daemon is ready."

LAUNCHER_STAGE="compose_up"
echo "[3/5] Building image and starting backend container."
echo "      First build can take 30+ seconds while Docker queries the registry;"
echo "      later runs are CACHED and finish in a few seconds."
echo "      Keep this Terminal window open while output appears below."
echo "      ----------------------------------------------------------"
if ! docker compose -p "$PROJECT_NAME" up --build -d; then
  echo "      ----------------------------------------------------------"
  fail "Docker Compose could not start the backend. See the lines above and the log file for details."
fi
echo "      ----------------------------------------------------------"
echo "      Backend container is up."

LAUNCHER_STAGE="backend_health"
echo "[4/5] Waiting for backend health at ${BACKEND_URL}/health ..."
if ! wait_for_backend; then
  echo "      Backend did not become healthy. Recent backend logs:"
  docker compose -p "$PROJECT_NAME" logs --tail=80 backend || true
  fail "Backend health check timed out."
fi
echo "      Backend is healthy."

LAUNCHER_STAGE="open_browser"
echo "[5/5] Opening workbench: ${BACKEND_URL}/ui/"
if ! open "${BACKEND_URL}/ui/" >/dev/null 2>&1; then
  echo "      Could not auto-open browser. Visit ${BACKEND_URL}/ui/ manually."
fi

echo
echo "Web launcher finished. Backend is running in Docker."
echo "Stop later with: docker compose -p ${PROJECT_NAME} down"
LAUNCHER_DONE=1
