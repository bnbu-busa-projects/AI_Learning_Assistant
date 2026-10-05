#!/usr/bin/env bash

set -u
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${AILA_TEST_URL:-http://127.0.0.1:14242}"
BASE_URL="${BASE_URL%/}"
OUTPUT_FILE="${AILA_TEST_OUTPUT:-${ROOT_DIR}/ecs-web-service-test.txt}"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/aila-web-test.XXXXXX")"

cleanup() {
  rm -rf "${TMP_ROOT}"
}
trap cleanup EXIT

exec > >(tee "${OUTPUT_FILE}") 2>&1

fail() {
  echo
  echo "Result: FAIL"
  echo "[FAIL] $1" >&2
  exit 1
}

check_status() {
  local actual="$1"
  local expected="$2"
  local description="$3"

  if [ "${actual}" != "${expected}" ]; then
    fail "${description} returned HTTP ${actual}; expected HTTP ${expected}."
  fi
  echo "[OK] ${description}"
}

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required to run this test."
fi

if ! command -v python3 >/dev/null 2>&1; then
  fail "python3 is required to validate the API responses."
fi

echo "AI Learning Assistant Web Service Test"
echo "Checked at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Service URL: ${BASE_URL}"
echo "Output file: ${OUTPUT_FILE}"
echo

health_status="$(curl -sS -o "${TMP_ROOT}/health.json" -w "%{http_code}" "${BASE_URL}/health" || true)"
check_status "${health_status}" "200" "Health endpoint is reachable"
if ! python3 - "${TMP_ROOT}/health.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
if payload.get("status") != "ok":
    raise SystemExit(1)
PY
then
  fail "The health endpoint did not return the expected status."
fi
echo "[OK] Health response reports status ok."

ui_status="$(curl -sS -o "${TMP_ROOT}/ui.html" -w "%{http_code}" "${BASE_URL}/ui/" || true)"
check_status "${ui_status}" "200" "Web interface is reachable"

unauthorized_status="$(curl -sS -o "${TMP_ROOT}/unauthorized.json" -w "%{http_code}" "${BASE_URL}/api/auth/me" || true)"
check_status "${unauthorized_status}" "401" "Protected API rejects unauthenticated access"

unique_id="$(date +%s)-${RANDOM}"
test_email="ecs-web-test-${unique_id}@bnbu.edu.cn"
test_password="Ecs-test-${unique_id}"
register_body="{\"email\":\"${test_email}\",\"password\":\"${test_password}\",\"confirm_password\":\"${test_password}\"}"
login_body="{\"email\":\"${test_email}\",\"password\":\"${test_password}\"}"

register_status="$(curl -sS -o "${TMP_ROOT}/register.json" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  --data "${register_body}" || true)"
check_status "${register_status}" "200" "BNBU test account registration succeeds"

login_status="$(curl -sS -o "${TMP_ROOT}/login.json" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  --data "${login_body}" || true)"
check_status "${login_status}" "200" "BNBU test account sign-in succeeds"

token="$(python3 - "${TMP_ROOT}/login.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
print(payload.get("token", ""))
PY
)"
if [ -z "${token}" ]; then
  fail "The sign-in response did not contain a session token."
fi

me_status="$(curl -sS -o "${TMP_ROOT}/me.json" -w "%{http_code}" \
  "${BASE_URL}/api/auth/me" \
  -H "Authorization: Bearer ${token}" || true)"
check_status "${me_status}" "200" "Authenticated API access succeeds"

if ! python3 - "${TMP_ROOT}/me.json" "${test_email}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
if payload.get("email") != sys.argv[2] or payload.get("role") != "teacher":
    raise SystemExit(1)
PY
then
  fail "The authenticated user response did not match the test account."
fi
echo "[OK] Authenticated user identity is correct."

echo
echo "Result: PASS"
echo "The remote health, web interface, registration, sign-in, and access-control checks passed."
echo "Model connection, artifact generation, preview, and restart persistence still require manual testing."
