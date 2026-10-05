import json
from pathlib import Path

import pytest

from backend.api.auth import get_auth_repository
from backend.api.runs import (
    get_run_executor,
    get_run_repository,
    get_run_search_adapter,
    get_workspace_root,
)
from backend.main import app
from backend.storage.sqlite import SQLiteRepository


def _register_and_login(client, email: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "correct-horse",
            "confirm_password": "correct-horse",
        },
    )
    assert response.status_code == 200
    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "correct-horse"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['token']}"}


class FakeSearchAdapter:
    def __init__(self, *, results=None, error: Exception | None = None):
        self.results = list(results or [])
        self.error = error
        self.calls = []

    def search(self, query: str, *, max_results: int = 3):
        self.calls.append({"query": query, "max_results": max_results})
        if self.error:
            raise self.error
        return list(self.results)


@pytest.fixture()
def run_client(client, tmp_path, monkeypatch):
    repo = SQLiteRepository.from_path(tmp_path / "runs.sqlite")
    workspace_root = tmp_path / "workspace"
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.setenv("MODEL_SECRET_FILE", str(tmp_path / "missing.env"))
    app.dependency_overrides[get_auth_repository] = lambda: repo
    app.dependency_overrides[get_run_repository] = lambda: repo
    app.dependency_overrides[get_workspace_root] = lambda: str(workspace_root)
    yield client, repo, workspace_root
    app.dependency_overrides.pop(get_auth_repository, None)
    app.dependency_overrides.pop(get_run_repository, None)
    app.dependency_overrides.pop(get_workspace_root, None)
    app.dependency_overrides.pop(get_run_executor, None)
    app.dependency_overrides.pop(get_run_search_adapter, None)


def test_teacher_can_create_queued_run_and_fetch_status(run_client):
    client, repo, workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    calls = []

    def fake_executor(_repo, artifact_run, run, preparation):
        calls.append(run["id"])
        assert preparation.routing.resolved_intent == "code_homework"
        artifact_run.write_log("generation.log", "queued by fake executor\n")
        artifact_run.write_manifest(status="queued")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Write a Python solution.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
            "upload_ids": [],
            "options": {},
        },
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["intent"] == "code_homework"
    assert body["routing"]["pipeline"] == "code_homework"
    assert body["context"]["warning_level"] == "ok"
    assert body["context"]["source"] == "heuristic"
    assert calls == [body["id"]]

    run = repo.get_run(body["id"])
    assert run["task_text"] == "Write a Python solution."
    output_root = Path(body["output_root"])
    assert output_root.is_relative_to(workspace_root)
    assert (output_root / "input" / "task.md").exists()
    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "queued"

    status = client.get(f"/api/runs/{body['id']}", headers=headers)
    assert status.status_code == 200
    assert status.json()["id"] == body["id"]
    assert status.json()["status"] == "queued"


