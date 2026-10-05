from __future__ import annotations

import uuid
from typing import Any

from backend.storage.sqlite import SQLiteRepository

DEFAULT_COURSE_TITLE = "Just Asking"
MAX_COURSE_TITLE_LENGTH = 200


class CourseError(Exception):
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


def course_error_envelope(exc: CourseError) -> dict[str, object]:
    error: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.fields:
        error["fields"] = exc.fields
    return {"error": error}


def list_courses(repo: SQLiteRepository, *, user_id: str) -> dict[str, list[dict[str, Any]]]:
    repo.get_or_create_default_project(user_id)
    return {
        "courses": [
            serialize_course(course)
            for course in repo.list_projects_for_user(user_id)
        ]
    }


def create_course(
    repo: SQLiteRepository,
    *,
    user_id: str,
    title: str,
) -> dict[str, Any]:
    normalized_title = validate_course_title(title)
    course_id = f"course_{uuid.uuid4().hex}"
    course = repo.create_project(
        id=course_id,
        user_id=user_id,
        title=normalized_title,
        root_path=f"workspace/courses/{course_id}",
        is_default=False,
        is_archived=False,
        context_enabled=True,
    )
    return serialize_course(course)


def update_course(
    repo: SQLiteRepository,
    *,
    user_id: str,
    course_id: str,
    title: str | None = None,
    is_archived: bool | None = None,
    context_enabled: bool | None = None,
    supplied_fields: set[str] | None = None,
) -> dict[str, Any]:
    course = repo.get_project_for_user(course_id, user_id)
    if not course:
        raise CourseError(404, "not_found", "Course was not found.")

    fields = supplied_fields or set()
    if not fields:
        raise CourseError(
            400,
            "validation_error",
            "At least one course field is required.",
            [{"field": "body", "rule": "required"}],
        )
    if course["is_default"]:
        raise CourseError(409, "conflict", "The default course cannot be modified.")

    updates: dict[str, Any] = {}
    if "title" in fields:
        updates["title"] = validate_course_title(title or "")
    if "is_archived" in fields:
        updates["is_archived"] = int(bool(is_archived))
    if "context_enabled" in fields:
        updates["context_enabled"] = int(bool(context_enabled))

    updated = repo.update_project(course_id, **updates)
    if not updated:
        raise CourseError(404, "not_found", "Course was not found.")
    return serialize_course(updated)


def validate_course_title(title: str) -> str:
    normalized = title.strip()
    if not normalized:
        raise CourseError(
            400,
            "validation_error",
            "Course title is required.",
            [{"field": "title", "rule": "required"}],
        )
    if len(normalized) > MAX_COURSE_TITLE_LENGTH:
        raise CourseError(
            400,
            "validation_error",
            "Course title is too long.",
            [{"field": "title", "rule": "too_long"}],
        )
    return normalized


def serialize_course(course: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": course["id"],
        "title": course["title"],
        "is_default": bool(course["is_default"]),
        "is_archived": bool(course["is_archived"]),
        "context_enabled": bool(course["context_enabled"]),
        "context_updated_at": course.get("context_updated_at"),
    }
