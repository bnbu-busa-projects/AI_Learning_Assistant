from __future__ import annotations

import os
from typing import Annotated, Any, Callable

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.api.auth import get_auth_repository
from backend.core.model_settings import (
    SettingsError,
    list_profiles,
    load_profile_for_test,
    save_default_profile,
)
from backend.core.weak_auth import current_user_from_authorization
from backend.providers.mock import test_mock_provider
from backend.providers.openai_compatible import test_openai_compatible_provider
from backend.storage.sqlite import SQLiteRepository

router = APIRouter(prefix="/api/settings", tags=["settings"])
ProviderTester = Callable[[dict[str, Any], str], dict[str, Any]]
MOCK_MODEL_PROVIDER_ENV = "AILA_MOCK_MODEL_PROVIDER"


class ModelProfileRequest(BaseModel):
    display_name: str | None = None
    provider: str | None = None
    base_url: str
    model: str
    api_key: str | None = None
    context_window_hint: int | None = None
    supports_streaming: bool | None = None


class ProviderTestRequest(BaseModel):
    display_name: str | None = None
    provider: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
    context_window_hint: int | None = None
    supports_streaming: bool | None = None


def settings_error_envelope(exc: SettingsError) -> dict[str, object]:
    error: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.fields:
        error["fields"] = exc.fields
    return {"error": error}


async def settings_error_handler(_request: Request, exc: SettingsError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=settings_error_envelope(exc))


def get_settings_repository() -> SQLiteRepository:
    return SQLiteRepository.from_path()


def get_provider_tester() -> ProviderTester:
    if os.getenv(MOCK_MODEL_PROVIDER_ENV, "").strip().lower() in {"1", "true", "yes", "on"}:
        return test_mock_provider
    return test_openai_compatible_provider


def settings_current_user(
    authorization: Annotated[str | None, Header()] = None,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, Any]:
    return current_user_from_authorization(repo, authorization)


@router.get("/model-profiles")
def get_model_profiles(
    current_user: dict[str, Any] = Depends(settings_current_user),
    repo: SQLiteRepository = Depends(get_settings_repository),
) -> list[dict[str, Any]]:
    return list_profiles(repo, user_id=current_user["id"])


@router.put("/model-profiles/default")
def put_default_model_profile(
    request: ModelProfileRequest,
    current_user: dict[str, Any] = Depends(settings_current_user),
    repo: SQLiteRepository = Depends(get_settings_repository),
) -> dict[str, Any]:
    return save_default_profile(
        repo,
        user_id=current_user["id"],
        display_name=request.display_name,
        provider=request.provider,
        base_url=request.base_url,
        model=request.model,
        api_key=request.api_key,
        context_window_hint=request.context_window_hint,
        supports_streaming=request.supports_streaming,
    )


@router.post("/model-profiles/test")
def test_model_profile(
    request: ProviderTestRequest,
    current_user: dict[str, Any] = Depends(settings_current_user),
    repo: SQLiteRepository = Depends(get_settings_repository),
    provider_tester: ProviderTester = Depends(get_provider_tester),
) -> dict[str, Any]:
    profile, api_key = load_profile_for_test(
        repo,
        user_id=current_user["id"],
        submitted_profile=request.model_dump(),
    )
    return provider_tester(profile, api_key)
