from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.api.auth import get_auth_repository
from backend.core.courses import (
    CourseError,
    course_error_envelope,
    create_course,
    list_courses,
    update_course,
)
from backend.core.weak_auth import current_user_from_authorization
from backend.storage.sqlite import SQLiteRepository

router = APIRouter(prefix="/api/courses", tags=["courses"])


class CreateCourseRequest(BaseModel):
    title: str


class UpdateCourseRequest(BaseModel):
    title: str | None = None
    is_archived: bool | None = None
    context_enabled: bool | None = None


async def course_error_handler(_request: Request, exc: CourseError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=course_error_envelope(exc))


def get_course_repository() -> SQLiteRepository:
    return SQLiteRepository.from_path()


def course_current_user(
    authorization: Annotated[str | None, Header()] = None,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, Any]:
    return current_user_from_authorization(repo, authorization)


@router.get("")
def get_courses(
    current_user: dict[str, Any] = Depends(course_current_user),
    repo: SQLiteRepository = Depends(get_course_repository),
) -> dict[str, list[dict[str, Any]]]:
    return list_courses(repo, user_id=str(current_user["id"]))


@router.post("")
def post_course(
    request: CreateCourseRequest,
    current_user: dict[str, Any] = Depends(course_current_user),
    repo: SQLiteRepository = Depends(get_course_repository),
) -> JSONResponse:
    course = create_course(
        repo,
        user_id=str(current_user["id"]),
        title=request.title,
    )
    return JSONResponse(status_code=201, content=course)


@router.patch("/{course_id}")
def patch_course(
    course_id: str,
    request: UpdateCourseRequest,
    current_user: dict[str, Any] = Depends(course_current_user),
    repo: SQLiteRepository = Depends(get_course_repository),
) -> dict[str, Any]:
    return update_course(
        repo,
        user_id=str(current_user["id"]),
        course_id=course_id,
        title=request.title,
        is_archived=request.is_archived,
        context_enabled=request.context_enabled,
        supplied_fields=request.model_fields_set,
    )
