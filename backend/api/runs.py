from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from backend.api.auth import get_auth_repository
from backend.core.artifact_access import (
    get_run_artifact_file_for_user,
    list_run_artifacts_for_user,
)
from backend.core.runs import (
    RunError,
    RunExecutor,
    create_run,
    get_run_status_event_for_user,
    get_run_for_user,
    make_default_run_executor,
    run_error_envelope,
)
from backend.core.run_events import RunEventStore, default_run_event_store
from backend.core.weak_auth import current_user_from_authorization
from backend.context.search_policy import DuckDuckGoSearchAdapter, WebSearchAdapter
from backend.storage.sqlite import SQLiteRepository

router = APIRouter(prefix="/api/runs", tags=["runs"])


class RunCreateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    task_text: str
    intent: str | None = None
    output_preference: str | None = None
    search_mode: str = "auto"
    model_profile_id: str | None = None
    revision_of_run_id: str | None = None
    course_id: str | None = None
    upload_ids: list[str] = Field(default_factory=list)
    options: dict[str, Any] = Field(default_factory=dict)


async def run_error_handler(_request: Request, exc: RunError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=run_error_envelope(exc))


def get_run_repository() -> SQLiteRepository:
    return SQLiteRepository.from_path()


def get_workspace_root() -> str | None:
    return None


def get_run_executor(request: Request) -> RunExecutor:
    return make_default_run_executor(
        pdf_converter=getattr(request.app.state, "pdf_converter", None)
    )


def get_run_search_adapter() -> WebSearchAdapter:
    return DuckDuckGoSearchAdapter()


def get_run_event_store() -> RunEventStore:
    return default_run_event_store


def run_current_user(
    authorization: Annotated[str | None, Header()] = None,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, Any]:
    return current_user_from_authorization(repo, authorization)


@router.post("")
def post_run(
    request: RunCreateRequest,
    current_user: dict[str, Any] = Depends(run_current_user),
    repo: SQLiteRepository = Depends(get_run_repository),
    workspace_root: str | None = Depends(get_workspace_root),
    executor: RunExecutor = Depends(get_run_executor),
    search_adapter: WebSearchAdapter = Depends(get_run_search_adapter),
) -> JSONResponse:
    body = create_run(
        repo,
        current_user=current_user,
        request=request.model_dump(),
        workspace_root=workspace_root,
        executor=executor,
        search_adapter=search_adapter,
    )
    return JSONResponse(status_code=202, content=body)


@router.get("/{run_id}")
def get_run(
    run_id: str,
    current_user: dict[str, Any] = Depends(run_current_user),
    repo: SQLiteRepository = Depends(get_run_repository),
) -> dict[str, Any]:
    return get_run_for_user(repo, run_id=run_id, user_id=current_user["id"])


@router.get("/{run_id}/events")
def get_run_events(
    run_id: str,
    current_user: dict[str, Any] = Depends(run_current_user),
    repo: SQLiteRepository = Depends(get_run_repository),
    event_store: RunEventStore = Depends(get_run_event_store),
) -> dict[str, Any]:
    return get_run_status_event_for_user(
        repo,
        run_id=run_id,
        user_id=current_user["id"],
        event_store=event_store,
    )


@router.get("/{run_id}/artifacts")
def get_run_artifacts(
    run_id: str,
    current_user: dict[str, Any] = Depends(run_current_user),
    repo: SQLiteRepository = Depends(get_run_repository),
) -> dict[str, Any]:
    return list_run_artifacts_for_user(repo, run_id=run_id, user_id=current_user["id"])


@router.get("/{run_id}/artifacts/files/{relative_path:path}")
def get_run_artifact_file(
    run_id: str,
    relative_path: str,
    current_user: dict[str, Any] = Depends(run_current_user),
    repo: SQLiteRepository = Depends(get_run_repository),
) -> FileResponse:
    path, media_type = get_run_artifact_file_for_user(
        repo,
        run_id=run_id,
        user_id=current_user["id"],
        relative_path=relative_path,
    )
    headers = {}
    if media_type == "application/pdf":
        headers["Content-Disposition"] = f'inline; filename="{path.name}"'
    return FileResponse(path, media_type=media_type, headers=headers)
