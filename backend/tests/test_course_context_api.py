import pytest

from backend.api.auth import get_auth_repository
from backend.api.courses import get_course_repository
from backend.main import app
from backend.storage.sqlite import SQLiteRepository


@pytest.fixture()
def course_client(client, tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "courses.sqlite")
    app.dependency_overrides[get_auth_repository] = lambda: repo
    app.dependency_overrides[get_course_repository] = lambda: repo
    yield client, repo
    app.dependency_overrides.pop(get_auth_repository, None)
    app.dependency_overrides.pop(get_course_repository, None)


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


def test_new_user_lists_one_default_context_disabled_course(course_client):
    client, repo = course_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.get("/api/courses", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "courses": [
            {
                "id": response.json()["courses"][0]["id"],
                "title": "Just Asking",
                "is_default": True,
                "is_archived": False,
                "context_enabled": False,
                "context_updated_at": None,
            }
        ]
    }
    user = repo.get_user_by_email("teacher@bnbu.edu.cn")
    assert len(repo.list_projects_for_user(user["id"], include_archived=True)) == 1


def test_user_can_create_rename_and_soft_archive_course(course_client):
    client, repo = course_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    created = client.post(
        "/api/courses",
        headers=headers,
        json={"title": "  Machine Learning  "},
    )
    assert created.status_code == 201
    course = created.json()
    assert course["title"] == "Machine Learning"
    assert course["is_default"] is False
    assert course["context_enabled"] is True

    renamed = client.patch(
        f"/api/courses/{course['id']}",
        headers=headers,
        json={"title": "Machine Learning II"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Machine Learning II"

    archived = client.patch(
        f"/api/courses/{course['id']}",
        headers=headers,
        json={"is_archived": True},
    )
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True

    listed = client.get("/api/courses", headers=headers)
    assert listed.status_code == 200
    assert [item["title"] for item in listed.json()["courses"]] == ["Just Asking"]
    stored = repo.get_project(course["id"])
    assert stored is not None
    assert stored["is_archived"] == 1


def test_default_course_cannot_be_modified(course_client):
    client, _repo = course_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    default_course = client.get("/api/courses", headers=headers).json()["courses"][0]

    for payload in (
        {"title": "Renamed"},
        {"is_archived": True},
        {"context_enabled": True},
    ):
        response = client.patch(
            f"/api/courses/{default_course['id']}",
            headers=headers,
            json=payload,
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "conflict"


def test_course_validation_and_ownership_are_enforced(course_client):
    client, _repo = course_client
    owner_headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    other_headers = _register_and_login(client, "other@bnbu.edu.cn")

    empty = client.post("/api/courses", headers=owner_headers, json={"title": "   "})
    too_long = client.post("/api/courses", headers=owner_headers, json={"title": "x" * 201})
    owned = client.post(
        "/api/courses",
        headers=owner_headers,
        json={"title": "Private Course"},
    ).json()
    foreign = client.patch(
        f"/api/courses/{owned['id']}",
        headers=other_headers,
        json={"title": "Taken Over"},
    )

    assert empty.status_code == 400
    assert empty.json()["error"]["code"] == "validation_error"
    assert empty.json()["error"]["fields"] == [{"field": "title", "rule": "required"}]
    assert too_long.status_code == 400
    assert too_long.json()["error"]["fields"] == [{"field": "title", "rule": "too_long"}]
    assert foreign.status_code == 404
    assert foreign.json()["error"]["code"] == "not_found"


def test_course_endpoints_require_authentication(course_client):
    client, _repo = course_client

    response = client.get("/api/courses")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