def test_revision_run_creates_new_row_folder_manifest_and_context(run_client):
    client, repo, workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    revision_contexts = []

    def fake_executor(_repo, artifact_run, run, preparation):
        if run.get("revision_of_run_id"):
            revision_contexts.append(preparation.context.context_bundle)
            assert run["revision_of_run_id"] == prior_body["id"]
            artifact_run.write_output(
                "solution.py",
                "print('after revision')\n",
                kind="script",
                media_type="text/x-python",
            )
        else:
            artifact_run.write_output(
                "solution.py",
                "print('before revision')\n",
                kind="script",
                media_type="text/x-python",
            )
            artifact_run.write_log(
                "generation.log",
                "Stage: generate_source\n"
                "Absolute path: /Users/myron/Desktop/secret.txt\n"
                "Authorization: Bearer should-not-leak\n"
                "Traceback (most recent call last):\n"
                "  File \"/Users/myron/app.py\", line 1, in <module>\n"
                "RuntimeError: sanitized\n",
            )
        artifact_run.write_manifest(status="queued")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    prior_response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Write the first Python solution.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
        },
    )
    assert prior_response.status_code == 202
    prior_body = prior_response.json()
    prior_root = Path(prior_body["output_root"])
    prior_manifest_path = prior_root / "manifest.json"
    prior_manifest_before = prior_manifest_path.read_text(encoding="utf-8")

    revision_response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Refine the code to print a clearer result.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
            "revision_of_run_id": prior_body["id"],
        },
    )

    assert revision_response.status_code == 202
    revision_body = revision_response.json()
    revision_root = Path(revision_body["output_root"])
    assert revision_body["revision_of_run_id"] == prior_body["id"]
    assert revision_root != prior_root
    assert revision_root.is_relative_to(workspace_root)
    assert revision_root.exists()

    prior_run = repo.get_run(prior_body["id"])
    revision_run = repo.get_run(revision_body["id"])
    assert prior_run["revision_of_run_id"] is None
    assert revision_run["revision_of_run_id"] == prior_body["id"]
    assert prior_run["output_root"] == str(prior_root.resolve())
    assert prior_manifest_path.read_text(encoding="utf-8") == prior_manifest_before
    assert (prior_root / "output" / "solution.py").read_text(encoding="utf-8") == (
        "print('before revision')\n"
    )

    revision_manifest = json.loads(
        (revision_root / "manifest.json").read_text(encoding="utf-8")
    )
    assert revision_manifest["run_id"] == revision_body["id"]
    assert revision_manifest["revision_of_run_id"] == prior_body["id"]
    assert {"path": "output/solution.py", "kind": "script"} in revision_manifest["outputs"]

    assert len(revision_contexts) == 1
    revision_context = revision_contexts[0]
    assert prior_body["id"] in revision_context
    assert "output/solution.py" in revision_context
    assert "print('before revision')" in revision_context
    assert "/Users/myron" not in revision_context
    assert "Bearer should-not-leak" not in revision_context


def test_revision_run_rejects_missing_prior_run_with_not_found(run_client):
    client, _repo, workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    calls = []

    def fake_executor(_repo, _artifact_run, run, _preparation):
        calls.append(run["id"])

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Refine a missing run.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
            "revision_of_run_id": "missing-run",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Run was not found."}}
    assert calls == []
    assert not workspace_root.exists()


