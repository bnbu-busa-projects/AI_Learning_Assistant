import json
from pathlib import Path

import pytest

from backend.api.auth import get_auth_repository
from backend.api.runs import get_run_executor, get_run_repository, get_workspace_root
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


@pytest.fixture()
def artifact_client(client, tmp_path, monkeypatch):
    repo = SQLiteRepository.from_path(tmp_path / "artifact-access.sqlite")
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


def _create_successful_artifact_run(client, repo, headers: dict[str, str]) -> dict:
    def fake_executor(repo, artifact_run, run, _preparation):
        repo.update_run(run["id"], status="succeeded", error_message=None)
        artifact_run.write_output(
            "solution.py",
            "print('hello artifact')\n",
            kind="script",
            media_type="text/x-python",
        )
        artifact_run.write_output(
            "main.pdf",
            b"%PDF-1.4\n% test pdf bytes\n",
            kind="pdf",
            media_type="application/pdf",
        )
        artifact_run.write_log("generation.log", "run completed\n")
        artifact_run.write_manifest(status="succeeded")

    app.dependency_overrides[get_run_executor] = lambda: fake_executor
    response = client.post(
        "/api/runs",
        headers=headers,
        json={
            "task_text": "Write a Python solution.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
        },
    )
    assert response.status_code == 202
    return response.json()


def test_owner_can_list_manifest_and_artifact_metadata(artifact_client):
    client, repo, _workspace_root = artifact_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    run = _create_successful_artifact_run(client, repo, headers)

    response = client.get(f"/api/runs/{run['id']}/artifacts", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["run_id"] == run["id"]
    assert body["status"] == "succeeded"
    assert body["manifest"]["status"] == "succeeded"
    assert body["manifest"]["outputs"] == [
        {"path": "output/solution.py", "kind": "script"},
        {"path": "output/main.pdf", "kind": "pdf"},
    ]
    artifacts = {artifact["path"]: artifact for artifact in body["artifacts"]}
    assert artifacts["input/task.md"]["kind"] == "task"
    assert artifacts["output/solution.py"]["kind"] == "script"
    assert artifacts["output/solution.py"]["media_type"] == "text/x-python"
    assert artifacts["logs/generation.log"]["kind"] == "log"
    assert artifacts["manifest.json"]["kind"] == "manifest"
    assert artifacts["output/main.pdf"]["media_type"] == "application/pdf"
    assert artifacts["output/main.pdf"]["url"].endswith(
        f"/api/runs/{run['id']}/artifacts/files/output/main.pdf"
    )
    assert all(not Path(path).is_absolute() for path in artifacts)


def test_owner_can_fetch_recorded_source_logs_manifest_and_pdf_bytes(artifact_client):
    client, repo, _workspace_root = artifact_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    run = _create_successful_artifact_run(client, repo, headers)

    source = client.get(
        f"/api/runs/{run['id']}/artifacts/files/output/solution.py",
        headers=headers,
    )
    log = client.get(
        f"/api/runs/{run['id']}/artifacts/files/logs/generation.log",
        headers=headers,
    )
    manifest = client.get(
        f"/api/runs/{run['id']}/artifacts/files/manifest.json",
        headers=headers,
    )
    pdf = client.get(
        f"/api/runs/{run['id']}/artifacts/files/output/main.pdf",
        headers=headers,
    )

    assert source.status_code == 200
    assert source.text == "print('hello artifact')\n"
    assert source.headers["content-type"].startswith("text/x-python")
    assert log.status_code == 200
    assert log.text == "run completed\n"
    assert manifest.status_code == 200
    assert json.loads(manifest.text)["run_id"] == run["id"]
    assert pdf.status_code == 200
    assert pdf.content == b"%PDF-1.4\n% test pdf bytes\n"
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.headers["content-disposition"] == 'inline; filename="main.pdf"'


def test_artifact_access_returns_not_found_for_other_user(artifact_client):
    client, repo, _workspace_root = artifact_client
    owner_headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    other_headers = _register_and_login(client, "other@bnbu.edu.cn")
    run = _create_successful_artifact_run(client, repo, owner_headers)

    listed = client.get(f"/api/runs/{run['id']}/artifacts", headers=other_headers)
    fetched = client.get(
        f"/api/runs/{run['id']}/artifacts/files/output/solution.py",
        headers=other_headers,
    )

    assert listed.status_code == 404
    assert listed.json() == {"error": {"code": "not_found", "message": "Run was not found."}}
    assert fetched.status_code == 404
    assert fetched.json() == {"error": {"code": "not_found", "message": "Run was not found."}}


def test_artifact_file_rejects_unrecorded_and_traversal_paths(artifact_client):
    client, repo, _workspace_root = artifact_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    run = _create_successful_artifact_run(client, repo, headers)
    run_root = Path(run["output_root"])
    (run_root / "output" / "unrecorded.txt").write_text("do not serve\n", encoding="utf-8")

    unrecorded = client.get(
        f"/api/runs/{run['id']}/artifacts/files/output/unrecorded.txt",
        headers=headers,
    )
    traversal = client.get(
        f"/api/runs/{run['id']}/artifacts/files/output/%2E%2E/manifest.json",
        headers=headers,
    )
    absolute = client.get(
        f"/api/runs/{run['id']}/artifacts/files/%2Fetc%2Fpasswd",
        headers=headers,
    )

    for response in (unrecorded, traversal, absolute):
        assert response.status_code == 404
        body = response.json()
        assert body == {"error": {"code": "not_found", "message": "Artifact was not found."}}
        assert "/etc/passwd" not in response.text
        assert str(run_root) not in response.text
