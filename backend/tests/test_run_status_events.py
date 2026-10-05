import pytest

from backend.api.auth import get_auth_repository
from backend.api.runs import (
    get_run_event_store,
    get_run_executor,
    get_run_repository,
    get_run_search_adapter,
    get_workspace_root,
)
from backend.core.run_events import default_run_event_store, emit_run_event
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


class NoopSearchAdapter:
    def search(self, query: str, *, max_results: int = 3):
        raise AssertionError("search should not run in these tests")


@pytest.fixture()
def event_client(client, tmp_path, monkeypatch):
    repo = SQLiteRepository.from_path(tmp_path / "runs.sqlite")
    workspace_root = tmp_path / "workspace"
    default_run_event_store.clear()
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.setenv("MODEL_SECRET_FILE", str(tmp_path / "missing.env"))
    app.dependency_overrides[get_auth_repository] = lambda: repo
    app.dependency_overrides[get_run_repository] = lambda: repo
    app.dependency_overrides[get_workspace_root] = lambda: str(workspace_root)
    app.dependency_overrides[get_run_search_adapter] = lambda: NoopSearchAdapter()
    app.dependency_overrides[get_run_event_store] = lambda: default_run_event_store
    yield client, repo
    default_run_event_store.clear()
    app.dependency_overrides.pop(get_auth_repository, None)
    app.dependency_overrides.pop(get_run_repository, None)
    app.dependency_overrides.pop(get_workspace_root, None)
    app.dependency_overrides.pop(get_run_executor, None)
    app.dependency_overrides.pop(get_run_search_adapter, None)
    app.dependency_overrides.pop(get_run_event_store, None)


def test_run_events_endpoint_exposes_queued_shape(event_client):
    client, _repo = event_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    def fake_executor(_repo, artifact_run, _run, _preparation):
        artifact_run.write_log("generation.log", "queued by fake executor\n")
        artifact_run.write_manifest(status="queued")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write code.", "intent": "code_homework", "search_mode": "off"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]

    event = client.get(f"/api/runs/{run_id}/events", headers=headers)

    assert event.status_code == 200
    body = event.json()
    assert body["run_id"] == run_id
    assert body["status"] == "queued"
    assert body["stage"] == "queued"
    assert body["message"] == "Run queued."
    assert _context_keys_present(body["context"])


def test_run_events_endpoint_exposes_running_shape(event_client):
    client, repo = event_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    def fake_executor(_repo, _artifact_run, run, preparation):
        repo.update_run(run["id"], status="running", error_message=None)
        emit_run_event(
            run_id=run["id"],
            status="running",
            stage="generate_source",
            message="Generating source",
            context=preparation.context.estimate,
        )

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write code.", "intent": "code_homework", "search_mode": "off"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]

    event = client.get(f"/api/runs/{run_id}/events", headers=headers)

    assert event.status_code == 200
    body = event.json()
    assert body["status"] == "running"
    assert body["stage"] == "generate_source"
    assert body["message"] == "Generating source"
    assert _context_keys_present(body["context"])


def test_run_events_endpoint_exposes_succeeded_shape(event_client):
    client, repo = event_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    def fake_executor(_repo, artifact_run, run, preparation):
        repo.update_run(run["id"], status="succeeded", error_message=None)
        artifact_run.write_log("generation.log", "done\n")
        artifact_run.write_manifest(status="succeeded")
        emit_run_event(
            run_id=run["id"],
            status="succeeded",
            stage="write_manifest",
            message="Run succeeded.",
            context=preparation.context.estimate,
        )

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write code.", "intent": "code_homework", "search_mode": "off"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]

    event = client.get(f"/api/runs/{run_id}/events", headers=headers)

    assert event.status_code == 200
    body = event.json()
    assert body["status"] == "succeeded"
    assert body["stage"] == "write_manifest"
    assert body["message"] == "Run succeeded."
    assert _context_keys_present(body["context"])


def test_run_events_endpoint_exposes_failed_shape(event_client):
    client, repo = event_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    def fake_executor(_repo, artifact_run, run, preparation):
        repo.update_run(
            run["id"],
            status="failed",
            error_message="convert_failed: HTML-to-PDF conversion failed.",
        )
        artifact_run.write_log("generation.log", "failed\n")
        artifact_run.write_manifest(status="failed")
        emit_run_event(
            run_id=run["id"],
            status="failed",
            stage="convert_pdf",
            message="HTML-to-PDF conversion failed.",
            context=preparation.context.estimate,
            error={
                "code": "convert_failed",
                "message": "HTML-to-PDF conversion failed.",
            },
        )

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write an essay.", "intent": "essay_latex", "search_mode": "off"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]

    event = client.get(f"/api/runs/{run_id}/events", headers=headers)

    assert event.status_code == 200
    body = event.json()
    assert body["status"] == "failed"
    assert body["stage"] == "convert_pdf"
    assert body["message"] == "HTML-to-PDF conversion failed."
    assert body["error"] == {
        "code": "convert_failed",
        "message": "HTML-to-PDF conversion failed.",
    }
    assert _context_keys_present(body["context"])


def test_run_events_endpoint_falls_back_to_persisted_final_status(event_client):
    client, repo = event_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    def fake_executor(_repo, artifact_run, run, _preparation):
        repo.update_run(run["id"], status="succeeded", error_message=None)
        artifact_run.write_log("generation.log", "done without final event\n")
        artifact_run.write_manifest(status="succeeded")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor

    response = client.post(
        "/api/runs",
        headers=headers,
        json={"task_text": "Write code.", "intent": "code_homework", "search_mode": "off"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]

    event = client.get(f"/api/runs/{run_id}/events", headers=headers)

    assert event.status_code == 200
    body = event.json()
    assert body["status"] == "succeeded"
    assert body["stage"] == "write_manifest"
    assert body["message"] == "Run succeeded."
    assert "context" not in body


def _context_keys_present(context: dict[str, object]) -> bool:
    return {
        "estimated_input_tokens",
        "estimated_output_tokens",
        "estimated_total_tokens",
        "context_window_limit",
        "utilization_ratio",
        "warning_level",
        "source",
    }.issubset(context)
