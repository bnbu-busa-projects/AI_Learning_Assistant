from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet

from backend.core.model_settings import (
    MODEL_API_KEY_REF, SettingsError, load_profile_for_test,
    resolve_api_key, save_default_profile,
)
from backend.core.runs import RunError, _resolve_model_for_run
from backend.providers.base import TextGenerationRequest, ModelProviderError
from backend.providers.openai_compatible import OpenAICompatibleTextProvider
from backend.storage.sqlite import SQLiteRepository


@pytest.fixture()
def keys(tmp_path, monkeypatch):
    database = tmp_path / "app.sqlite"
    master = tmp_path / "model-key-encryption.key"
    shared = tmp_path / "model-secrets.env"
    monkeypatch.setenv("APP_SQLITE_PATH", str(database))
    monkeypatch.setenv("MODEL_SECRET_FILE", str(shared))
    monkeypatch.setenv("MODEL_KEY_ENCRYPTION_FILE", str(master))
    monkeypatch.delenv("MODEL_KEY_ENCRYPTION_KEY", raising=False)
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    repo = SQLiteRepository.from_path(database)
    users = [repo.create_user(email=f"key{i}@bnbu.edu.cn", role="teacher", password_hash="hash") for i in range(3)]
    return repo, users, master, shared


def save(repo, user, key=None, **overrides):
    values = dict(display_name="Qwen", provider="openai_compatible", base_url="https://example.com/v1",
                  model="example", api_key=key, context_window_hint=1000000, supports_streaming=True)
    values.update(overrides)
    return save_default_profile(repo, user_id=user["id"], **values)


def test_accounts_keep_separate_keys_and_update_only_their_own(keys, monkeypatch):
    repo, users, master, shared = keys
    shared.write_text("MODEL_API_KEY=developer-file-key\n")
    monkeypatch.setenv("MODEL_API_KEY", "developer-environment-key")
    first = save(repo, users[0], "personal-a")
    second = save(repo, users[1], "personal-b")
    assert first["api_key_ref"] != second["api_key_ref"]
    assert resolve_api_key(first["api_key_ref"], repo=repo) == "personal-a"
    assert resolve_api_key(second["api_key_ref"], repo=repo) == "personal-b"
    assert resolve_api_key(MODEL_API_KEY_REF) == "developer-environment-key"
    assert shared.read_text() == "MODEL_API_KEY=developer-file-key\n"
    save(repo, users[1], "replacement-b")
    changed = save(repo, users[0], model="different-model")
    assert changed["api_key_ref"] == first["api_key_ref"]
    assert resolve_api_key(first["api_key_ref"], repo=repo) == "personal-a"
    assert resolve_api_key(second["api_key_ref"], repo=repo) == "replacement-b"
    assert master.stat().st_mode & 0o777 == 0o600
    for key in ["personal-a", "personal-b", "replacement-b"]:
        assert key.encode() not in Path(repo.engine.url.database).read_bytes()
    # Reopening the repository simulates an app restart.
    reopened = SQLiteRepository.from_path(repo.engine.url.database)
    assert resolve_api_key(second["api_key_ref"], repo=reopened) == "replacement-b"


def test_shared_fallback_and_legacy_reference_stay_compatible(keys):
    repo, users, _, shared = keys
    legacy = save(repo, users[0])
    assert legacy["api_key_ref"] is None
    shared.write_text("MODEL_API_KEY=developer-key\n")
    profile = _resolve_model_for_run(repo, user_id=users[0]["id"], model_profile_id=None)
    assert resolve_api_key(profile["api_key_ref"], repo=repo) == "developer-key"
    fallback = save(repo, users[1])
    assert fallback["api_key_ref"] == MODEL_API_KEY_REF
    save(repo, users[0], "personal-a")
    assert resolve_api_key(fallback["api_key_ref"], repo=repo) == "developer-key"
    _, key = load_profile_for_test(repo, user_id=users[2]["id"], submitted_profile={})
    assert key == "developer-key"


