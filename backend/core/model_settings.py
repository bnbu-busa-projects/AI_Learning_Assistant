from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from backend.storage.sqlite import SQLiteRepository
from backend.core.model_secrets import ModelSecretError, encrypt_api_key, decrypt_api_key

MODEL_API_KEY_REF = "env:MODEL_API_KEY"
USER_KEY_REF_PREFIX = "user:"
SECRET_FILE_ENV = "MODEL_SECRET_FILE"
DEFAULT_SECRET_FILE = Path(".env.local")
DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_QWEN_MODEL = "qwen3.6-flash"
DEFAULT_QWEN_CONTEXT_WINDOW = 1000000


class SettingsError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        fields: list[dict[str, str]] | None = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields or []
        super().__init__(message)


def default_profile_values() -> dict[str, Any]:
    return {
        "display_name": os.getenv("MODEL_DISPLAY_NAME", "Qwen Default"),
        "provider": os.getenv("MODEL_PROVIDER", "openai_compatible"),
        "base_url": os.getenv("MODEL_BASE_URL", DEFAULT_QWEN_BASE_URL),
        "model": os.getenv("MODEL_NAME", DEFAULT_QWEN_MODEL),
        "context_window_hint": int(os.getenv("MODEL_CONTEXT_WINDOW", str(DEFAULT_QWEN_CONTEXT_WINDOW))),
        "supports_streaming": os.getenv("MODEL_SUPPORTS_STREAMING", "true").lower()
        in {"1", "true", "yes", "on"},
    }


def validate_profile(base_url: str, model: str) -> None:
    fields: list[dict[str, str]] = []
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        fields.append({"field": "base_url", "rule": "absolute_http_url"})
    if not model.strip():
        fields.append({"field": "model", "rule": "required"})
    if fields:
        raise SettingsError(400, "validation_error", "Model profile validation failed.", fields)


def _secret_file_path() -> Path:
    return Path(os.getenv(SECRET_FILE_ENV, DEFAULT_SECRET_FILE))


def _read_secret_file() -> dict[str, str]:
    path = _secret_file_path()
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _user_key_ref(user_id: str) -> str:
    return USER_KEY_REF_PREFIX + hashlib.sha256(user_id.encode("utf-8")).hexdigest()


def persist_api_key(
    api_key: str | None, *, repo: SQLiteRepository, user_id: str,
    existing_ref: str | None = None,
) -> str | None:
    personal_ref = _user_key_ref(user_id)
    if not api_key:
        if repo.get_model_secret(personal_ref):
            return personal_ref
        if existing_ref:
            return existing_ref
        return MODEL_API_KEY_REF if resolve_api_key(MODEL_API_KEY_REF) else None

    if not api_key.strip() or "\n" in api_key or "\r" in api_key:
        raise SettingsError(400, "validation_error", "API key must be a non-empty single line.",
                            [{"field": "api_key", "rule": "single_line"}])
    try:
        encrypted = encrypt_api_key(api_key.strip(), repo)
    except ModelSecretError as exc:
        raise SettingsError(500, "secret_storage_unavailable", str(exc)) from None
    repo.save_model_secret(user_id=user_id, api_key_ref=personal_ref, encrypted_api_key=encrypted)
    return personal_ref


def resolve_api_key(
    api_key_ref: str | None, submitted_api_key: str | None = None,
    *, repo: SQLiteRepository | None = None,
) -> str | None:
    if submitted_api_key:
        return submitted_api_key
    if api_key_ref == MODEL_API_KEY_REF:
        return os.getenv("MODEL_API_KEY") or _read_secret_file().get("MODEL_API_KEY")
    if api_key_ref and api_key_ref.startswith(USER_KEY_REF_PREFIX):
        owns_repo = repo is None
        repository = repo or SQLiteRepository.from_path()
        try:
            secret = repository.get_model_secret(api_key_ref)
            if secret:
                try:
                    return decrypt_api_key(secret["encrypted_api_key"], repository)
                except ModelSecretError as exc:
                    raise SettingsError(500, "secret_storage_unavailable", str(exc)) from None
        finally:
            if owns_repo:
                repository.engine.dispose()
    return None


def serialize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": profile["id"],
        "display_name": profile["display_name"],
        "provider": profile["provider"],
        "base_url": profile["base_url"],
        "model": profile["model"],
        "api_key_ref": profile.get("api_key_ref"),
        "context_window_hint": profile.get("context_window_hint"),
        "supports_streaming": bool(profile["supports_streaming"]),
        "is_default": bool(profile["is_default"]),
    }


def save_default_profile(
    repo: SQLiteRepository,
    *,
    user_id: str,
    display_name: str | None,
    provider: str | None,
    base_url: str,
    model: str,
    api_key: str | None,
    context_window_hint: int | None,
    supports_streaming: bool | None,
) -> dict[str, Any]:
    validate_profile(base_url, model)
    existing = repo.get_default_model_profile(user_id)
    profile = repo.upsert_default_model_profile(
        user_id=user_id,
        display_name=display_name or "Qwen Default",
        provider=provider or "openai_compatible",
        base_url=base_url,
        model=model.strip(),
        api_key_ref=persist_api_key(
            api_key, repo=repo, user_id=user_id, existing_ref=existing.get("api_key_ref") if existing else None,
        ),
        context_window_hint=context_window_hint,
        supports_streaming=True if supports_streaming is None else supports_streaming,
    )
    return serialize_profile(profile)


def list_profiles(repo: SQLiteRepository, *, user_id: str) -> list[dict[str, Any]]:
    return [serialize_profile(profile) for profile in repo.list_model_profiles(user_id)]


def load_profile_for_test(
    repo: SQLiteRepository,
    *,
    user_id: str,
    submitted_profile: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    api_key = submitted_profile.get("api_key")
    saved = repo.get_default_model_profile(user_id)
    saved_ref = saved.get("api_key_ref") if saved else None
    if submitted_profile.get("base_url") or submitted_profile.get("model"):
        defaults = default_profile_values()
        profile = {
            "id": "submitted",
            "display_name": submitted_profile.get("display_name") or defaults["display_name"],
            "provider": submitted_profile.get("provider") or defaults["provider"],
            "base_url": submitted_profile.get("base_url") or defaults["base_url"],
            "model": submitted_profile.get("model") or defaults["model"],
            "api_key_ref": saved_ref or MODEL_API_KEY_REF,
            "context_window_hint": submitted_profile.get("context_window_hint"),
            "supports_streaming": bool(submitted_profile.get("supports_streaming", True)),
            "is_default": False,
        }
    else:
        if not saved:
            defaults = default_profile_values()
            profile = {
                "id": "environment-default",
                "display_name": defaults["display_name"],
                "provider": defaults["provider"],
                "base_url": defaults["base_url"],
                "model": defaults["model"],
                "api_key_ref": MODEL_API_KEY_REF,
                "context_window_hint": defaults["context_window_hint"],
                "supports_streaming": defaults["supports_streaming"],
                "is_default": True,
            }
        else:
            profile = serialize_profile(saved)

    validate_profile(profile["base_url"], profile["model"])
    resolved_key = resolve_api_key(profile.get("api_key_ref") or MODEL_API_KEY_REF, api_key, repo=repo)
    if not resolved_key:
        raise SettingsError(400, "missing_api_key", "No model API key is configured.")
    return profile, resolved_key
