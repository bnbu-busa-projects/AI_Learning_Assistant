import pytest

from backend.api.auth import get_auth_repository
from backend.api.settings import get_provider_tester, get_settings_repository
from backend.core.model_settings import default_profile_values
from backend.main import app
from backend.storage.sqlite import SQLiteRepository


DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"


@pytest.fixture()
def settings_client(client, tmp_path, monkeypatch):
    repo = SQLiteRepository.from_path(tmp_path / "settings.sqlite")
    secret_file = tmp_path / "local-secrets.env"
    monkeypatch.setenv("MODEL_SECRET_FILE", str(secret_file))
    app.dependency_overrides[get_auth_repository] = lambda: repo
    app.dependency_overrides[get_settings_repository] = lambda: repo

    register = client.post(
        "/api/auth/register",
        json={
            "email": "teacher@bnbu.edu.cn",
            "password": "correct-horse",
            "confirm_password": "correct-horse",
        },
    )
    assert register.status_code == 200
    login = client.post(
        "/api/auth/login",
        json={"email": "teacher@bnbu.edu.cn", "password": "correct-horse"},
    )
    assert login.status_code == 200
    token = login.json()["token"]

    yield client, repo, {"Authorization": f"Bearer {token}"}, secret_file

    app.dependency_overrides.pop(get_auth_repository, None)
    app.dependency_overrides.pop(get_settings_repository, None)
    app.dependency_overrides.pop(get_provider_tester, None)


def test_create_update_and_list_default_model_profile_redacts_secret(settings_client):
    client, _repo, headers, secret_file = settings_client
    raw_key = "sk-local-secret-for-test"

    create = client.put(
        "/api/settings/model-profiles/default",
        headers=headers,
        json={
            "display_name": "Qwen",
            "provider": "openai_compatible",
            "base_url": DEFAULT_QWEN_BASE_URL,
            "model": "qwen3.6-flash",
            "api_key": raw_key,
            "context_window_hint": 1000000,
            "supports_streaming": True,
        },
    )

    assert create.status_code == 200
    assert raw_key not in create.text
    assert create.json()["api_key_ref"] == "env:MODEL_API_KEY"
    assert raw_key in secret_file.read_text(encoding="utf-8")

    update = client.put(
        "/api/settings/model-profiles/default",
        headers=headers,
        json={
            "display_name": "Qwen Updated",
            "provider": "openai_compatible",
            "base_url": DEFAULT_QWEN_BASE_URL,
            "model": "qwen-updated",
        },
    )
    assert update.status_code == 200
    assert update.json()["model"] == "qwen-updated"

    profiles = client.get("/api/settings/model-profiles", headers=headers)
    assert profiles.status_code == 200
    body = profiles.json()
    assert len(body) == 1
    assert body[0]["is_default"] is True
    assert raw_key not in profiles.text


def test_missing_credentials_return_clear_error(settings_client):
    client, _repo, headers, _secret_file = settings_client

    save = client.put(
        "/api/settings/model-profiles/default",
        headers=headers,
        json={
            "base_url": DEFAULT_QWEN_BASE_URL,
            "model": "qwen3.6-flash",
        },
    )
    assert save.status_code == 200

    response = client.post("/api/settings/model-profiles/test", headers=headers, json={})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "missing_api_key"


def test_provider_connectivity_is_mockable(settings_client):
    client, _repo, headers, _secret_file = settings_client
    seen = {}

    def fake_provider_tester(profile, api_key):
        seen["profile"] = profile
        seen["api_key"] = api_key
        return {"ok": True, "provider": profile["provider"], "model": profile["model"]}

    app.dependency_overrides[get_provider_tester] = lambda: fake_provider_tester

    save = client.put(
        "/api/settings/model-profiles/default",
        headers=headers,
        json={
            "base_url": DEFAULT_QWEN_BASE_URL,
            "model": "qwen3.6-flash",
            "api_key": "sk-connectivity-test",
        },
    )
    assert save.status_code == 200

    response = client.post("/api/settings/model-profiles/test", headers=headers, json={})

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "provider": "openai_compatible",
        "model": "qwen3.6-flash",
    }
    assert seen["api_key"] == "sk-connectivity-test"


def test_environment_default_profile_uses_documented_qwen_defaults(monkeypatch):
    monkeypatch.delenv("MODEL_BASE_URL", raising=False)
    monkeypatch.delenv("MODEL_NAME", raising=False)
    monkeypatch.delenv("MODEL_CONTEXT_WINDOW", raising=False)

    defaults = default_profile_values()

    assert defaults["provider"] == "openai_compatible"
    assert defaults["base_url"] == DEFAULT_QWEN_BASE_URL
    assert defaults["model"] == "qwen3.6-flash"
    assert defaults["context_window_hint"] == 1000000
    assert defaults["supports_streaming"] is True


def test_malformed_profile_uses_validation_envelope(settings_client):
    client, _repo, headers, _secret_file = settings_client

    response = client.put(
        "/api/settings/model-profiles/default",
        headers=headers,
        json={"base_url": "not-a-url", "model": ""},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert {"field": "base_url", "rule": "absolute_http_url"} in body["error"]["fields"]
    assert {"field": "model", "rule": "required"} in body["error"]["fields"]