def test_revision_run_rejects_prior_run_owned_by_another_user(run_client):
    client, _repo, workspace_root = run_client
    owner_headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    other_headers = _register_and_login(client, "other@bnbu.edu.cn")
    calls = []

    def fake_executor(_repo, artifact_run, run, _preparation):
        calls.append(run["id"])
        artifact_run.write_output("solution.py", "print('owner')\n", kind="script")
        artifact_run.write_manifest(status="queued")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    prior_response = client.post(
        "/api/runs",
        headers=owner_headers,
        json={
            "task_text": "Write the owner run.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
        },
    )
    assert prior_response.status_code == 202
    prior_body = prior_response.json()

    response = client.post(
        "/api/runs",
        headers=other_headers,
        json={
            "task_text": "Try to refine another user's run.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
            "revision_of_run_id": prior_body["id"],
        },
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert calls == [prior_body["id"]]
    manifests = list(workspace_root.rglob("manifest.json"))
    assert len(manifests) == 1
    assert json.loads(manifests[0].read_text(encoding="utf-8"))["run_id"] == prior_body["id"]


def test_run_api_rejects_upload_owned_by_another_user(run_client, tmp_path):
    client, repo, workspace_root = run_client
    owner_headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    other_headers = _register_and_login(client, "other@bnbu.edu.cn")
    owner = repo.get_user_by_email("teacher@bnbu.edu.cn")
    upload_path = tmp_path / "owner-reference.md"
    upload_path.write_text("Owner-only reference.", encoding="utf-8")
    repo.create_upload(
        id="owner-upload",
        user_id=owner["id"],
        original_name="owner-reference.md",
        media_type="text/markdown",
        stored_path=str(upload_path),
        sha256="a" * 64,
        size_bytes=upload_path.stat().st_size,
    )
    calls = []

    def fake_executor(_repo, _artifact_run, run, _preparation):
        calls.append(run["id"])

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=other_headers,
        json={
            "task_text": "Try to use another user's upload.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
            "upload_ids": ["owner-upload"],
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "not_found"
    assert calls == []
    assert not workspace_root.exists()


def test_run_api_rejects_missing_token(run_client):
    client, _repo, _workspace_root = run_client

    response = client.post(
        "/api/runs",
        json={"task_text": "Write code.", "intent": "code_homework", "search_mode": "off"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_bnbu_user_can_create_queued_run(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "student@bnbu.edu.cn")

    def fake_executor(_repo, artifact_run, _run, _preparation):
        artifact_run.write_log("generation.log", "queued by fake executor\n")
        artifact_run.write_manifest(status="queued")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write an essay.", "intent": "essay_latex", "search_mode": "off"},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "queued"


def test_run_api_validates_contract_fields(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Compress slides.", "intent": "cheat_sheet", "search_mode": "auto"},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert {"field": "options.target_pages", "rule": "required"} in body["error"]["fields"]


def test_run_api_rejects_auto_intent(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Guess from this prompt.", "intent": "auto", "search_mode": "off"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unsupported_intent"


def test_run_api_rejects_missing_intent(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Please infer the assignment type.", "search_mode": "off"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unsupported_intent"


def test_run_api_rejects_unsupported_code_output_preference(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Write code.",
            "intent": "code_homework",
            "output_preference": "pdf",
            "search_mode": "off",
        },
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert {"field": "output_preference", "rule": "enum"} in body["error"]["fields"]


def test_search_mode_off_skips_adapter_call_and_persists_no_citations(run_client):
    client, repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    adapter = FakeSearchAdapter(
        results=[{"title": "Should not run", "url": "https://example.com", "snippet": "n/a"}]
    )
    app.dependency_overrides[get_run_search_adapter] = lambda: adapter

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write code.", "intent": "code_homework", "search_mode": "off"},
    )

    assert response.status_code == 202
    body = response.json()
    assert adapter.calls == []
    assert repo.list_citations_for_run(body["id"]) == []

    manifest_path = Path(body["output_root"]) / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["search"]["mode"] == "off"
    assert manifest["search"]["decision"] == "off_disabled"
    assert manifest["search"]["used"] is False
    assert manifest["search"]["citations"] == []


def test_search_mode_on_calls_adapter_and_persists_citations(run_client):
    client, repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    adapter = FakeSearchAdapter(
        results=[
            {
                "title": "Reference Title",
                "url": "https://example.edu/reference",
                "snippet": "Evidence snippet.",
            }
        ]
    )
    app.dependency_overrides[get_run_search_adapter] = lambda: adapter

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write an essay with references.", "intent": "essay_latex", "search_mode": "on"},
    )

    assert response.status_code == 202
    body = response.json()
    assert len(adapter.calls) == 1

    citations = repo.list_citations_for_run(body["id"])
    assert len(citations) == 1
    assert citations[0]["title"] == "Reference Title"
    assert citations[0]["url"] == "https://example.edu/reference"
    assert citations[0]["snippet"] == "Evidence snippet."

    manifest_path = Path(body["output_root"]) / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["search"]["mode"] == "on"
    assert manifest["search"]["decision"] == "forced_on"
    assert manifest["search"]["used"] is True
    assert manifest["search"]["citations"] == [
        {
            "title": "Reference Title",
            "url": "https://example.edu/reference",
            "snippet": "Evidence snippet.",
        }
    ]


def test_search_mode_auto_records_decision(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    adapter = FakeSearchAdapter(results=[])
    app.dependency_overrides[get_run_search_adapter] = lambda: adapter

    response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Summarize key literature on this topic.",
            "intent": "essay_latex",
            "search_mode": "auto",
        },
    )

    assert response.status_code == 202
    body = response.json()
    manifest_path = Path(body["output_root"]) / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["search"]["mode"] == "auto"
    assert manifest["search"]["decision"] == "auto_use_search"
    assert manifest["search"]["used"] is True
    assert len(adapter.calls) == 1


def test_search_mode_on_failure_marks_run_failed(run_client):
    client, _repo, _workspace_root = run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    adapter = FakeSearchAdapter(error=RuntimeError("search provider offline"))
    app.dependency_overrides[get_run_search_adapter] = lambda: adapter

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Need references.", "intent": "essay_latex", "search_mode": "on"},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "failed"
    assert "search_unavailable" in (body["error_message"] or "")
    assert len(adapter.calls) == 1

    manifest_path = Path(body["output_root"]) / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["status"] == "failed"
    assert manifest["search"]["decision"] == "forced_on_failed"
    assert manifest["search"]["used"] is False
