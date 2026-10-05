import hashlib
from pathlib import Path

import pytest

from backend.api.auth import get_auth_repository
from backend.api.uploads import (
    get_upload_limits,
    get_upload_repository,
    get_upload_workspace_root,
)
from backend.core.uploads import UploadLimits
from backend.main import app
from backend.storage.sqlite import SQLiteRepository


@pytest.fixture()
def upload_client(client, tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "uploads.sqlite")
    workspace_root = tmp_path / "workspace"
    app.dependency_overrides[get_auth_repository] = lambda: repo
    app.dependency_overrides[get_upload_repository] = lambda: repo
    app.dependency_overrides[get_upload_workspace_root] = lambda: str(workspace_root)
    yield client, repo, workspace_root
    app.dependency_overrides.pop(get_auth_repository, None)
    app.dependency_overrides.pop(get_upload_repository, None)
    app.dependency_overrides.pop(get_upload_workspace_root, None)
    app.dependency_overrides.pop(get_upload_limits, None)


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


def test_user_can_upload_markdown_and_fetch_metadata(upload_client):
    client, repo, workspace_root = upload_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    content = b"# Brief\nUse dynamic programming.\n"

    response = client.post(
        "/api/uploads",
        headers=headers,
        files=[("files", ("../../brief.md", content, "text/markdown"))],
    )

    assert response.status_code == 201
    body = response.json()
    upload = body["uploads"][0]
    assert upload["id"].startswith("upl_")
    assert upload["original_name"] == "brief.md"
    assert upload["media_type"] == "text/markdown"
    assert upload["size_bytes"] == len(content)
    assert upload["sha256"] == hashlib.sha256(content).hexdigest()
    assert "stored_path" not in upload

    row = repo.get_upload(upload["id"])
    assert row["user_id"] == repo.get_user_by_email("teacher@bnbu.edu.cn")["id"]
    stored_path = Path(row["stored_path"])
    assert stored_path.is_relative_to(workspace_root.resolve())
    assert stored_path.name == "brief.md"
    assert stored_path.read_bytes() == content

    metadata = client.get(f"/api/uploads/{upload['id']}", headers=headers)
    assert metadata.status_code == 200
    assert metadata.json() == upload
    assert "stored_path" not in metadata.json()
    assert "dynamic programming" not in str(metadata.json())


def test_user_can_upload_multiple_pdfs(upload_client):
    client, _repo, _workspace_root = upload_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    pdf_one = b"%PDF-1.4\n% lecture one\n%%EOF\n"
    pdf_two = b"%PDF-1.4\n% lecture two\n%%EOF\n"

    response = client.post(
        "/api/uploads",
        headers=headers,
        files=[
            ("files", ("lecture-01.pdf", pdf_one, "application/pdf")),
            ("files", ("lecture-02.pdf", pdf_two, "application/pdf")),
        ],
    )

    assert response.status_code == 201
    uploads = response.json()["uploads"]
    assert [upload["original_name"] for upload in uploads] == [
        "lecture-01.pdf",
        "lecture-02.pdf",
    ]
    assert {upload["media_type"] for upload in uploads} == {"application/pdf"}


def test_upload_requires_bearer_token(upload_client):
    client, _repo, _workspace_root = upload_client

    response = client.post(
        "/api/uploads",
        files=[("files", ("brief.md", b"# Brief", "text/markdown"))],
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_upload_rejects_missing_files(upload_client):
    client, _repo, _workspace_root = upload_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.post("/api/uploads", headers=headers)

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "At least one upload file is required.",
            "fields": [{"field": "files", "rule": "required"}],
        }
    }


def test_upload_rejects_unsupported_media_type(upload_client):
    client, _repo, _workspace_root = upload_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")

    response = client.post(
        "/api/uploads",
        headers=headers,
        files=[("files", ("program.exe", b"hello", "application/octet-stream"))],
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media_type"


def test_upload_rejects_oversized_file(upload_client):
    client, _repo, _workspace_root = upload_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    app.dependency_overrides[get_upload_limits] = lambda: UploadLimits(
        max_single_file_size_bytes=4,
        max_files_per_request=40,
        max_total_request_size_bytes=100,
    )

    response = client.post(
        "/api/uploads",
        headers=headers,
        files=[("files", ("brief.md", b"too large", "text/markdown"))],
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "upload_too_large"


def test_upload_rejects_too_many_files(upload_client):
    client, _repo, _workspace_root = upload_client
    headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    app.dependency_overrides[get_upload_limits] = lambda: UploadLimits(
        max_single_file_size_bytes=100,
        max_files_per_request=1,
        max_total_request_size_bytes=100,
    )

    response = client.post(
        "/api/uploads",
        headers=headers,
        files=[
            ("files", ("one.md", b"one", "text/markdown")),
            ("files", ("two.md", b"two", "text/markdown")),
        ],
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "upload_too_large"


def test_user_cannot_fetch_another_users_upload_metadata(upload_client):
    client, _repo, _workspace_root = upload_client
    owner_headers = _register_and_login(client, "teacher@bnbu.edu.cn")
    other_headers = _register_and_login(client, "other@bnbu.edu.cn")
    upload = client.post(
        "/api/uploads",
        headers=owner_headers,
        files=[("files", ("brief.md", b"# Owner", "text/markdown"))],
    ).json()["uploads"][0]

    response = client.get(f"/api/uploads/{upload['id']}", headers=other_headers)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
