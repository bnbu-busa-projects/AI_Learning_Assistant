#!/usr/bin/env bash

set -u
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="${AILA_LOCAL_UI_REPORT:-${ROOT_DIR}/local-ui-check.txt}"
UI_URL="http://127.0.0.1:14242/ui/"
OPEN_BROWSER=false

case "${1:-}" in
  "") ;;
  --open) OPEN_BROWSER=true ;;
  *) echo "Usage: bash scripts/check-local-ui.sh [--open]" >&2; exit 2 ;;
esac

exec > >(tee "${REPORT_FILE}") 2>&1

echo "AI Learning Assistant Local Web Interface Check"
echo "Time (local): $(date '+%Y-%m-%dT%H:%M:%S%z')"
echo "Time (UTC): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Machine: $(hostname)"
echo "Operating system: $(uname -s) $(uname -r)"
echo "CPU architecture: $(uname -m)"
echo "Working directory: ${PWD}"
echo "Report file: ${REPORT_FILE}"
echo "Tested URL: ${UI_URL}"
if [ -n "${SSH_CONNECTION:-}${SSH_TTY:-}" ]; then
  echo "Execution location: SSH session on the machine named above"
else
  echo "Execution location: terminal on the machine named above"
fi
echo "Target: this machine's loopback port 14242 (possibly forwarded by an SSH tunnel)"
echo "Browser verification: HTTP checks do not prove that the page rendered in a browser"
echo

if ! command -v curl >/dev/null 2>&1; then
  echo "Result: FAIL — curl is not installed."
  exit 1
fi

http_status="$(curl --silent --show-error --noproxy '*' \
  --connect-timeout 5 --max-time 15 \
  --output /dev/null --write-out '%{http_code}' "${UI_URL}")"
curl_status=$?
echo "HTTP status: ${http_status}"
echo "curl exit code: ${curl_status}"

if [ "${curl_status}" -ne 0 ] || [ "${http_status}" != "200" ]; then
  echo "Browser launch: not attempted"
  echo "Result: FAIL — expected a successful HTTP 200 response."
  echo "Check: docker compose -p ai-learning-assistant logs --tail=100 backend"
  exit 1
fi

echo "Result: PASS — the web-interface URL returned HTTP 200."
if [ "${OPEN_BROWSER}" = false ]; then
  echo "Browser launch: not requested; open ${UI_URL} manually on this machine."
  exit 0
fi

if [ "$(uname -s)" = Darwin ] && command -v open >/dev/null 2>&1; then
  launcher=open
elif command -v xdg-open >/dev/null 2>&1; then
  launcher=xdg-open
else
  echo "Browser launch: no supported launcher; open ${UI_URL} manually."
  exit 0
fi

echo "Browser launch location: default browser in this machine's desktop session"
echo "Browser launch command: ${launcher} ${UI_URL}"
if "${launcher}" "${UI_URL}"; then
  echo "Browser launch: request accepted; actual browser rendering remains unverified."
else
  echo "Browser launch: request failed; HTTP check passed. Open the URL manually."
fi
