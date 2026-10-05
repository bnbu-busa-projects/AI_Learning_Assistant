from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Header, Request, UploadFile
from fastapi.responses import JSONResponse

from backend.api.auth import get_auth_repository
from backend.core.uploads import (
    UploadCandidate,
    UploadError,
    UploadLimits,
    get_upload_metadata_for_user,
    persist_uploads,
    upload_error_envelope,
    upload_limits_from_env,
)
from backend.core.weak_auth import current_user_from_authorization
from backend.storage.sqlite import SQLiteRepository

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


async def upload_error_handler(_request: Request, exc: UploadError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=upload_error_envelope(exc))


def get_upload_repository() -> SQLiteRepository:
    return SQLiteRepository.from_path()


def get_upload_workspace_root() -> str | None:
    return None


def get_upload_limits() -> UploadLimits:
    return upload_limits_from_env()


def upload_current_user(
    authorization: Annotated[str | None, Header()] = None,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, Any]:
    return current_user_from_authorization(repo, authorization)


@router.post("")
async def post_uploads(
    files: list[UploadFile] = File(default_factory=list),
    current_user: dict[str, Any] = Depends(upload_current_user),
    repo: SQLiteRepository = Depends(get_upload_repository),
    workspace_root: str | None = Depends(get_upload_workspace_root),
    limits: UploadLimits = Depends(get_upload_limits),
) -> JSONResponse:
    candidates: list[UploadCandidate] = []
    for file in files:
        candidates.append(
            UploadCandidate(
                original_name=file.filename or "upload",
                content_type=file.content_type,
                content=await file.read(),
            )
        )
    body = persist_uploads(
        repo,
        current_user=current_user,
        files=candidates,
        workspace_root=workspace_root,
        limits=limits,
    )
    return JSONResponse(status_code=201, content=body)


@router.get("/{upload_id}")
def get_upload(
    upload_id: str,
    current_user: dict[str, Any] = Depends(upload_current_user),
    repo: SQLiteRepository = Depends(get_upload_repository),
) -> dict[str, Any]:
    return get_upload_metadata_for_user(
        repo,
        upload_id=upload_id,
        user_id=str(current_user["id"]),
    )
