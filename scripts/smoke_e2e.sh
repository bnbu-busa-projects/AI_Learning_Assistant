#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${AILA_SMOKE_PROJECT:-ai-learning-assistant-smoke}"

pick_free_port() {
  python3 - <<'PY'
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

port_from_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
print(parsed.port or 14242)
PY
}

if [ -n "${AILA_BACKEND_URL:-}" ]; then
  BACKEND_URL="${AILA_BACKEND_URL}"
  BACKEND_PORT="${AILA_BACKEND_PORT:-$(port_from_url "${BACKEND_URL}")}"
else
  BACKEND_PORT="${AILA_BACKEND_PORT:-$(pick_free_port)}"
  BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
fi
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/aila-smoke.XXXXXX")"

export AILA_BACKEND_URL="${BACKEND_URL}"
export AILA_BACKEND_PORT="${BACKEND_PORT}"
export AILA_DATA_DIR="${TMP_ROOT}/data"
export AILA_WORKSPACE_DIR="${TMP_ROOT}/workspace"
export APP_SQLITE_PATH="/app/data/app.sqlite"
export WORKSPACE_ROOT="/app/workspace"
export MODEL_SECRET_FILE="/app/data/model-secrets.env"
export MODEL_KEY_ENCRYPTION_FILE="/app/data/model-key-encryption.key"
unset MODEL_KEY_ENCRYPTION_KEY
export MODEL_PROVIDER="openai_compatible"
export MODEL_BASE_URL="http://mock-provider.local/v1"
export MODEL_NAME="mock-qwen"
export MODEL_API_KEY="smoke-mock-key"
export MODEL_CONTEXT_WINDOW="256000"
export MODEL_SUPPORTS_STREAMING="true"
export AILA_MOCK_MODEL_PROVIDER="1"

cleanup() {
  docker compose -p "${PROJECT_NAME}" -f "${ROOT_DIR}/compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  rm -rf "${TMP_ROOT}"
}
trap cleanup EXIT

mkdir -p "${AILA_DATA_DIR}" "${AILA_WORKSPACE_DIR}"

echo "[smoke] Starting Docker runtime with mocked model provider at ${BACKEND_URL}."
docker compose -p "${PROJECT_NAME}" -f "${ROOT_DIR}/compose.yml" down --remove-orphans >/dev/null 2>&1 || true
docker compose -p "${PROJECT_NAME}" -f "${ROOT_DIR}/compose.yml" up --build -d

echo "[smoke] Waiting for backend health at ${BACKEND_URL}/health."
backend_ready=0
for _ in $(seq 1 300); do
  if curl -fsS "${BACKEND_URL}/health" >/dev/null 2>&1; then
    backend_ready=1
    break
  fi
  sleep 1
done
if [ "${backend_ready}" -ne 1 ]; then
  echo "Backend did not become healthy. Recent backend logs:" >&2
  docker compose -p "${PROJECT_NAME}" -f "${ROOT_DIR}/compose.yml" logs --tail=120 backend >&2 || true
  exit 1
fi

echo "[smoke] Exercising auth, uploads, model settings, run creation, manifest, and workbench."
curl_json() {
  local method="$1"
  local path="$2"
  local output="$3"
  local body="$4"
  shift 4
  if [ "${body}" = "__NO_BODY__" ]; then
    curl -sS -o "${output}" -w "%{http_code}" -X "${method}" "${BACKEND_URL}${path}" "$@"
  else
    curl -sS -o "${output}" -w "%{http_code}" -X "${method}" "${BACKEND_URL}${path}" \
      -H "Content-Type: application/json" "$@" --data "${body}"
  fi
}

assert_status() {
  local actual="$1"
  local expected="$2"
  local output="$3"
  if [ "${actual}" != "${expected}" ]; then
    echo "Expected HTTP ${expected}, got ${actual}:" >&2
    cat "${output}" >&2
    exit 1
  fi
}

json_get() {
  python3 - "$1" "$2" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    value = json.load(handle)
for part in sys.argv[2].split("."):
    if isinstance(value, list):
        value = value[int(part)]
    else:
        value = value[part]
print(value)
PY
}

SMOKE_EMAIL="smoke-$(date +%s)@bnbu.edu.cn"
PASSWORD="correct-horse"
REGISTER_BODY="{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${PASSWORD}\",\"confirm_password\":\"${PASSWORD}\"}"
LOGIN_BODY="{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${PASSWORD}\"}"

status="$(curl_json POST /api/auth/register "${TMP_ROOT}/register.json" "${REGISTER_BODY}")"
assert_status "${status}" 200 "${TMP_ROOT}/register.json"
status="$(curl_json POST /api/auth/login "${TMP_ROOT}/login.json" "${LOGIN_BODY}")"
assert_status "${status}" 200 "${TMP_ROOT}/login.json"
TOKEN="$(json_get "${TMP_ROOT}/login.json" token)"
AUTH_HEADER="Authorization: Bearer ${TOKEN}"
status="$(curl_json GET /api/auth/me "${TMP_ROOT}/me.json" "__NO_BODY__" -H "${AUTH_HEADER}")"
assert_status "${status}" 200 "${TMP_ROOT}/me.json"

