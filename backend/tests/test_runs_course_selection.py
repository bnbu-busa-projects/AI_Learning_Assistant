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
    registered = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "correct-horse",
            "confirm_password": "correct-horse",
        },
    )
    assert registered.status_code == 200
    login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "correct-horse"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['token']}"}


@pytest.fixture()
def course_run_client(client, tmp_path, monkeypatch):
    repo = SQLiteRepository.from_path(tmp_path / "runs-course-selection.sqlite")
    workspace_root = tmp_path / "workspace"
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.setenv("MODEL_SECRET_FILE", str(tmp_path / "missing.env"))
    app.dependency_overrides[get_auth_repository] = lambda: repo
    app.dependency_overrides[get_run_repository] = lambda: repo
    app.dependency_overrides[get_workspace_root] = lambda: str(workspace_root)
    app.dependency_overrides[get_run_executor] = lambda: (
        lambda _repo, artifact_run, _run, _preparation: artifact_run.write_manifest(
            status="queued"
        )
    )
    yield client, repo, workspace_root
    app.dependency_overrides.pop(get_auth_repository, None)
    app.dependency_overrides.pop(get_run_repository, None)
    app.dependency_overrides.pop(get_workspace_root, None)
    app.dependency_overrides.pop(get_run_executor, None)
    app.dependency_overrides.pop(get_run_search_adapter, None)


def _run_payload(**overrides):
    payload = {
        "task_text": "Write a Python solution.",
        "intent": "code_homework",
        "output_preference": "py",
        "search_mode": "off",
    }
    payload.update(overrides)
    return payload


def _create_course(repo, *, user_id: str, title: str, is_archived: bool = False):
    return repo.create_project(
        user_id=user_id,
        title=title,
        root_path=f"workspace/courses/{title.lower().replace(' ', '-')}",
        is_archived=is_archived,
        context_enabled=True,
    )


def test_run_without_course_uses_default_course(course_run_client):
    client, repo, _workspace_root = course_run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    user = repo.get_user_by_email("teacher@bnbu.edu.cn")

    response = client.post("/api/runs", headers=headers, json=_run_payload())

    assert response.status_code == 202
    default_course = repo.get_default_project(user["id"])
    stored_run = repo.get_run(response.json()["id"])
    assert default_course is not None
    assert stored_run["project_id"] == default_course["id"]
    assert response.json()["course_id"] == default_course["id"]
    assert default_course["is_default"] == 1
    assert default_course["context_enabled"] == 0


def test_run_with_owned_course_records_selected_course(course_run_client):
    client, repo, _workspace_root = course_run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    user = repo.get_user_by_email("teacher@bnbu.edu.cn")
    course = _create_course(repo, user_id=user["id"], title="Machine Learning")

    response = client.post(
        "/api/runs",
        headers=headers,
        json=_run_payload(course_id=course["id"]),
    )

    assert response.status_code == 202
    stored_run = repo.get_run(response.json()["id"])
    assert stored_run["project_id"] == course["id"]
    assert response.json()["course_id"] == course["id"]
    assert response.json()["intent"] == "code_homework"
    assert response.json()["routing"]["pipeline"] == "code_homework"


def test_run_rejects_course_owned_by_another_user(course_run_client):
    client, repo, workspace_root = course_run_client
    _register_and_login(client, "teacher@bnbu.edu.cn")
    other_headers = _register_and_login(client, "other@bnbu.edu.cn")
    owner = repo.get_user_by_email("teacher@bnbu.edu.cn")
    course = _create_course(repo, user_id=owner["id"], title="Private Course")

    response = client.post(
        "/api/runs",
        headers=other_headers,
        json=_run_payload(course_id=course["id"]),
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Course was not found."}
    }
    assert not workspace_root.exists()


def test_run_rejects_archived_course(course_run_client):
    client, repo, workspace_root = course_run_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    user = repo.get_user_by_email("teacher@bnbu.edu.cn")
    course = _create_course(
        repo,
        user_id=user["id"],
        title="Archived Course",
        is_archived=True,
    )

    response = client.post(
        "/api/runs",
        headers=headers,
        json=_run_payload(course_id=course["id"]),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert not workspace_root.exists()