def test_saved_key_used_for_connection_test_and_generation(keys, monkeypatch):
    repo, users, _, _ = keys
    first = save(repo, users[0], "personal-a")
    second = save(repo, users[1], "personal-b")
    for user, expected in [(users[0], "personal-a"), (users[1], "personal-b")]:
        _, key = load_profile_for_test(repo, user_id=user["id"], submitted_profile={"model": "edited-model"})
        assert key == expected
    seen = []
    def fake_openai(**kwargs):
        seen.append(kwargs["api_key"])
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
            create=lambda **_: SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Generated"))])
        )))
    monkeypatch.setattr("backend.providers.openai_compatible.OpenAI", fake_openai)
    provider = OpenAICompatibleTextProvider()
    for profile in [first, second]:
        result = provider.generate_text(TextGenerationRequest(profile=profile, system_prompt="system", user_prompt="task", max_output_tokens=100))
        assert result == "Generated"
    assert seen == ["personal-a", "personal-b"]
    with pytest.raises(RunError) as error:
        _resolve_model_for_run(repo, user_id=users[0]["id"], model_profile_id=second["id"])
    assert error.value.code == "not_found"


def test_unsaved_test_key_does_not_replace_saved_key(keys):
    repo, users, _, _ = keys
    profile = save(repo, users[0], "saved-key")
    _, key = load_profile_for_test(repo, user_id=users[0]["id"], submitted_profile={"api_key": "temporary-key"})
    assert key == "temporary-key"
    assert resolve_api_key(profile["api_key_ref"], repo=repo) == "saved-key"


def test_missing_master_key_fails_safely_without_recreating_it(keys):
    repo, users, master, shared = keys
    profile = save(repo, users[0], "personal-a")
    master.unlink()
    shared.write_text("MODEL_API_KEY=developer-key\n")
    with pytest.raises(SettingsError) as error:
        resolve_api_key(profile["api_key_ref"], repo=repo)
    assert error.value.code == "secret_storage_unavailable"
    with pytest.raises(SettingsError):
        save(repo, users[1], "personal-b")
    assert not master.exists()
    with pytest.raises(ModelProviderError) as error:
        OpenAICompatibleTextProvider().generate_text(TextGenerationRequest(profile=profile, system_prompt="system", user_prompt="task", max_output_tokens=100))
    assert error.value.code == "secret_storage_unavailable"
    assert "personal-a" not in str(error.value)


def test_ciphertext_tampering_and_wrong_master_are_rejected(keys, monkeypatch):
    repo, users, master, _ = keys
    profile = save(repo, users[0], "personal-a")
    secret = repo.get_model_secret(profile["api_key_ref"])
    monkeypatch.setenv("MODEL_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    with pytest.raises(SettingsError):
        resolve_api_key(profile["api_key_ref"], repo=repo)
    monkeypatch.delenv("MODEL_KEY_ENCRYPTION_KEY")
    repo.save_model_secret(user_id=users[0]["id"], api_key_ref=profile["api_key_ref"], encrypted_api_key="tampered-token")
    with pytest.raises(SettingsError) as error:
        resolve_api_key(profile["api_key_ref"], repo=repo)
    assert error.value.code == "secret_storage_unavailable"


def test_concurrent_saves_preserve_both_keys(keys):
    repo, users, _, _ = keys
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda pair: save(repo, pair[0], pair[1]), [(users[0], "personal-a"), (users[1], "personal-b")]))
    assert [resolve_api_key(p["api_key_ref"], repo=repo) for p in results] == ["personal-a", "personal-b"]


def test_environment_master_key_is_supported(keys, monkeypatch):
    repo, users, master, _ = keys
    monkeypatch.setenv("MODEL_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    profile = save(repo, users[0], "personal-a")
    assert not master.exists()
    assert resolve_api_key(profile["api_key_ref"], repo=repo) == "personal-a"