printf "# Smoke reference\nUse this uploaded note in the mocked run.\n" > "${TMP_ROOT}/reference.md"
status="$(curl -sS -o "${TMP_ROOT}/upload.json" -w "%{http_code}" -X POST "${BACKEND_URL}/api/uploads" \
  -H "${AUTH_HEADER}" \
  -F "files=@${TMP_ROOT}/reference.md;type=text/markdown;filename=reference.md")"
assert_status "${status}" 201 "${TMP_ROOT}/upload.json"
UPLOAD_ID="$(json_get "${TMP_ROOT}/upload.json" uploads.0.id)"
status="$(curl_json GET "/api/uploads/${UPLOAD_ID}" "${TMP_ROOT}/fetched-upload.json" "__NO_BODY__" -H "${AUTH_HEADER}")"
assert_status "${status}" 200 "${TMP_ROOT}/fetched-upload.json"

PROFILE_BODY="{\"display_name\":\"Smoke Mock Qwen\",\"provider\":\"openai_compatible\",\"base_url\":\"${MODEL_BASE_URL}\",\"model\":\"${MODEL_NAME}\",\"api_key\":\"smoke-profile-key\",\"context_window_hint\":256000,\"supports_streaming\":true}"
status="$(curl_json PUT /api/settings/model-profiles/default "${TMP_ROOT}/profile.json" "${PROFILE_BODY}" -H "${AUTH_HEADER}")"
assert_status "${status}" 200 "${TMP_ROOT}/profile.json"
PROFILE_ID="$(json_get "${TMP_ROOT}/profile.json" id)"
status="$(curl_json POST /api/settings/model-profiles/test "${TMP_ROOT}/profile-test.json" "{}" -H "${AUTH_HEADER}")"
assert_status "${status}" 200 "${TMP_ROOT}/profile-test.json"

RUN_BODY="{\"task_text\":\"Write a short smoke-test essay about using uploaded notes in an information systems class.\",\"intent\":\"essay_latex\",\"output_preference\":\"pdf\",\"search_mode\":\"off\",\"model_profile_id\":\"${PROFILE_ID}\",\"upload_ids\":[\"${UPLOAD_ID}\"],\"options\":{}}"
status="$(curl_json POST /api/runs "${TMP_ROOT}/run.json" "${RUN_BODY}" -H "${AUTH_HEADER}")"
assert_status "${status}" 202 "${TMP_ROOT}/run.json"
RUN_ID="$(json_get "${TMP_ROOT}/run.json" id)"
status="$(curl_json GET "/api/runs/${RUN_ID}" "${TMP_ROOT}/fetched-run.json" "__NO_BODY__" -H "${AUTH_HEADER}")"
assert_status "${status}" 200 "${TMP_ROOT}/fetched-run.json"
status="$(curl_json GET "/api/runs/${RUN_ID}/events" "${TMP_ROOT}/event.json" "__NO_BODY__" -H "${AUTH_HEADER}")"
assert_status "${status}" 200 "${TMP_ROOT}/event.json"

status="$(curl -fsS -o "${TMP_ROOT}/ui.html" -w "%{http_code}" "${BACKEND_URL}/ui/")"
assert_status "${status}" 200 "${TMP_ROOT}/ui.html"
python3 - "${TMP_ROOT}" <<'PY'
import hashlib
import json
import os
import pathlib
import re
import sys

tmp_root = pathlib.Path(sys.argv[1])
workspace_dir = pathlib.Path(os.environ["AILA_WORKSPACE_DIR"]).resolve()

register = json.loads((tmp_root / "register.json").read_text(encoding="utf-8"))
me = json.loads((tmp_root / "me.json").read_text(encoding="utf-8"))
upload_response = json.loads((tmp_root / "upload.json").read_text(encoding="utf-8"))
fetched_upload = json.loads((tmp_root / "fetched-upload.json").read_text(encoding="utf-8"))
profile = json.loads((tmp_root / "profile.json").read_text(encoding="utf-8"))
profile_test = json.loads((tmp_root / "profile-test.json").read_text(encoding="utf-8"))
run = json.loads((tmp_root / "run.json").read_text(encoding="utf-8"))
fetched_run = json.loads((tmp_root / "fetched-run.json").read_text(encoding="utf-8"))
event = json.loads((tmp_root / "event.json").read_text(encoding="utf-8"))

