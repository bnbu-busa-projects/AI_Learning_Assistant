#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_URL="${AILA_BACKEND_URL:-http://127.0.0.1:14242}"
OUTPUT_FILE="${AILA_CHECK_OUTPUT:-${ROOT_DIR}/ecs-docker-check.txt}"

exec > >(tee "${OUTPUT_FILE}") 2>&1

fail() {
  echo
  echo "Result: FAIL"
  echo "[FAIL] $1" >&2
  exit 1
}

echo "AI Learning Assistant ECS Docker Check"
echo "Checked at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Output file: ${OUTPUT_FILE}"
echo
echo "Checking the AI Learning Assistant runtime on this ECS server..."

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is not installed or is not available in PATH."
fi
echo "[OK] Docker CLI is installed."

if ! docker info >/dev/null 2>&1; then
  fail "The Docker daemon is not running, or this user does not have permission to access it."
fi
echo "[OK] Docker daemon is running."

if ! docker compose version >/dev/null 2>&1; then
  fail "The Docker Compose plugin is not available."
fi
echo "[OK] Docker Compose is available."

running_services="$(docker compose -f "${ROOT_DIR}/compose.yml" ps --status running --services 2>/dev/null)"
if ! grep -qx "backend" <<<"${running_services}"; then
  fail "The backend container is not running for this Compose project."
fi
echo "[OK] Backend container is running."

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required to check the application health endpoint."
fi

if ! curl -fsS "${BACKEND_URL}/health" >/dev/null 2>&1; then
  fail "The backend container is running, but ${BACKEND_URL}/health did not respond successfully."
fi
echo "[OK] Application health check passed at ${BACKEND_URL}/health."

echo
echo "Result: PASS"
echo "Docker and the AI Learning Assistant are running correctly on this ECS server."