assert register["role"] == "teacher", register
assert me == {"email": register["email"], "role": "teacher"}, me
upload = upload_response["uploads"][0]
assert fetched_upload == upload, fetched_upload
assert upload["id"].startswith("upl_"), upload
assert upload["original_name"] == "reference.md", upload
assert upload["media_type"] == "text/markdown", upload
assert upload["sha256"] == hashlib.sha256((tmp_root / "reference.md").read_bytes()).hexdigest()
assert "stored_path" not in json.dumps(upload_response), upload_response
assert "smoke-profile-key" not in json.dumps(profile), profile
assert profile["api_key_ref"].startswith("user:"), profile
assert profile_test["ok"] is True, profile_test
assert run["status"] == "succeeded", run
assert run["intent"] == "essay_latex", run
assert run["context"]["warning_level"] == "ok", run
assert fetched_run["id"] == run["id"], fetched_run
assert fetched_run["status"] == "succeeded", fetched_run
assert event["status"] == "succeeded", event
assert event["stage"] == "write_manifest", event

output_root = run["output_root"]
assert output_root.startswith("/app/workspace/"), output_root
host_run_root = workspace_dir / output_root.removeprefix("/app/workspace/")
manifest_path = host_run_root / "manifest.json"
assert manifest_path.exists(), manifest_path
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
assert manifest["schema_version"] == 1, manifest
assert manifest["run_id"] == run["id"], manifest
assert manifest["intent"] == "essay_latex", manifest
assert manifest["status"] == "succeeded", manifest
assert {"path": "output/main.html", "kind": "source"} in manifest["outputs"], manifest
assert {"path": "output/main.pdf", "kind": "pdf"} in manifest["outputs"], manifest
assert {
    entry["path"] for entry in manifest["outputs"]
} == {"output/main.html", "output/main.pdf"}, manifest
for entry in [*manifest["inputs"], *manifest["outputs"]]:
    assert (host_run_root / entry["path"]).exists(), entry
stage_timings = {
    stage["name"]: stage["duration_ms"]
    for stage in manifest["timings"]["stages"]
}
timing_groups = {
    "provider_generation_ms": stage_timings.get("provider_generation", 0)
    + stage_timings.get("repair_generation", 0),
    "convert_pdf_ms": stage_timings.get("convert_pdf", 0),
    "context_upload_search_ms": stage_timings.get("preparation_context", 0)
    + stage_timings.get("search", 0),
    "artifact_persistence_ms": stage_timings.get("artifact_persistence", 0),
}
timing_groups["other_local_ms"] = max(
    0,
    manifest["timings"]["total_ms"] - sum(timing_groups.values()),
)
timing_groups["total_ms"] = manifest["timings"]["total_ms"]

html_path = host_run_root / "output" / "main.html"
pdf_path = host_run_root / "output" / "main.pdf"
convert_log_path = host_run_root / "logs" / "convert.log"
assert html_path.exists(), html_path
assert pdf_path.exists(), pdf_path
assert convert_log_path.exists(), convert_log_path
html_text = html_path.read_text(encoding="utf-8")
assert html_text.lstrip().lower().startswith("<!doctype html>"), html_text[:120]
assert "Mocked Essay" in html_text, html_text[:500]
assert pdf_path.read_bytes().startswith(b"%PDF"), pdf_path
assert pdf_path.stat().st_size > 1024, pdf_path.stat().st_size
convert_log = convert_log_path.read_text(encoding="utf-8")
assert "Converter: playwright_chromium" in convert_log, convert_log
assert "Result: pdf_ok" in convert_log, convert_log

data_dir = pathlib.Path(os.environ["AILA_DATA_DIR"])
assert (data_dir / "model-key-encryption.key").exists()
assert b"smoke-profile-key" not in (data_dir / "app.sqlite").read_bytes()

ui_html = (tmp_root / "ui.html").read_text(encoding="utf-8")
assert "AI Learning Assistant - Artifact Studio" in ui_html
assert '<div id="app"></div>' in ui_html
asset_paths = re.findall(r'["\'](/ui/assets/[^"\']+)["\']', ui_html)
assert asset_paths, ui_html[:500]
(tmp_root / "asset-paths.txt").write_text("\n".join(asset_paths[:2]), encoding="utf-8")

print(json.dumps({
    "email": register["email"],
    "upload_id": upload["id"],
    "run_id": run["id"],
    "manifest": str(manifest_path),
    "workbench_assets_checked": len(asset_paths[:2]),
    "timing_summary": timing_groups,
}, indent=2, sort_keys=True))
PY

while IFS= read -r asset_path; do
  status="$(curl -fsS -o /dev/null -w "%{http_code}" "${BACKEND_URL}${asset_path}")"
  if [ "${status}" != "200" ]; then
    echo "Expected asset ${asset_path} to return 200, got ${status}" >&2
    exit 1
  fi
done < "${TMP_ROOT}/asset-paths.txt"

echo "[smoke] End-to-end smoke passed."
